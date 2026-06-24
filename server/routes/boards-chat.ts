import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage as defaultStorage, type IStorage } from "../storage";
import { requireAuth as defaultRequireAuth } from "../middleware/auth";
import type { BoardAsset, BoardAssetEvalHistoryEntry, BoardMessageCta } from "@shared/schema";
import type { BoardAssetCreate, BoardMessageCreate } from "../storage";
import OpenAI, { type Uploadable } from "openai";
import type { LumaModel } from "../services/luma";
import type {
  SeedanceModel,
  SeedanceAspectRatio,
  SeedanceDuration,
} from "../services/seedance";
import { autoEvaluateBatch, type AutoEvalModelHint, type AutoEvalResult } from "../services/boardAutoEval";
import { openaiService } from "../services/openai";
import { persistImageBufferPublic } from "../objectStorage";
import { realtimeService } from "../websocket";

// NOTE: Generation services and chat services are imported lazily (see
// `dispatchOne`, `dispatchImage`, `registerBoardsChatRoutes`'s defaults).
// Several of them register module-level `setInterval` cleanup timers
// (e.g. `services/luma.ts`, `services/runway.ts`) which would otherwise
// keep the Node test runner alive and break `node --test` exit semantics
// in tests that inject their own dependencies.

const VIDEO_PROVIDERS = ["luma", "runway", "sora2", "seedance", "veo", "kling"] as const;
const IMAGE_PROVIDERS = ["openai-image", "gemini-image"] as const;
export const PROVIDERS = [...VIDEO_PROVIDERS, ...IMAGE_PROVIDERS] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];
export type Provider = (typeof PROVIDERS)[number];

export interface BrainstormChatImage {
  url: string;
  mediaType?: string;
}

export interface BrainstormChatService {
  chat(
    message: string,
    history: { role: "user" | "assistant"; content: string }[] | undefined,
    systemPrompt: string,
    images?: BrainstormChatImage[],
  ): Promise<{ success: boolean; message?: string; error?: string }>;
}

export interface BoardsChatProviders {
  anthropic?: BrainstormChatService;
  gemini?: BrainstormChatService;
  openaiBrainstorm?: (
    message: string,
    history?: { role: "user" | "assistant"; content: string }[],
    images?: BrainstormChatImage[],
    systemPrompt?: string,
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
}

/** Cap how many images we forward to the chosen vision model. */
const MAX_BRAINSTORM_IMAGES = 3;

export type DispatchOne = (
  provider: VideoProvider,
  genMode: GenMode,
  ctx: DispatchContext,
) => Promise<DispatchResult>;

export type DispatchImage = (
  provider: ImageProvider,
  ctx: DispatchContext,
) => Promise<ImageDispatchResult>;

function isImageProvider(p: Provider): p is ImageProvider {
  return (IMAGE_PROVIDERS as readonly string[]).includes(p);
}

/**
 * Fan a single asset's status (queued / generating / ready / failed) out to
 * every connected board participant via WebSocket. Exported so non-chat
 * entry points (e.g. the upload POST and the generic asset PATCH in
 * `routes/boards.ts`) can reuse the same fan-out shape — Task #242.
 */
export function pushAssetStatus(
  userIds: string[],
  boardId: string,
  asset: BoardAsset,
  extra?: Record<string, unknown>,
) {
  // De-dupe so the owner-as-collaborator case never gets two copies of the
  // same WS frame when the actor is also a recipient.
  const recipients = Array.from(new Set(userIds.filter((u) => !!u)));
  for (const userId of recipients) {
    try {
      realtimeService.sendToUser(userId, {
        type: "status_update",
        data: {
          scope: "board_asset",
          boardId,
          batchId: asset.batchId,
          assetId: asset.id,
          status: asset.status,
          kind: asset.kind,
          provider: asset.provider,
          modelLabel: asset.modelLabel,
          assetUrl: asset.assetUrl,
          thumbnailUrl: asset.thumbnailUrl,
          rejectionReason: asset.rejectionReason,
          ...(extra ?? {}),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[boards-chat] websocket push failed:", err);
    }
    try {
      realtimeService.notifyBoardAssetStatus(userId, {
        boardId,
        batchId: asset.batchId,
        assetId: asset.id,
        status: asset.status,
        assetUrl: asset.assetUrl ?? null,
        thumbnailUrl: asset.thumbnailUrl ?? null,
        durationSeconds: asset.durationSeconds ?? null,
        modelLabel: asset.modelLabel ?? null,
        provider: asset.provider,
        rejectionReason: asset.rejectionReason ?? null,
        // Forward the entire asset row so the receiving client can splice
        // a brand-new tile into its cache directly (Task #244). For
        // already-known assets the client will just patch in place and
        // ignore the extra fields, so it's safe to always include.
        fullAsset: asset,
      });
    } catch (err) {
      console.warn("[boards-chat] typed ws emit failed:", err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Resolve every user that should receive live updates for a board: the
 * board's owner plus every share recipient (and the actor as a fallback so
 * we never accidentally drop the requester from their own broadcast). Used
 * by the winner-override and re-evaluate flows so status changes triggered
 * by a collaborator land on every connected participant's canvas in real
 * time, mirroring how `server/routes/boards.ts` fans out asset PATCH/POST
 * updates via `notifyBoardAssetUpdated`.
 */
export async function resolveBoardRecipients(
  storage: IStorage,
  boardId: string,
  actorUserId: string,
): Promise<string[]> {
  const isEmailInviteRecipient = (id: string) => id.startsWith("email:");
  const recipientIds = new Set<string>([actorUserId]);
  try {
    const access = await storage.getAccessibleBoardForUser(boardId, actorUserId);
    if (access) {
      const ownerId = access.userId;
      recipientIds.add(ownerId);
      const shares = await storage.getBoardShares(boardId, ownerId);
      for (const s of shares) {
        if (!isEmailInviteRecipient(s.userId)) {
          recipientIds.add(s.userId);
        }
      }
    }
  } catch (err) {
    console.warn(
      "[boards-chat] failed to resolve board recipients:",
      err instanceof Error ? err.message : err,
    );
  }
  return Array.from(recipientIds);
}

const SEEDANCE_MODELS: SeedanceModel[] = [
  "seedance-1-0-pro-250528",
  "seedance-1-0-lite-t2v-250428",
  "seedance-1-0-lite-i2v-250428",
];
const SEEDANCE_ASPECTS: SeedanceAspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "3:4"];

const seedanceOptionsSchema = z.object({
  model: z.enum(SEEDANCE_MODELS as [SeedanceModel, ...SeedanceModel[]]).optional(),
  aspectRatio: z.enum(SEEDANCE_ASPECTS as [SeedanceAspectRatio, ...SeedanceAspectRatio[]]).optional(),
  durationSeconds: z.union([z.literal(5), z.literal(10)]).optional(),
});
export type GenMode = "text-to-video" | "image-to-video" | "video-to-video";
export type PollStatus = "pending" | "processing" | "completed" | "failed";

const LUMA_MODELS: ReadonlySet<LumaModel> = new Set<LumaModel>(["ray-2", "ray-flash-2"]);
function asLumaModel(value: string | undefined): LumaModel {
  if (value && LUMA_MODELS.has(value as LumaModel)) return value as LumaModel;
  return "ray-2";
}

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(["brainstorm", "create"]),
  referencedAssetIds: z.array(z.string()).optional(),
  provider: z.enum(PROVIDERS).optional(),
  generationMode: z.enum(["text-to-video", "image-to-video", "video-to-video"]).optional(),
  forceModel: z.string().optional(),
  variations: z.number().int().min(1).max(4).optional(),
  seedanceOptions: seedanceOptionsSchema.optional(),
  chatModel: z.enum(["claude", "gemini", "openai"]).optional(),
  conversationHistory: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

export type ChatModelId = "claude" | "gemini" | "openai";

const BRAINSTORM_SYSTEM_BASE = `You are a creative director assisting on a visual board.
Help the user brainstorm, refine prompts, and plan generations.
Be concise (under 200 words) and propose a concrete next prompt the user could send in "create" mode when appropriate.`;

/** Cap how many assets we describe in the per-asset bullet list to keep the
 * system prompt bounded. Aggregate counts always include every asset. */
const BOARD_CONTEXT_ASSET_CAP = 30;

/**
 * Build a compact, text-only summary of the board's current state for the
 * Think-mode system prompt. Returns a markdown block listing total counts
 * by kind and status plus a per-asset bulleted list. Any asset id present
 * in `referencedAssetIds` is tagged "← currently selected" so the model can
 * refer to it naturally even though the actual image bytes flow through a
 * separate vision channel.
 *
 * Exported for direct unit testing.
 */
export function buildBoardContextSummary(
  assets: BoardAsset[],
  referencedAssetIds: string[] = [],
): string {
  if (!assets || assets.length === 0) {
    return "## Current board state\nThe board is empty — no assets have been placed yet.";
  }
  const refSet = new Set(referencedAssetIds);
  const byKind = new Map<string, number>();
  const byStatus = new Map<string, number>();
  // Only count selections that actually exist on the board, so a stale id
  // from the client never inflates "the user has selected N assets" beyond
  // what's really there.
  let selectedOnBoard = 0;
  for (const a of assets) {
    byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + 1);
    byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
    if (refSet.has(a.id)) selectedOnBoard += 1;
  }
  const fmtCounts = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

  const shown = assets.slice(0, BOARD_CONTEXT_ASSET_CAP);
  const truncated = assets.length - shown.length;
  const lines: string[] = [];
  lines.push("## Current board state");
  lines.push(`Total assets: ${assets.length} (${fmtCounts(byKind)})`);
  lines.push(`Status breakdown: ${fmtCounts(byStatus)}`);
  if (selectedOnBoard > 0) {
    lines.push(
      `The user has currently selected ${selectedOnBoard} asset${selectedOnBoard === 1 ? "" : "s"}; refer to ${selectedOnBoard === 1 ? "it" : "them"} as "the selected ${selectedOnBoard === 1 ? "asset" : "assets"}" when relevant.`,
    );
  } else {
    lines.push("Nothing is currently selected.");
  }
  lines.push("Assets:");
  for (const a of shown) {
    const idTag = a.id.slice(0, 8);
    const batchTag = a.batchId ? ` batch ${a.batchId.slice(0, 6)}` : "";
    const selected = refSet.has(a.id) ? " ← currently selected" : "";
    lines.push(`- [${idTag}] ${a.kind} · ${a.status}${batchTag}${selected}`);
  }
  if (truncated > 0) {
    lines.push(`- …and ${truncated} more`);
  }
  return lines.join("\n");
}

/**
 * Compose the dynamic Think-mode system prompt: the static creative-director
 * base plus a `## Current board state` block that summarises what the user
 * has placed and selected. Exported so the handler test can assert the wiring.
 */
export function buildBrainstormSystemPrompt(
  assets: BoardAsset[],
  referencedAssetIds: string[] = [],
): string {
  return `${BRAINSTORM_SYSTEM_BASE}\n\n${buildBoardContextSummary(assets, referencedAssetIds)}`;
}

export function inferGenMode(refKinds: string[], message: string): GenMode {
  const lower = message.toLowerCase();
  // Explicit overrides in the user's message take precedence over reference inference.
  const mentionsV2V = /(video[-\s]?to[-\s]?video|\bv2v\b|from this video|edit this video|restyle (the|this) video)/.test(lower);
  const mentionsI2V = /(image[-\s]?to[-\s]?video|\bi2v\b|from this image|animate this (image|photo)|bring this (image|photo) to life)/.test(lower);
  const mentionsT2V = /(text[-\s]?to[-\s]?video|\bt2v\b|ignore (the|this) (image|video))/.test(lower);

  if (refKinds.includes("video") && !mentionsT2V && !mentionsI2V) return "video-to-video";
  if (refKinds.includes("image") && !mentionsT2V && !mentionsV2V) return "image-to-video";
  if (mentionsV2V && refKinds.includes("video")) return "video-to-video";
  if (mentionsI2V && refKinds.includes("image")) return "image-to-video";
  return "text-to-video";
}

export function pickDefaultProvider(genMode: GenMode, message: string): Provider {
  const lower = message.toLowerCase();
  if (genMode === "video-to-video") {
    // v2v is currently blocked at preflight in this build. Keep provider
    // selection deterministic for payload/telemetry consistency.
    return "luma";
  }
  if (genMode === "image-to-video") {
    if (lower.includes("veo")) return "veo";
    return "luma";
  }
  // text-to-video — VEO only override; everything else goes to Luma.
  if (lower.includes("veo")) return "veo";
  return "luma";
}

export interface DispatchContext {
  prompt: string;
  refAssets: BoardAsset[];
  forceModel?: string;
  seedanceOptions?: {
    model?: SeedanceModel;
    aspectRatio?: SeedanceAspectRatio;
    durationSeconds?: SeedanceDuration;
  };
}

export interface PollResult {
  status: PollStatus;
  videoUrl?: string;
  durationSeconds?: number;
  error?: string;
}

export interface DispatchResult {
  taskId: string;
  modelLabel: string;
  poll: () => Promise<PollResult>;
}

export async function dispatchOne(provider: VideoProvider, genMode: GenMode, ctx: DispatchContext): Promise<DispatchResult> {
  const firstImage = ctx.refAssets.find((a) => a.kind === "image")?.assetUrl || undefined;
  const firstVideo = ctx.refAssets.find((a) => a.kind === "video")?.assetUrl || undefined;

  switch (provider) {
    case "luma": {
      // Note: v2v on Luma is blocked at preflight in the chat route because the current
      // /generations integration cannot consume a referenced video as input.
      const { lumaService } = await import("../services/luma");
      const model = asLumaModel(ctx.forceModel);
      const task = await lumaService.createVideoTask(ctx.prompt, {
        model,
        keyframeImageUrl: firstImage,
      });
      return {
        taskId: task.taskId,
        modelLabel: model,
        poll: async () => {
          const s = await lumaService.getTaskStatus(task.taskId);
          return { status: s.status, videoUrl: s.videoUrl, error: s.error };
        },
      };
    }
    case "runway": {
      const { runwayService } = await import("../services/runway");
      const model = ctx.forceModel || "gen4_aleph";
      let taskId: string;
      if (genMode === "video-to-video") {
        throw new Error("Runway video-to-video is disabled in this build");
      } else if (genMode === "image-to-video") {
        if (!firstImage) throw new Error("Runway image-to-video requires a referenced image asset");
        const t = await runwayService.createImageToVideoTask(firstImage, ctx.prompt, { model: ctx.forceModel || "gen4_turbo" });
        taskId = t.taskId;
      } else {
        const t = await runwayService.createTextToVideoTask(ctx.prompt, { model: ctx.forceModel || "gen4.5" });
        taskId = t.taskId;
      }
      return {
        taskId,
        modelLabel: model,
        poll: async () => {
          const s = await runwayService.getTaskStatus(taskId);
          return { status: s.status, videoUrl: s.videoUrl, error: s.error };
        },
      };
    }
    case "sora2": {
      const { sora2Service } = await import("../services/sora2");
      const task = await sora2Service.createVideoTask(ctx.prompt, {
        imageUrls: firstImage ? [firstImage] : undefined,
      });
      return {
        taskId: task.taskId,
        modelLabel: ctx.forceModel || "sora-2",
        poll: async () => {
          const s = await sora2Service.getTaskStatus(task.taskId);
          return { status: s.status, videoUrl: s.videoUrl, error: s.error };
        },
      };
    }
    case "veo": {
      if (!firstImage) throw new Error("Veo currently requires a referenced image asset");
      const { veoVideoService } = await import("../services/veo-video");
      const result = await veoVideoService.generateVideo({ imageUrl: firstImage, prompt: ctx.prompt });
      if (!result.success || !result.operationId) {
        throw new Error(result.error || "Veo failed to start operation");
      }
      const opId = result.operationId;
      return {
        taskId: opId,
        modelLabel: ctx.forceModel || "veo-3.1",
        poll: async () => {
          const s = await veoVideoService.checkOperationStatus(opId);
          if (s.done && s.videoUrl) return { status: "completed", videoUrl: s.videoUrl };
          if (s.done && s.error) return { status: "failed", error: s.error };
          return { status: "processing" };
        },
      };
    }
    case "seedance": {
      const { seedanceService } = await import("../services/seedance");
      const opts = ctx.seedanceOptions ?? {};
      const aspectRatio = opts.aspectRatio ?? "16:9";
      const durationSeconds = opts.durationSeconds ?? 5;
      // Default model depends on whether we have an image to animate.
      const defaultModel: SeedanceModel = firstImage
        ? "seedance-1-0-lite-i2v-250428"
        : "seedance-1-0-pro-250528";
      const model = opts.model ?? defaultModel;
      const task = firstImage
        ? await seedanceService.createImageToVideo({
            prompt: ctx.prompt,
            sourceImageUrl: firstImage,
            model,
            aspectRatio,
            durationSeconds,
          })
        : await seedanceService.createTextToVideo({
            prompt: ctx.prompt,
            model,
            aspectRatio,
            durationSeconds,
          });
      return {
        taskId: task.taskId,
        modelLabel: ctx.forceModel || model,
        poll: async () => {
          const s = await seedanceService.getStatus(task.taskId);
          if (s.status === "ready") {
            return { status: "completed", videoUrl: s.videoUrl, durationSeconds };
          }
          if (s.status === "failed") return { status: "failed", error: s.error };
          if (s.status === "generating") return { status: "processing" };
          return { status: "pending" };
        },
      };
    }
    case "kling": {
      if (!firstImage) throw new Error("Kling image-to-video requires a referenced image asset");
      const { generateMotionVideo, checkMotionVideoStatus } = await import("../services/kling");
      const r = await generateMotionVideo(firstImage, ctx.prompt, { duration: "5", mode: "pro" });
      if (!r.success || !r.taskId) throw new Error(r.error || "Kling failed to start task");
      const taskId = r.taskId;
      return {
        taskId,
        modelLabel: ctx.forceModel || "kling-v1-6",
        poll: async () => {
          const s = await checkMotionVideoStatus(taskId);
          if (s.status === "completed" && s.videoUrl) {
            return { status: "completed", videoUrl: s.videoUrl, durationSeconds: 5 };
          }
          if (s.status === "failed") return { status: "failed", error: s.error };
          if (s.status === "pending" || s.status === "processing") return { status: s.status };
          return { status: "processing" };
        },
      };
    }
  }
}

interface ImageDispatchResult {
  modelLabel: string;
  imageUrl: string;
  edited: boolean;
}

export interface GeminiImageService {
  editImage(input: { prompt: string; referenceImageUrls: string[] }): Promise<string | null>;
  generateImage(input: { prompt: string; isPublic?: boolean }): Promise<string | null>;
}

export interface ImageDispatchDeps {
  openaiClientFactory?: () => OpenAI;
  geminiImageService?: GeminiImageService;
}

async function fetchAsUploadable(url: string, fallbackName: string): Promise<Uploadable> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL for referenced image");
    const mime = match[1];
    const buf = Buffer.from(match[2], "base64");
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    return await OpenAI.toFile(buf, `${fallbackName}.${ext}`, { type: mime });
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch referenced image (${res.status})`);
  const mime = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  return await OpenAI.toFile(buf, `${fallbackName}.${ext}`, { type: mime });
}

async function dispatchImage(
  provider: ImageProvider,
  ctx: DispatchContext,
  deps: ImageDispatchDeps = {},
): Promise<ImageDispatchResult> {
  const refImageUrls = ctx.refAssets
    .filter((a) => a.kind === "image" && !!a.assetUrl)
    .map((a) => a.assetUrl as string);

  if (provider === "gemini-image") {
    const geminiImageService: GeminiImageService =
      deps.geminiImageService ?? (await import("../services/openai")).openaiService;
    if (refImageUrls.length > 0) {
      const url = await geminiImageService.editImage({
        prompt: ctx.prompt,
        referenceImageUrls: refImageUrls,
      });
      if (!url) throw new Error("Gemini image edit returned no result");
      return {
        modelLabel: ctx.forceModel || "gemini-2.5-flash-image (edit)",
        imageUrl: url,
        edited: true,
      };
    }
    // openaiService.generateImage is implemented on top of Gemini's
    // gemini-2.5-flash-image model and persists to object storage when available.
    const url = await geminiImageService.generateImage({ prompt: ctx.prompt, isPublic: true });
    if (!url) throw new Error("Gemini image generation returned no result");
    return {
      modelLabel: ctx.forceModel || "gemini-2.5-flash-image",
      imageUrl: url,
      edited: false,
    };
  }
  // openai-image
  // Graceful fallback: if there's no OPENAI_API_KEY (or the openai client
  // factory throws), silently re-dispatch through Gemini's image path so the
  // user still gets a result instead of a hard error. We only fall back when
  // the client factory isn't user-provided (test injection always wins).
  if (!deps.openaiClientFactory && !process.env.OPENAI_API_KEY) {
    console.warn(
      "[boards-chat] openai-image requested but OPENAI_API_KEY missing — falling back to gemini-image",
    );
    return dispatchImage("gemini-image", ctx, deps);
  }
  const client = deps.openaiClientFactory
    ? deps.openaiClientFactory()
    : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = ctx.forceModel || "gpt-image-1";

  if (refImageUrls.length > 0) {
    // gpt-image-1 supports image-edit with one or more reference images.
    const uploads = await Promise.all(
      refImageUrls.map((u, i) => fetchAsUploadable(u, `ref-${Date.now()}-${i}`)),
    );
    const editResp = await client.images.edit({
      model,
      prompt: ctx.prompt,
      image: uploads.length === 1 ? uploads[0] : uploads,
      size: "1024x1024",
      n: 1,
    });
    const item = editResp.data?.[0];
    if (!item) throw new Error("OpenAI image edit returned no data");
    let imageUrl: string | null = null;
    if (item.b64_json) {
      const buf = Buffer.from(item.b64_json, "base64");
      const filename = `board-image-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const stored = await persistImageBuffer(buf, filename, "image/png");
      imageUrl = stored ?? `data:image/png;base64,${item.b64_json}`;
    } else if (item.url) {
      imageUrl = item.url;
    }
    if (!imageUrl) throw new Error("OpenAI image edit returned no usable URL");
    return { modelLabel: `${model} (edit)`, imageUrl, edited: true };
  }

  const resp = await client.images.generate({
    model,
    prompt: ctx.prompt,
    size: "1024x1024",
    n: 1,
  });
  const item = resp.data?.[0];
  if (!item) throw new Error("OpenAI image generation returned no data");
  let imageUrl: string | null = null;
  if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, "base64");
    const filename = `board-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const stored = await persistImageBufferPublic(buf, filename, "image/png");
    imageUrl = stored ?? `data:image/png;base64,${item.b64_json}`;
  } else if (item.url) {
    imageUrl = item.url;
  }
  if (!imageUrl) throw new Error("OpenAI image generation returned no usable URL");
  return { modelLabel: model, imageUrl, edited: false };
}

async function pollUntilDone(
  poll: DispatchResult["poll"],
  opts: { intervalMs?: number; maxMs?: number } = {},
): Promise<{ videoUrl?: string; durationSeconds?: number; error?: string }> {
  const interval = opts.intervalMs ?? 5000;
  const max = opts.maxMs ?? 5 * 60 * 1000;
  const start = Date.now();
  while (Date.now() - start < max) {
    try {
      const s = await poll();
      if (s.status === "completed") return { videoUrl: s.videoUrl, durationSeconds: s.durationSeconds };
      if (s.status === "failed") return { error: s.error || "Generation failed" };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Polling error" };
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return { error: "Generation timed out after 5 minutes" };
}

function normalizeBoardVideoUrls(args: {
  boardId: string;
  assetId: string;
  videoUrl: string;
}): { assetUrl: string; thumbnailUrl: string } {
  const { boardId, assetId, videoUrl } = args;
  // VEO can return local temp paths (e.g. /tmp/veo-output/*.mp4). Browsers
  // cannot play server-local paths directly, so normalize to an authenticated
  // board-scoped streaming endpoint.
  if (!videoUrl.startsWith("/tmp/")) {
    return { assetUrl: videoUrl, thumbnailUrl: videoUrl };
  }
  const served = `/api/boards/${boardId}/assets/${assetId}/video`;
  console.info(
    "[boards-chat] normalized local video URL",
    JSON.stringify({ from: videoUrl, to: served }),
  );
  // Keep the original local path in assetUrl so the stream endpoint can read
  // the actual file. Use the served URL for thumbnail/playback in the client.
  return { assetUrl: videoUrl, thumbnailUrl: served };
}

async function ensureQuickTimeCompatibleVideoPath(videoPath: string): Promise<string> {
  if (!videoPath.startsWith("/tmp/")) return videoPath;
  try {
    const { access } = await import("fs/promises");
    await access(videoPath);
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    const outPath = `/tmp/board-video-h264-${randomUUID().slice(0, 8)}.mp4`;
    await execAsync(
      `ffmpeg -y -i "${videoPath}" -vf "format=yuv420p" -c:v libx264 -preset fast -crf 22 -an -movflags +faststart "${outPath}"`,
      { timeout: 180000 },
    );
    console.info(
      "[boards-chat] transcoded local video for compatibility",
      JSON.stringify({ from: videoPath, to: outPath }),
    );
    return outPath;
  } catch (err) {
    console.warn(
      "[boards-chat] ensureQuickTimeCompatibleVideoPath failed, using original:",
      err instanceof Error ? err.message : err,
    );
    return videoPath;
  }
}

async function runBatchInBackground(args: {
  storage: IStorage;
  boardId: string;
  userId: string;
  batchId: string;
  prompt: string;
  provider: Provider;
  genMode: GenMode;
  refAssets: BoardAsset[];
  rows: BoardAsset[];
  forceModel?: string;
  seedanceOptions?: DispatchContext["seedanceOptions"];
  dispatch: DispatchOne;
  dispatchImageFn: DispatchImage;
  autoEval: (input: { prompt: string; assets: BoardAsset[] }) => Promise<AutoEvalResult>;
  /**
   * Pre-resolved fan-out targets (owner + every share recipient + the
   * actor) so each queued → ready / failed status flip during the batch
   * lands on every connected participant's canvas in real time. Mirrors
   * how the manual winner override and re-eval flows fan out via
   * `resolveBoardRecipients` (Task #237).
   */
  recipients: string[];
}) {
  const { storage, boardId, userId, batchId, prompt, provider, genMode, refAssets, rows, forceModel, seedanceOptions, dispatch, dispatchImageFn, autoEval, recipients } = args;

  await Promise.all(
    rows.map(async (row) => {
      try {
        if (isImageProvider(provider)) {
          const imageResult = await dispatchImageFn(provider, { prompt, refAssets, forceModel });
          const updated = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
            status: "ready",
            modelLabel: imageResult.modelLabel,
            assetUrl: imageResult.imageUrl,
            thumbnailUrl: imageResult.imageUrl,
          });
          if (updated) pushAssetStatus(recipients, boardId, updated);
          return;
        }
        const videoProvider = provider as VideoProvider;
        const dispatched = await dispatch(videoProvider, genMode, { prompt, refAssets, forceModel, seedanceOptions });
        const labelled = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          modelLabel: dispatched.modelLabel,
        });
        if (labelled) pushAssetStatus(recipients, boardId, labelled);
        const result = await pollUntilDone(dispatched.poll);
        if (result.error || !result.videoUrl) {
          const failed = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
            status: "failed",
            rejectionReason: result.error || "No output URL returned",
          });
          if (failed) pushAssetStatus(recipients, boardId, failed);
          return;
        }
        const compatiblePath = await ensureQuickTimeCompatibleVideoPath(result.videoUrl);
        const playableVideo = normalizeBoardVideoUrls({
          boardId,
          assetId: row.id,
          videoUrl: compatiblePath,
        });
        const ready = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          status: "ready",
          assetUrl: playableVideo.assetUrl,
          thumbnailUrl: playableVideo.thumbnailUrl,
          durationSeconds: result.durationSeconds ?? null,
        });
        if (ready) pushAssetStatus(recipients, boardId, ready);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        console.error(`[boards-chat] generation failed for asset ${row.id}:`, msg);
        const failed = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          status: "failed",
          rejectionReason: msg,
        });
        if (failed) pushAssetStatus(recipients, boardId, failed);
      }
    }),
  );

  try {
    await runAutoEvalAndApply({ storage, boardId, userId, batchId, prompt, autoEvalFn: autoEval });
  } catch (err) {
    console.error("[boards-chat] auto-eval pass failed:", err instanceof Error ? err.message : err);
  }

  // Single-asset batches skip auto-eval (it needs >= 2 candidates), so the
  // lone generated image/video would never reach the gallery via the winner
  // path. Save it directly here so single generations (e.g. one image-to-video
  // render) still land in the Media Library and complete the flow.
  if (rows.length === 1) {
    try {
      const all = await storage.getBoardAssetsForUser(boardId, userId);
      const sole = all.find((a) => a.id === rows[0].id);
      if (sole && sole.status === "ready") {
        await saveBoardAssetToGallery({ storage, userId, asset: sole });
      }
    } catch (err) {
      console.error(
        "[boards-chat] single-asset gallery save failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

function appendEvalHistory(
  asset: BoardAsset,
  entry: BoardAssetEvalHistoryEntry,
): BoardAssetEvalHistoryEntry[] {
  const prev = Array.isArray(asset.evalHistory) ? asset.evalHistory : [];
  return [...prev, entry];
}

async function runAutoEvalAndApply(args: {
  storage: IStorage;
  boardId: string;
  userId: string;
  batchId: string;
  prompt: string;
  modelHint?: AutoEvalModelHint;
  extraCriteria?: string;
  source?: "auto" | "manual";
  // Allows the boards-chat route to inject the (lazily-resolved) auto-eval
  // implementation it received via DI so tests can stub it. Defaults to the
  // top-level autoEvaluateBatch.
  autoEvalFn?: (input: {
    prompt: string;
    assets: BoardAsset[];
    modelHint?: AutoEvalModelHint;
    extraCriteria?: string;
  }) => Promise<AutoEvalResult>;
}): Promise<{
  applied: boolean;
  winnerAssetId?: string;
  modelUsed?: string;
  rejected?: Array<{ assetId: string; reason: string }>;
  reason?: string;
}> {
  const { storage, boardId, userId, batchId, prompt, modelHint, extraCriteria } = args;
  const source = args.source ?? "auto";
  const autoEvalFn = args.autoEvalFn ?? autoEvaluateBatch;
  const all = await storage.getBoardAssetsForUser(boardId, userId);
  const batchAssets = all.filter((a) => a.batchId === batchId);
  // Re-evals consider any asset that ever produced output (ready or previously-rejected
  // by a prior eval pass), so the user can have the model reconsider losers.
  const candidates = batchAssets.filter(
    (a) => (a.status === "ready" || a.status === "rejected") && !!a.assetUrl,
  );
  if (candidates.length < 2) {
    return { applied: false, reason: "Need at least 2 ready/rejected assets to evaluate" };
  }
  const evalResult = await autoEvalFn({
    prompt,
    assets: candidates,
    modelHint,
    extraCriteria,
  });
  console.log(
    `[boards-chat] ${source}-eval winner=${evalResult.winnerAssetId} model=${evalResult.modelUsed}`,
  );
  // Resolve every connected participant on the board (owner + share
  // recipients) so the resulting status flips and auto-eval summary fan
  // out live, matching how `notifyBoardAssetUpdated` broadcasts asset
  // PATCH/POST changes in `server/routes/boards.ts` (Task #237).
  const recipients = await resolveBoardRecipients(storage, boardId, userId);
  const at = new Date().toISOString();
  const winner = candidates.find((a) => a.id === evalResult.winnerAssetId);
  if (winner) {
    const updated = await storage.updateBoardAssetForUser(boardId, winner.id, userId, {
      status: "ready",
      rejectionReason: null,
      evalHistory: appendEvalHistory(winner, {
        at,
        source,
        outcome: "winner",
        modelUsed: evalResult.modelUsed,
        modelHint,
        extraCriteria,
        prevStatus: winner.status,
      }),
    });
    if (updated) {
      pushAssetStatus(recipients, boardId, updated, { autoEval: true });
      // Auto-selected winners flow into the app gallery too, so a freshly
      // generated image/video lands in the Media Library without an extra
      // manual pick. Best-effort + idempotent (see saveBoardAssetToGallery).
      await saveBoardAssetToGallery({ storage, userId, asset: updated });
    }
  }
  await Promise.all(
    evalResult.rejected.map(async (r) => {
      const a = candidates.find((c) => c.id === r.assetId);
      if (!a) return;
      const updated = await storage.updateBoardAssetForUser(boardId, r.assetId, userId, {
        status: "rejected",
        rejectionReason: r.reason,
        evalHistory: appendEvalHistory(a, {
          at,
          source,
          outcome: "rejected",
          reason: r.reason,
          modelUsed: evalResult.modelUsed,
          modelHint,
          extraCriteria,
          prevStatus: a.status,
        }),
      });
      if (updated) pushAssetStatus(recipients, boardId, updated, { autoEval: true });
    }),
  );
  for (const recipientId of recipients) {
    try {
      realtimeService.notifyBoardAutoEval(recipientId, {
        boardId,
        batchId,
        winnerAssetId: evalResult.winnerAssetId,
        rejected: evalResult.rejected,
        modelUsed: evalResult.modelUsed,
      });
    } catch (err) {
      console.warn(
        "[boards-chat] ws auto-eval emit failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return {
    applied: true,
    winnerAssetId: evalResult.winnerAssetId,
    modelUsed: evalResult.modelUsed,
    rejected: evalResult.rejected,
  };
}

/**
 * Persist a chosen board asset (image/video winner) into the unified media
 * library so it shows up in the app-wide gallery (`GET /api/media`, surfaced
 * by the dashboard Media Library / Quick Posts). Best-effort: never throws —
 * a gallery hiccup must not fail the winner-selection request. Idempotent:
 * skips if this exact board asset was already saved (tracked via
 * `metadata.boardAssetId`).
 */
async function saveBoardAssetToGallery(args: {
  storage: IStorage;
  userId: string;
  asset: BoardAsset;
}): Promise<void> {
  const { storage, userId, asset } = args;
  // Only media-bearing winners belong in the gallery — sticky notes, text
  // labels, frames and still-generating tiles have no shareable URL.
  if (!asset.assetUrl) return;
  if (asset.kind !== "image" && asset.kind !== "video") return;
  const isVideo = asset.kind === "video";
  try {
    const existing = await storage.getMediaAssets(userId);
    const already = existing.some(
      (m) =>
        (m.metadata as { boardAssetId?: string } | null)?.boardAssetId ===
        asset.id,
    );
    if (already) return;
    await storage.createMediaAsset({
      userId,
      type: isVideo ? "video" : "photo",
      source: "library",
      url: asset.assetUrl,
      thumbnailUrl: asset.thumbnailUrl ?? asset.assetUrl,
      title: asset.batchLabel || (isVideo ? "Board video" : "Board image"),
      description: null,
      avatarId: null,
      mimeType: isVideo ? "video/mp4" : "image/jpeg",
      fileSize: null,
      // Board width/height are canvas tile dimensions, not the media's pixel
      // resolution, so we leave these null rather than store misleading sizes.
      width: null,
      height: null,
      durationSeconds:
        isVideo && typeof asset.durationSeconds === "number"
          ? Math.round(asset.durationSeconds)
          : null,
      metadata: {
        boardAssetId: asset.id,
        boardId: asset.boardId,
        batchId: asset.batchId,
        provider: asset.provider,
      },
    });
  } catch (err) {
    console.error("[boards-chat] saveBoardAssetToGallery failed:", err);
  }
}

async function applyManualWinnerOverride(args: {
  storage: IStorage;
  boardId: string;
  userId: string;
  batchId: string;
  newWinnerAssetId: string;
  reasonForPriorWinner?: string;
  actorUserId: string;
}): Promise<{
  applied: boolean;
  winner?: BoardAsset;
  demoted?: BoardAsset[];
  reason?: string;
}> {
  const {
    storage,
    boardId,
    userId,
    batchId,
    newWinnerAssetId,
    reasonForPriorWinner,
    actorUserId,
  } = args;
  const all = await storage.getBoardAssetsForUser(boardId, userId);
  const batchAssets = all.filter((a) => a.batchId === batchId);
  if (batchAssets.length === 0) {
    return { applied: false, reason: "Batch not found" };
  }
  const target = batchAssets.find((a) => a.id === newWinnerAssetId);
  if (!target) {
    return { applied: false, reason: "Asset is not part of this batch" };
  }
  if (!target.assetUrl) {
    return { applied: false, reason: "Asset has no output to promote" };
  }
  // Resolve every connected participant on the board (owner + share
  // recipients) so promotion / demotion fans out live to every viewer's
  // canvas, not just the actor (Task #237). Mirrors the broadcast pattern
  // used by `notifyBoardAssetUpdated` in `server/routes/boards.ts`.
  const recipients = await resolveBoardRecipients(storage, boardId, userId);
  const at = new Date().toISOString();
  const priorWinners = batchAssets.filter(
    (a) => a.id !== target.id && a.status === "ready" && !!a.assetUrl,
  );
  const demoteReason =
    reasonForPriorWinner?.trim() ||
    `Demoted by user override in favour of ${target.id}`;
  const demoted: BoardAsset[] = [];
  for (const p of priorWinners) {
    const updated = await storage.updateBoardAssetForUser(boardId, p.id, userId, {
      status: "rejected",
      rejectionReason: demoteReason,
      evalHistory: appendEvalHistory(p, {
        at,
        source: "manual",
        outcome: "demoted",
        reason: demoteReason,
        actorUserId,
        prevStatus: p.status,
      }),
    });
    if (updated) {
      demoted.push(updated);
      pushAssetStatus(recipients, boardId, updated);
    }
  }
  const promoted = await storage.updateBoardAssetForUser(boardId, target.id, userId, {
    status: "ready",
    rejectionReason: null,
    evalHistory: appendEvalHistory(target, {
      at,
      source: "manual",
      outcome: "promoted",
      actorUserId,
      prevStatus: target.status,
    }),
  });
  if (promoted) pushAssetStatus(recipients, boardId, promoted);
  return { applied: true, winner: promoted ?? target, demoted };
}

async function tryOpenAIBrainstorm(
  message: string,
  history?: { role: "user" | "assistant"; content: string }[],
  images?: BrainstormChatImage[],
  systemPrompt?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { success: false, error: "OPENAI_API_KEY not configured" };
  try {
    const client = new OpenAI({ apiKey });
    const hasImages = Array.isArray(images) && images.length > 0;
    type OAIContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } };
    const messages: Array<
      | { role: "system" | "assistant"; content: string }
      | { role: "user"; content: string | OAIContentPart[] }
    > = [{ role: "system", content: systemPrompt ?? BRAINSTORM_SYSTEM_BASE }];
    for (const h of history || []) messages.push({ role: h.role, content: h.content });
    if (hasImages) {
      const parts: OAIContentPart[] = images!.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.url },
      }));
      parts.push({ type: "text", text: message });
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: "user", content: message });
    }
    const resp = await client.chat.completions.create({
      // Vision requests need a multimodal model. gpt-4o supports image_url
      // parts; gpt-4o-mini also supports vision and is cheaper for chat.
      model: "gpt-4o-mini",
      messages: messages as Parameters<typeof client.chat.completions.create>[0]["messages"],
      temperature: 0.7,
      max_tokens: 600,
    });
    const text = resp.choices?.[0]?.message?.content?.trim();
    if (!text) return { success: false, error: "OpenAI returned empty response" };
    return { success: true, message: text };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// =====================================================
// Chat-provider health tracking
// =====================================================
//
// The board-chat brainstorm path cascades across Claude → Gemini → ChatGPT.
// In production we have repeatedly observed two failure modes that, together,
// turn the chat into a brick wall of stacked upstream errors:
//
//   1. A provider's API key is invalid (401/403) — every request will fail
//      forever until the key is rotated. There's no point in re-trying it on
//      every message, and there's certainly no point in echoing the raw
//      "Incorrect API key provided" string to the end user.
//   2. A provider is transiently overloaded (429/503) — we should try the
//      next provider, but a single bad minute shouldn't poison the whole
//      session.
//
// We therefore keep a tiny in-process map of providers that returned a
// permanent-looking auth error, and skip them for `PROVIDER_DOWN_TTL_MS`.
// Transient errors are NOT persisted — we just try the next provider and
// move on. The original error is logged server-side; the client only ever
// sees a friendly summary plus which provider actually answered.
const PROVIDER_DOWN_TTL_MS = 30 * 60 * 1000; // 30 minutes
type ProviderHealthEntry = { downSince: number; reason: string };
const providerHealth = new Map<ChatModelId, ProviderHealthEntry>();

function classifyChatError(err: string | undefined): "permanent" | "transient" {
  if (!err) return "transient";
  const e = err.toLowerCase();
  if (
    e.includes("401") ||
    e.includes("403") ||
    e.includes("invalid_api_key") ||
    e.includes("incorrect api key") ||
    e.includes("invalid api key") ||
    e.includes("api key not valid") ||
    e.includes("authentication") ||
    e.includes("unauthorized") ||
    e.includes("not configured") ||
    e.includes("permission_denied")
  ) {
    return "permanent";
  }
  return "transient";
}

function markProviderDown(id: ChatModelId, reason: string) {
  providerHealth.set(id, { downSince: Date.now(), reason });
}

function isProviderDown(id: ChatModelId): boolean {
  const entry = providerHealth.get(id);
  if (!entry) return false;
  if (Date.now() - entry.downSince > PROVIDER_DOWN_TTL_MS) {
    providerHealth.delete(id);
    return false;
  }
  return true;
}

const CHAT_MODEL_ORDER: ChatModelId[] = ["gemini", "claude", "openai"];

export function getChatProviderHealthSnapshot(): {
  healthy: ChatModelId[];
  unhealthy: { id: ChatModelId; reason: string }[];
  default: ChatModelId | null;
} {
  const healthy: ChatModelId[] = [];
  const unhealthy: { id: ChatModelId; reason: string }[] = [];
  for (const id of CHAT_MODEL_ORDER) {
    if (isProviderDown(id)) {
      const entry = providerHealth.get(id)!;
      unhealthy.push({ id, reason: entry.reason });
    } else {
      healthy.push(id);
    }
  }
  return { healthy, unhealthy, default: healthy[0] ?? null };
}

/** Test-only: clear the health cache between cases. */
export function __resetChatProviderHealthForTests() {
  providerHealth.clear();
}

const FRIENDLY_ALL_DOWN =
  "Our AI assistant is having trouble reaching its providers right now. Please try again in a minute — your message wasn't lost.";

const CHAT_MODEL_DISPLAY: Record<ChatModelId, string> = {
  claude: "Claude",
  gemini: "Gemini",
  openai: "ChatGPT",
};

interface BrainstormReplyResult {
  message: string;
  usedModel: ChatModelId | null;
  /** True when the picked/preferred model was unavailable and a fallback answered. */
  fallbackUsed: boolean;
  /** True when every provider failed and `message` is the friendly fallback copy. */
  allFailed: boolean;
  /** Human-readable note for the client (e.g. "Claude was unavailable, used Gemini instead."). */
  notice?: string;
}

async function brainstormReply(
  message: string,
  providers: Required<BoardsChatProviders>,
  history?: { role: "user" | "assistant"; content: string }[],
  preferred: ChatModelId = "gemini",
  images?: BrainstormChatImage[],
  systemPrompt: string = BRAINSTORM_SYSTEM_BASE,
): Promise<BrainstormReplyResult> {
  const cappedImages =
    images && images.length > 0 ? images.slice(0, MAX_BRAINSTORM_IMAGES) : undefined;
  const callers: Record<
    ChatModelId,
    () => Promise<{ success: boolean; message?: string; error?: string }>
  > = {
    claude: () => providers.anthropic.chat(message, history, systemPrompt, cappedImages),
    gemini: () => providers.gemini.chat(message, history, systemPrompt, cappedImages),
    openai: () => providers.openaiBrainstorm(message, history, cappedImages, systemPrompt),
  };
  // Try the user-picked model first, then the others in a stable order so the
  // cascade is deterministic across requests.
  const order: ChatModelId[] = [
    preferred,
    ...CHAT_MODEL_ORDER.filter((m) => m !== preferred),
  ];

  // Filter out providers we already know are dead. If that wipes the list,
  // fall through and try them anyway as a last-ditch attempt — keys can be
  // rotated mid-session and the TTL is conservative.
  const live = order.filter((id) => !isProviderDown(id));
  const tryOrder = live.length > 0 ? live : order;

  let lastError: string | undefined;
  let firstAttempted: ChatModelId | null = null;

  for (const id of tryOrder) {
    if (firstAttempted === null) firstAttempted = id;
    try {
      const r = await callers[id]();
      if (r.success && r.message) {
        const fallbackUsed = id !== preferred;
        const notice = fallbackUsed
          ? `${CHAT_MODEL_DISPLAY[preferred]} was unavailable, so I used ${CHAT_MODEL_DISPLAY[id]} for this reply.`
          : undefined;
        return { message: r.message, usedModel: id, fallbackUsed, allFailed: false, notice };
      }
      lastError = r.error || lastError;
      const verdict = classifyChatError(r.error);
      if (verdict === "permanent") {
        markProviderDown(id, r.error || "auth/key error");
        console.warn(`[boards-chat] provider '${id}' marked permanently down: ${r.error}`);
      } else {
        console.warn(`[boards-chat] provider '${id}' transient failure: ${r.error}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      lastError = errMsg;
      const verdict = classifyChatError(errMsg);
      if (verdict === "permanent") {
        markProviderDown(id, errMsg);
        console.warn(`[boards-chat] provider '${id}' threw permanent error: ${errMsg}`);
      } else {
        console.warn(`[boards-chat] provider '${id}' threw transient error: ${errMsg}`);
      }
    }
  }

  console.error(
    `[boards-chat] all chat providers unavailable (preferred=${preferred}, lastError=${lastError ?? "n/a"})`,
  );
  return {
    message: FRIENDLY_ALL_DOWN,
    usedModel: null,
    fallbackUsed: true,
    allFailed: true,
    notice: undefined,
  };
}

export interface BoardsChatDeps {
  storage?: IStorage;
  auth?: RequestHandler;
  chatProviders?: BoardsChatProviders;
  dispatchOne?: DispatchOne;
  dispatchImage?: DispatchImage;
  /** Test/extension hook: factory that produces an OpenAI client used by the
   * default openai-image image dispatch. Defaults to `new OpenAI({ apiKey: env })`. */
  openaiClientFactory?: () => OpenAI;
  /** Test/extension hook: overrides the openaiService import used by the
   * default gemini-image dispatch (editImage / generateImage). */
  geminiImageService?: GeminiImageService;
  autoEvaluateBatch?: (input: {
    prompt: string;
    assets: BoardAsset[];
    modelHint?: AutoEvalModelHint;
    extraCriteria?: string;
  }) => Promise<AutoEvalResult>;
  /**
   * Test-only hook invoked with the in-flight background-batch promise so tests
   * can await batch completion (the route otherwise fires-and-forgets).
   */
  onBatchScheduled?: (p: Promise<void>) => void;
}

export function registerBoardsChatRoutes(
  app: Express,
  deps: BoardsChatDeps = {},
) {
  const storage = deps.storage ?? defaultStorage;
  // Service singletons are lazily resolved on first use so importing this
  // module never triggers their module-level side effects (e.g. timers in
  // services/luma.ts and services/runway.ts).
  const chatProviders: Required<BoardsChatProviders> = {
    anthropic:
      deps.chatProviders?.anthropic ?? {
        async chat(message, history, systemPrompt) {
          const { anthropicService } = await import("../services/anthropic");
          return anthropicService.chat(message, history, systemPrompt);
        },
      },
    gemini:
      deps.chatProviders?.gemini ?? {
        async chat(message, history, systemPrompt) {
          const { geminiService } = await import("../services/gemini");
          return geminiService.chat(message, history, systemPrompt);
        },
      },
    openaiBrainstorm: deps.chatProviders?.openaiBrainstorm ?? tryOpenAIBrainstorm,
  };
  const dispatch = deps.dispatchOne ?? dispatchOne;
  const imageDispatchDeps: ImageDispatchDeps = {
    openaiClientFactory: deps.openaiClientFactory,
    geminiImageService: deps.geminiImageService,
  };
  const dispatchImageFn: DispatchImage =
    deps.dispatchImage ?? ((provider, ctx) => dispatchImage(provider, ctx, imageDispatchDeps));
  const autoEval =
    deps.autoEvaluateBatch ??
    (async (input) => {
      const { autoEvaluateBatch } = await import("../services/boardAutoEval");
      return autoEvaluateBatch(input);
    });
  // Allow tests to inject a permissive auth middleware. Defaults to real requireAuth.
  const requireAuth =
    deps.auth ??
    (deps.storage
      ? ((req: Request, _res: Response, next: NextFunction) => {
          if (!req.user) req.user = { id: "test-user", type: "agent", email: "test@example.com" };
          next();
        }) as RequestHandler
      : defaultRequireAuth);
  // Lightweight health snapshot the client uses to choose a default Think
  // model that is actually likely to answer. We never expose raw upstream
  // error strings to the client; just the IDs.
  app.get("/api/boards/chat/health", requireAuth, (_req: Request, res: Response) => {
    const snap = getChatProviderHealthSnapshot();
    res.json({
      healthy: snap.healthy,
      unhealthy: snap.unhealthy.map((u) => u.id),
      default: snap.default,
    });
  });

  // Stream board-generated local videos via an authenticated endpoint.
  // This makes /tmp provider outputs browser-playable while keeping access
  // scoped to users who can access the board.
  app.get(
    "/api/boards/:id/assets/:assetId/video",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = String(req.user!.id);
        const boardId = req.params.id;
        const assetId = req.params.assetId;
        const board = await storage.getAccessibleBoardForUser(boardId, userId);
        if (!board) return res.status(404).json({ error: "Board not found" });
        const asset = await storage.getBoardAssetByIdForUser(boardId, assetId, userId);
        if (!asset || asset.kind !== "video") {
          return res.status(404).json({ error: "Video asset not found" });
        }
        const localPath = asset.assetUrl ?? "";
        if (!localPath.startsWith("/tmp/")) {
          // Already a public/remote URL: redirect so the same endpoint remains
          // usable even after upstream storage behavior changes.
          return res.redirect(localPath);
        }

        const fs = await import("fs");
        if (!fs.existsSync(localPath)) {
          return res.status(404).json({ error: "Video file not found" });
        }
        const stat = fs.statSync(localPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;
          const stream = fs.createReadStream(localPath, { start, end });
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "video/mp4",
            "Cache-Control": "private, max-age=3600",
          });
          stream.pipe(res);
          return;
        }

        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        });
        fs.createReadStream(localPath).pipe(res);
      } catch (error: unknown) {
        console.error("[boards-chat] video stream error:", error);
        const message = error instanceof Error ? error.message : "Failed to stream video";
        res.status(500).json({ error: message });
      }
    },
  );

  // ---- Persisted board chat history ----
  // GET returns the full conversation in chronological order. Gated on
  // accessible-board (owner OR shared collaborator) to match GET /api/boards/:id
  // — anyone who can see the board should also see its chat history.
  app.get("/api/boards/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const boardId = req.params.id;
      const board = await storage.getAccessibleBoardForUser(boardId, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      // Hand the chat panel the joined-with-author view so the owner can see
      // exactly which collaborator contributed each turn on a shared board.
      // Non-shared boards just see the same name on every row (their own).
      const messages = await storage.getBoardMessagesWithAuthorsForUser(
        boardId,
        userId,
      );
      return res.json({ messages });
    } catch (error: unknown) {
      console.error("[boards-chat] list messages error:", error);
      const message = error instanceof Error ? error.message : "Failed to load messages";
      return res.status(500).json({ error: message });
    }
  });

  // POST is used for client-only chat turns that never hit an LLM (e.g. the
  // "Open Photo Avatars" CTA pair surfaced by the self-avatar intent
  // detector). The chat POST already persists its own turns; this is the
  // escape hatch for everything else the user sees in the chat panel.
  // CTA links surface in the chat panel as real <a href>s, so we have to
  // refuse anything that could execute on click. Allowed: in-app paths
  // ("/dashboard...", "#section") and absolute http(s) URLs only. Everything
  // else (javascript:, data:, vbscript:, file:, mailto: with payloads, etc.)
  // is rejected at the schema layer so it can never round-trip through the
  // DB and back into the DOM.
  const safeHrefSchema = z
    .string()
    .min(1)
    .max(2000)
    .refine((raw) => {
      const v = raw.trim();
      if (v.length === 0) return false;
      if (v.startsWith("/") || v.startsWith("#") || v.startsWith("?")) return true;
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "href must be a relative path or an http(s) URL");
  const ctaSchema = z.object({
    label: z.string().min(1).max(120),
    href: safeHrefSchema,
    testId: z.string().min(1).max(120).optional(),
  });
  const messageSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(20_000),
    notice: z.string().max(2000).nullable().optional(),
    cta: ctaSchema.nullable().optional(),
  });
  const messagesBatchSchema = z.union([
    messageSchema,
    z.object({ messages: z.array(messageSchema).min(1).max(8) }),
  ]);
  app.post("/api/boards/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const boardId = req.params.id;
      const board = await storage.getAccessibleBoardForUser(boardId, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const parsed = messagesBatchSchema.parse(req.body ?? {});
      const list = "messages" in parsed ? parsed.messages : [parsed];
      const created: BoardMessageCreate[] = list.map((m) => ({
        role: m.role,
        content: m.content,
        notice: m.notice ?? null,
        cta: (m.cta ?? null) as BoardMessageCta | null,
      }));
      const out: unknown[] = [];
      for (const m of created) {
        const row = await storage.createBoardMessageForUser(boardId, userId, m);
        if (row) out.push(row);
      }
      return res.json({ messages: out });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid body", issues: error.issues });
      }
      console.error("[boards-chat] create message error:", error);
      const message = error instanceof Error ? error.message : "Failed to save message";
      return res.status(500).json({ error: message });
    }
  });

  // DELETE wipes the persisted conversation. Owner-only — collaborators on a
  // shared board can read/append but should not be able to clear the owner's
  // history. The boards-chat handler also auto-trims past 200 messages on
  // every insert; this is the explicit user-initiated escape hatch.
  app.delete("/api/boards/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const boardId = req.params.id;
      const result = await storage.clearBoardMessagesForUser(boardId, userId);
      if (!result) {
        // Storage returns null both when the board doesn't exist for this
        // user AND when they're not the owner — surface the same 404 either
        // way to avoid leaking ownership info to shared collaborators.
        return res.status(404).json({ error: "Board not found" });
      }
      return res.json({ deleted: result.deleted });
    } catch (error: unknown) {
      console.error("[boards-chat] clear messages error:", error);
      const message = error instanceof Error ? error.message : "Failed to clear messages";
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/boards/:id/chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const boardId = req.params.id;
      const body = chatBodySchema.parse(req.body ?? {});

      // Anyone with access to the board (owner or shared collaborator) can
      // chat on it; the persisted history is shared too.
      const board = await storage.getAccessibleBoardForUser(boardId, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });

      // ---------- Brainstorm mode ----------
      if (body.mode === "brainstorm") {
        // Resolve any referenced board assets to image URLs so the chosen
        // vision model can actually look at them. Images use assetUrl;
        // videos use the still thumbnailUrl (vision models can't watch
        // video). Anything we can't resolve is silently dropped — we never
        // block the request on a single missing thumbnail.
        const visionImages: BrainstormChatImage[] = [];
        if (body.referencedAssetIds && body.referencedAssetIds.length > 0) {
          for (const id of body.referencedAssetIds.slice(0, MAX_BRAINSTORM_IMAGES)) {
            const a = await storage.getBoardAssetByIdForUser(boardId, id, userId);
            if (!a) continue;
            const url =
              a.kind === "image"
                ? a.assetUrl
                : a.kind === "video"
                  ? a.thumbnailUrl
                  : null;
            if (url) visionImages.push({ url });
          }
        }
        const requestedModel = body.chatModel ?? "gemini";
        // Build a text-level board context summary so the AI can reason about
        // what's placed on the board and which asset(s) the user has tagged
        // as currently selected — the vision channel only carries pixels.
        const boardAssetsForContext = await storage.getBoardAssetsForUser(boardId, userId);
        const dynamicSystemPrompt = buildBrainstormSystemPrompt(
          boardAssetsForContext,
          body.referencedAssetIds ?? [],
        );
        // Load conversation history from the DB so the AI remembers prior
        // turns even when the client doesn't send conversationHistory.
        // Cap at the last 20 messages to stay within model context limits.
        const persistedHistory = body.conversationHistory
          ?? await storage.getBoardMessagesWithAuthorsForUser(boardId, userId)
            .then((msgs) =>
              msgs
                .filter((m) => m.role === "user" || m.role === "assistant")
                .slice(-20)
                .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
            )
            .catch(() => undefined);
        const result = await brainstormReply(
          body.message,
          chatProviders,
          persistedHistory,
          requestedModel,
          visionImages.length > 0 ? visionImages : undefined,
          dynamicSystemPrompt,
        );
        // Persist both turns so the conversation survives navigation/refresh.
        // We deliberately store the raw assistant message + the notice as a
        // separate column so the client can re-render the italic prefix
        // exactly the same way on reload. Failures here are logged but never
        // bubble up — a transient DB hiccup must not break the chat reply.
        try {
          await storage.createBoardMessageForUser(boardId, userId, {
            role: "user",
            content: body.message,
            notice: null,
            cta: null,
          });
          await storage.createBoardMessageForUser(boardId, userId, {
            role: "assistant",
            content: result.message,
            notice: result.notice ?? null,
            cta: null,
          });
        } catch (persistErr) {
          console.warn(
            "[boards-chat] failed to persist brainstorm messages:",
            persistErr instanceof Error ? persistErr.message : persistErr,
          );
        }
        return res.json({
          mode: "brainstorm",
          reply: result.message,
          chatModel: result.usedModel ?? requestedModel,
          requestedModel,
          fallbackUsed: result.fallbackUsed,
          allFailed: result.allFailed,
          notice: result.notice,
          attachedImageCount: visionImages.length,
        });
      }

      // ---------- Create mode ----------
      const refAssets: BoardAsset[] = [];
      if (body.referencedAssetIds && body.referencedAssetIds.length > 0) {
        for (const id of body.referencedAssetIds) {
          const a = await storage.getBoardAssetByIdForUser(boardId, id, userId);
          if (a) refAssets.push(a);
        }
      }
      const refKinds = refAssets.map((a) => a.kind);
      const inferredGenMode = inferGenMode(refKinds, body.message);
      const selectedGenMode = body.generationMode;
      const provider: Provider = body.provider || pickDefaultProvider(inferredGenMode, body.message);
      const isImage = isImageProvider(provider);
      // Image providers don't have a meaningful generation mode; force a label-only value.
      // For video providers, prefer explicit UI selection when provided; otherwise infer.
      const genMode: GenMode = isImage
        ? "text-to-video"
        : (selectedGenMode as GenMode | undefined) ?? inferredGenMode;

      // Hard rule: v2v is disabled in this build across providers.
      if (!isImage && genMode === "video-to-video") {
        return res.status(400).json({
          error: "Video-to-video is currently disabled in this build. Please use Text-to-Video or Image-to-Video.",
          code: "v2v_disabled",
          allowedModes: ["text-to-video", "image-to-video"],
        });
      }

      if (!isImage && provider === "veo") {
        if (genMode !== "image-to-video") {
          return res.status(400).json({
            error: "Google VEO is image-to-video only in this build. Pick Image-to-Video and select an image.",
            code: "veo_image_to_video_only",
            allowedModes: ["image-to-video"],
          });
        }
        const hasImageReference = refAssets.some((a) => a.kind === "image");
        if (!hasImageReference) {
          return res.status(400).json({
            error: "Google VEO requires a selected image reference. Select an image on the board and retry.",
            code: "veo_image_required",
          });
        }
      }

      const variations = body.variations ?? (isImage ? 3 : 1);
      const batchId = randomUUID();
      const kind: "image" | "video" = isImage ? "image" : "video";
      const refImageCount = refAssets.filter((a) => a.kind === "image").length;
      const isImageEdit = isImage && refImageCount > 0;
      // For image edits we record which source asset each result was derived
      // from so the canvas can render a before/after pairing. We use the first
      // referenced image (matches what dispatchImage actually feeds to the
      // provider — see dispatchImage's `firstImage` selection).
      const editSourceAssetId = isImageEdit
        ? refAssets.find((a) => a.kind === "image")?.id ?? null
        : null;
      const batchLabel = isImage
        ? isImageEdit
          ? `Edit referenced image${refImageCount === 1 ? "" : "s"} → ${variations} variation${variations === 1 ? "" : "s"} (${provider})`
          : `Generate ${variations} image${variations === 1 ? "" : "s"} (${provider})`
        : `Generate ${variations} ${genMode.replace(/-/g, " ")} variation${variations === 1 ? "" : "s"} (${provider})`;

      const tileWidth = isImage ? 256 : 320;
      const tileHeight = isImage ? 256 : 180;
      // Resolve once: queued-row creates and every later status flip in
      // `runBatchInBackground` need to fan out to the same audience (owner
      // + every share recipient + actor) so collaborators see the new
      // tiles flip from "Generating…" → ready/failed without a refresh.
      const recipients = await resolveBoardRecipients(storage, boardId, userId);
      const rows: BoardAsset[] = [];
      for (let i = 0; i < variations; i++) {
        const payload: BoardAssetCreate = {
          batchId,
          batchLabel,
          kind,
          provider,
          status: "generating",
          modelLabel: body.forceModel ?? null,
          // Leave the position at the origin so the client lays tiles out in
          // its flex-wrap row. positionX/Y is an *additive* transform offset on
          // top of that flow layout, so any non-zero default here stacks the
          // tiles on top of each other. Offsets are only meant to be set once a
          // user deliberately drags a tile.
          positionX: 0,
          positionY: 0,
          width: tileWidth,
          height: tileHeight,
          assetUrl: null,
          thumbnailUrl: null,
          durationSeconds: null,
          rejectionReason: null,
          sourceAssetId: editSourceAssetId,
        };
        const created = await storage.createBoardAssetForUser(boardId, userId, payload);
        if (created) {
          rows.push(created);
          pushAssetStatus(recipients, boardId, created);
        }
      }

      const bgPromise = runBatchInBackground({
        storage,
        boardId,
        userId,
        batchId,
        prompt: body.message,
        provider,
        genMode,
        refAssets,
        rows,
        forceModel: body.forceModel,
        seedanceOptions: body.seedanceOptions,
        dispatch,
        dispatchImageFn,
        autoEval,
        recipients,
      }).catch((err) => console.error("[boards-chat] background batch error:", err));
      deps.onBatchScheduled?.(bgPromise);

      const createReply = isImageEdit
        ? `Editing your referenced image${refImageCount === 1 ? "" : "s"} with ${provider}. ${rows.length} variation${rows.length === 1 ? "" : "s"} are generating — I'll auto-evaluate when they're done.`
        : `Started ${batchLabel}. ${rows.length} variation${rows.length === 1 ? "" : "s"} are generating — I'll auto-evaluate when they're done.`;
      // Persist the chat turn for Build mode too — the conversation that
      // produced a batch is just as important as the batch's assets.
      try {
        await storage.createBoardMessageForUser(boardId, userId, {
          role: "user",
          content: body.message,
          notice: null,
          cta: null,
        });
        await storage.createBoardMessageForUser(boardId, userId, {
          role: "assistant",
          content: createReply,
          notice: null,
          cta: null,
        });
      } catch (persistErr) {
        console.warn(
          "[boards-chat] failed to persist create-mode messages:",
          persistErr instanceof Error ? persistErr.message : persistErr,
        );
      }
      return res.json({
        mode: "create",
        provider,
        genMode,
        batchId,
        batchLabel,
        assets: rows,
        isImageEdit,
        reply: createReply,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid body", issues: error.issues });
      }
      console.error("[boards-chat] error:", error);
      const message = error instanceof Error ? error.message : "Chat handler failed";
      res.status(500).json({ error: message });
    }
  });

  // ---- Manual winner override ----
  const overrideWinnerSchema = z.object({
    winnerAssetId: z.string().min(1),
    reasonForPriorWinner: z.string().max(280).optional(),
  });
  app.post(
    "/api/boards/:id/batches/:batchId/winner",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = String(req.user!.id);
        const boardId = req.params.id;
        const batchId = req.params.batchId;
        const body = overrideWinnerSchema.parse(req.body ?? {});

        // Shared collaborators (Task #232) can pick winners on shared
        // boards, matching the rest of the collaborative canvas UX (Tasks
        // #229/#230). Owner-only actions (delete, share management,
        // rename/delete) stay gated via getBoardByIdForUser elsewhere.
        const board = await storage.getAccessibleBoardForUser(boardId, userId);
        if (!board) return res.status(404).json({ error: "Board not found" });

        const result = await applyManualWinnerOverride({
          storage,
          boardId,
          userId,
          batchId,
          newWinnerAssetId: body.winnerAssetId,
          reasonForPriorWinner: body.reasonForPriorWinner,
          actorUserId: userId,
        });
        if (!result.applied) {
          return res.status(400).json({ error: result.reason || "Override failed" });
        }
        // Save the chosen winner to the unified media library so it appears
        // in the app-wide gallery (dashboard Media Library). Best-effort and
        // non-blocking — never fail winner selection on a gallery hiccup.
        if (result.winner) {
          await saveBoardAssetToGallery({
            storage,
            userId,
            asset: result.winner,
          });
        }
        return res.json({
          success: true,
          batchId,
          winner: result.winner,
          demoted: result.demoted ?? [],
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid body", issues: error.issues });
        }
        console.error("[boards-chat] override-winner error:", error);
        const message = error instanceof Error ? error.message : "Override failed";
        return res.status(500).json({ error: message });
      }
    },
  );

  // ---- Re-trigger auto-eval for a batch ----
  const reEvalSchema = z.object({
    modelHint: z.enum(["openai", "gemini", "heuristic"]).optional(),
    extraCriteria: z.string().max(600).optional(),
    prompt: z.string().max(4000).optional(),
  });
  app.post(
    "/api/boards/:id/batches/:batchId/re-evaluate",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = String(req.user!.id);
        const boardId = req.params.id;
        const batchId = req.params.batchId;
        const body = reEvalSchema.parse(req.body ?? {});

        // Shared collaborators (Task #232) can re-trigger evaluation on
        // shared boards, matching the rest of the collaborative canvas UX
        // (Tasks #229/#230). Owner-only actions (delete, share management,
        // rename/delete) stay gated via getBoardByIdForUser elsewhere.
        const board = await storage.getAccessibleBoardForUser(boardId, userId);
        if (!board) return res.status(404).json({ error: "Board not found" });

        // Use the explicit prompt override when provided; otherwise fall back to
        // the batch label so the evaluator still has context.
        const all = await storage.getBoardAssetsForUser(boardId, userId);
        const sample = all.find((a) => a.batchId === batchId);
        if (!sample) return res.status(404).json({ error: "Batch not found" });
        const prompt = body.prompt || sample.batchLabel || "Re-evaluate batch variations";

        const result = await runAutoEvalAndApply({
          storage,
          boardId,
          userId,
          batchId,
          prompt,
          modelHint: body.modelHint,
          extraCriteria: body.extraCriteria,
          source: "manual",
          // Use the same injected auto-eval implementation the background
          // pass uses so test stubs land here too.
          autoEvalFn: autoEval,
        });
        if (!result.applied) {
          return res.status(400).json({ error: result.reason || "Re-evaluation skipped" });
        }
        return res.json({
          success: true,
          batchId,
          winnerAssetId: result.winnerAssetId,
          modelUsed: result.modelUsed,
          rejected: result.rejected ?? [],
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid body", issues: error.issues });
        }
        console.error("[boards-chat] re-evaluate error:", error);
        const message = error instanceof Error ? error.message : "Re-evaluation failed";
        return res.status(500).json({ error: message });
      }
    },
  );
}
