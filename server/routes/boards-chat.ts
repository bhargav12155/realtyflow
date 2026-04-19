import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage as defaultStorage, type IStorage } from "../storage";
import { requireAuth as defaultRequireAuth } from "../middleware/auth";
import type { BoardAsset, BoardAssetEvalHistoryEntry } from "@shared/schema";
import type { BoardAssetCreate } from "../storage";
import OpenAI from "openai";
import { anthropicService } from "../services/anthropic";
import { geminiService } from "../services/gemini";
import { lumaService, type LumaModel } from "../services/luma";
import { runwayService } from "../services/runway";
import { sora2Service } from "../services/sora2";
import { veoVideoService } from "../services/veo-video";
import { generateMotionVideo, checkMotionVideoStatus } from "../services/kling";
import {
  seedanceService,
  type SeedanceModel,
  type SeedanceAspectRatio,
  type SeedanceDuration,
} from "../services/seedance";
import { autoEvaluateBatch, type AutoEvalModelHint } from "../services/boardAutoEval";
import { openaiService } from "../services/openai";
import { persistImageBuffer } from "../objectStorage";
import { realtimeService } from "../websocket";

const VIDEO_PROVIDERS = ["luma", "runway", "sora2", "seedance", "veo", "kling"] as const;
const IMAGE_PROVIDERS = ["openai-image", "gemini-image"] as const;
const PROVIDERS = [...VIDEO_PROVIDERS, ...IMAGE_PROVIDERS] as const;
type VideoProvider = (typeof VIDEO_PROVIDERS)[number];
type ImageProvider = (typeof IMAGE_PROVIDERS)[number];
type Provider = (typeof PROVIDERS)[number];

function isImageProvider(p: Provider): p is ImageProvider {
  return (IMAGE_PROVIDERS as readonly string[]).includes(p);
}

function pushAssetStatus(
  userId: string,
  boardId: string,
  asset: BoardAsset,
  extra?: Record<string, unknown>,
) {
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
type GenMode = "text-to-video" | "image-to-video" | "video-to-video";
type PollStatus = "pending" | "processing" | "completed" | "failed";

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
  forceModel: z.string().optional(),
  variations: z.number().int().min(1).max(4).optional(),
  seedanceOptions: seedanceOptionsSchema.optional(),
  conversationHistory: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

const BRAINSTORM_SYSTEM = `You are a creative director assisting on a visual board.
Help the user brainstorm, refine prompts, and plan generations.
Be concise (under 200 words) and propose a concrete next prompt the user could send in "create" mode when appropriate.`;

function inferGenMode(refKinds: string[], message: string): GenMode {
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

function pickDefaultProvider(genMode: GenMode, message: string): Provider {
  const lower = message.toLowerCase();
  if (genMode === "video-to-video") {
    // Runway is the only provider with a working v2v integration today; Luma v2v is
    // not yet wired (see preflight rule). Default to Runway and only honour an
    // explicit Luma mention so the request is rejected with a clear, actionable error.
    if (lower.includes("luma")) return "luma";
    return "runway";
  }
  if (genMode === "image-to-video") {
    if (lower.includes("kling")) return "kling";
    if (lower.includes("veo")) return "veo";
    if (lower.includes("runway")) return "runway";
    return "luma";
  }
  if (lower.includes("seedance")) return "seedance";
  if (lower.includes("sora")) return "sora2";
  if (lower.includes("runway")) return "runway";
  return "luma";
}

interface DispatchContext {
  prompt: string;
  refAssets: BoardAsset[];
  forceModel?: string;
  seedanceOptions?: {
    model?: SeedanceModel;
    aspectRatio?: SeedanceAspectRatio;
    durationSeconds?: SeedanceDuration;
  };
}

interface PollResult {
  status: PollStatus;
  videoUrl?: string;
  durationSeconds?: number;
  error?: string;
}

interface DispatchResult {
  taskId: string;
  modelLabel: string;
  poll: () => Promise<PollResult>;
}

async function dispatchOne(provider: VideoProvider, genMode: GenMode, ctx: DispatchContext): Promise<DispatchResult> {
  const firstImage = ctx.refAssets.find((a) => a.kind === "image")?.assetUrl || undefined;
  const firstVideo = ctx.refAssets.find((a) => a.kind === "video")?.assetUrl || undefined;

  switch (provider) {
    case "luma": {
      // Note: v2v on Luma is blocked at preflight in the chat route because the current
      // /generations integration cannot consume a referenced video as input.
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
      const model = ctx.forceModel || "gen4_aleph";
      let taskId: string;
      if (genMode === "video-to-video") {
        if (!firstVideo) throw new Error("Runway video-to-video requires a referenced video asset");
        const t = await runwayService.createVideoToVideoTask(firstVideo, ctx.prompt, { referenceImageUrl: firstImage });
        taskId = t.taskId;
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
}

async function dispatchImage(
  provider: ImageProvider,
  ctx: DispatchContext,
): Promise<ImageDispatchResult> {
  if (provider === "gemini-image") {
    // openaiService.generateImage is implemented on top of Gemini's
    // gemini-2.5-flash-image model and persists to object storage when available.
    const url = await openaiService.generateImage({ prompt: ctx.prompt });
    if (!url) throw new Error("Gemini image generation returned no result");
    return { modelLabel: ctx.forceModel || "gemini-2.5-flash-image", imageUrl: url };
  }
  // openai-image
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const client = new OpenAI({ apiKey });
  const model = ctx.forceModel || "gpt-image-1";
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
    const stored = await persistImageBuffer(buf, filename, "image/png");
    imageUrl = stored ?? `data:image/png;base64,${item.b64_json}`;
  } else if (item.url) {
    imageUrl = item.url;
  }
  if (!imageUrl) throw new Error("OpenAI image generation returned no usable URL");
  return { modelLabel: model, imageUrl };
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
}) {
  const { storage, boardId, userId, batchId, prompt, provider, genMode, refAssets, rows, forceModel, seedanceOptions } = args;

  await Promise.all(
    rows.map(async (row) => {
      try {
        if (isImageProvider(provider)) {
          const result = await dispatchImage(provider, { prompt, refAssets, forceModel });
          const updated = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
            status: "ready",
            modelLabel: result.modelLabel,
            assetUrl: result.imageUrl,
            thumbnailUrl: result.imageUrl,
          });
          if (updated) pushAssetStatus(userId, boardId, updated);
          return;
        }
        const videoProvider = provider as VideoProvider;
        const dispatch = await dispatchOne(videoProvider, genMode, { prompt, refAssets, forceModel, seedanceOptions });
        const labelled = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          modelLabel: dispatch.modelLabel,
        });
        if (labelled) pushAssetStatus(userId, boardId, labelled);
        const result = await pollUntilDone(dispatch.poll);
        if (result.error || !result.videoUrl) {
          const failed = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
            status: "failed",
            rejectionReason: result.error || "No output URL returned",
          });
          if (failed) pushAssetStatus(userId, boardId, failed);
          return;
        }
        const ready = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          status: "ready",
          assetUrl: result.videoUrl,
          thumbnailUrl: result.videoUrl,
          durationSeconds: result.durationSeconds ?? null,
        });
        if (ready) pushAssetStatus(userId, boardId, ready);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        console.error(`[boards-chat] generation failed for asset ${row.id}:`, msg);
        const failed = await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          status: "failed",
          rejectionReason: msg,
        });
        if (failed) pushAssetStatus(userId, boardId, failed);
      }
    }),
  );

  try {
    await runAutoEvalAndApply({ storage, boardId, userId, batchId, prompt });
  } catch (err) {
    console.error("[boards-chat] auto-eval pass failed:", err instanceof Error ? err.message : err);
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
}): Promise<{
  applied: boolean;
  winnerAssetId?: string;
  modelUsed?: string;
  rejected?: Array<{ assetId: string; reason: string }>;
  reason?: string;
}> {
  const { storage, boardId, userId, batchId, prompt, modelHint, extraCriteria } = args;
  const source = args.source ?? "auto";
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
  const evalResult = await autoEvaluateBatch({
    prompt,
    assets: candidates,
    modelHint,
    extraCriteria,
  });
  console.log(
    `[boards-chat] ${source}-eval winner=${evalResult.winnerAssetId} model=${evalResult.modelUsed}`,
  );
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
    if (updated) pushAssetStatus(userId, boardId, updated, { autoEval: true });
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
      if (updated) pushAssetStatus(userId, boardId, updated, { autoEval: true });
    }),
  );
  return {
    applied: true,
    winnerAssetId: evalResult.winnerAssetId,
    modelUsed: evalResult.modelUsed,
    rejected: evalResult.rejected,
  };
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
      pushAssetStatus(userId, boardId, updated);
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
  if (promoted) pushAssetStatus(userId, boardId, promoted);
  return { applied: true, winner: promoted ?? target, demoted };
}

async function tryOpenAIBrainstorm(
  message: string,
  history?: { role: "user" | "assistant"; content: string }[],
): Promise<{ success: boolean; message?: string; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { success: false, error: "OPENAI_API_KEY not configured" };
  try {
    const client = new OpenAI({ apiKey });
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: BRAINSTORM_SYSTEM },
    ];
    for (const h of history || []) messages.push({ role: h.role, content: h.content });
    messages.push({ role: "user", content: message });
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
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

async function brainstormReply(
  message: string,
  history?: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const a = await anthropicService.chat(message, history, BRAINSTORM_SYSTEM);
  if (a.success && a.message) return a.message;
  const g = await geminiService.chat(message, history, BRAINSTORM_SYSTEM);
  if (g.success && g.message) return g.message;
  const o = await tryOpenAIBrainstorm(message, history);
  if (o.success && o.message) return o.message;
  throw new Error(a.error || g.error || o.error || "All chat providers unavailable");
}

export function registerBoardsChatRoutes(
  app: Express,
  deps: { storage?: IStorage; auth?: RequestHandler } = {},
) {
  const storage = deps.storage ?? defaultStorage;
  // Allow tests to inject a permissive auth middleware. Defaults to real requireAuth.
  const requireAuth =
    deps.auth ??
    (deps.storage
      ? ((req: Request, _res: Response, next: NextFunction) => {
          if (!req.user) req.user = { id: "test-user", type: "agent", email: "test@example.com" };
          next();
        }) as RequestHandler
      : defaultRequireAuth);
  app.post("/api/boards/:id/chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const boardId = req.params.id;
      const body = chatBodySchema.parse(req.body ?? {});

      const board = await storage.getBoardByIdForUser(boardId, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });

      // ---------- Brainstorm mode ----------
      if (body.mode === "brainstorm") {
        const reply = await brainstormReply(body.message, body.conversationHistory);
        return res.json({ mode: "brainstorm", reply });
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
      const provider: Provider = body.provider || pickDefaultProvider(inferredGenMode, body.message);
      const isImage = isImageProvider(provider);
      // Image providers don't have a meaningful generation mode; force a label-only value.
      const genMode: GenMode = isImage ? "text-to-video" : inferredGenMode;

      // Hard rule: v2v only on luma or runway. The Luma integration cannot yet consume
      // a referenced video as input, so we additionally block Luma at the preflight to
      // avoid kicking off a batch that would all asynchronously fail. Runway is the
      // working v2v default until Luma v2v is wired.
      if (!isImage && genMode === "video-to-video") {
        if (provider !== "luma" && provider !== "runway") {
          return res.status(400).json({
            error: "Video-to-video is only supported on Luma or Runway. Please pick one of those providers.",
            code: "v2v_provider_unsupported",
            allowedProviders: ["luma", "runway"],
          });
        }
        if (provider === "luma") {
          return res.status(400).json({
            error: "Luma video-to-video is not yet wired into this build. Please retry with provider=runway.",
            code: "v2v_luma_unavailable",
            suggestedProvider: "runway",
          });
        }
      }

      const variations = body.variations ?? (isImage ? 2 : 3);
      const batchId = randomUUID();
      const kind: "image" | "video" = isImage ? "image" : "video";
      const batchLabel = isImage
        ? `Generate ${variations} image${variations === 1 ? "" : "s"} (${provider})`
        : `Generate ${variations} ${genMode.replace(/-/g, " ")} variation${variations === 1 ? "" : "s"} (${provider})`;

      const tileWidth = isImage ? 256 : 320;
      const tileHeight = isImage ? 256 : 180;
      const rows: BoardAsset[] = [];
      for (let i = 0; i < variations; i++) {
        const payload: BoardAssetCreate = {
          batchId,
          batchLabel,
          kind,
          provider,
          status: "generating",
          modelLabel: body.forceModel ?? null,
          positionX: 40 + i * (tileWidth + 20),
          positionY: 40,
          width: tileWidth,
          height: tileHeight,
          assetUrl: null,
          thumbnailUrl: null,
          durationSeconds: null,
          rejectionReason: null,
        };
        const created = await storage.createBoardAssetForUser(boardId, userId, payload);
        if (created) {
          rows.push(created);
          pushAssetStatus(userId, boardId, created);
        }
      }

      runBatchInBackground({
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
      }).catch((err) => console.error("[boards-chat] background batch error:", err));

      return res.json({
        mode: "create",
        provider,
        genMode,
        batchId,
        batchLabel,
        assets: rows,
        reply: `Started ${batchLabel}. ${rows.length} variation${rows.length === 1 ? "" : "s"} are generating — I'll auto-evaluate when they're done.`,
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

        const board = await storage.getBoardByIdForUser(boardId, userId);
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

        const board = await storage.getBoardByIdForUser(boardId, userId);
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
