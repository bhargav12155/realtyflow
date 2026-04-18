import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { storage as defaultStorage, type IStorage } from "../storage";
import { requireAuth as defaultRequireAuth } from "../middleware/auth";
import type { BoardAsset } from "@shared/schema";
import type { BoardAssetCreate } from "../storage";
import OpenAI from "openai";
import { anthropicService } from "../services/anthropic";
import { geminiService } from "../services/gemini";
import { lumaService, type LumaModel } from "../services/luma";
import { runwayService } from "../services/runway";
import { sora2Service } from "../services/sora2";
import { veoVideoService } from "../services/veo-video";
import { generateMotionVideo, checkMotionVideoStatus } from "../services/kling";
import { autoEvaluateBatch } from "../services/boardAutoEval";

const PROVIDERS = ["luma", "runway", "sora2", "veo", "kling"] as const;
type Provider = (typeof PROVIDERS)[number];
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
  if (lower.includes("sora")) return "sora2";
  if (lower.includes("runway")) return "runway";
  return "luma";
}

interface DispatchContext {
  prompt: string;
  refAssets: BoardAsset[];
  forceModel?: string;
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

async function dispatchOne(provider: Provider, genMode: GenMode, ctx: DispatchContext): Promise<DispatchResult> {
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
}) {
  const { storage, boardId, userId, batchId, prompt, provider, genMode, refAssets, rows, forceModel } = args;

  await Promise.all(
    rows.map(async (row) => {
      try {
        const dispatch = await dispatchOne(provider, genMode, { prompt, refAssets, forceModel });
        await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          modelLabel: dispatch.modelLabel,
        });
        const result = await pollUntilDone(dispatch.poll);
        if (result.error || !result.videoUrl) {
          await storage.updateBoardAssetForUser(boardId, row.id, userId, {
            status: "failed",
            rejectionReason: result.error || "No output URL returned",
          });
          return;
        }
        await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          status: "ready",
          assetUrl: result.videoUrl,
          thumbnailUrl: result.videoUrl,
          durationSeconds: result.durationSeconds ?? null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        console.error(`[boards-chat] generation failed for asset ${row.id}:`, msg);
        await storage.updateBoardAssetForUser(boardId, row.id, userId, {
          status: "failed",
          rejectionReason: msg,
        });
      }
    }),
  );

  try {
    const all = await storage.getBoardAssetsForUser(boardId, userId);
    const batchAssets = all.filter((a) => a.batchId === batchId);
    const ready = batchAssets.filter((a) => a.status === "ready");
    if (ready.length >= 2) {
      const evalResult = await autoEvaluateBatch({ prompt, assets: ready });
      console.log(`[boards-chat] auto-eval winner=${evalResult.winnerAssetId} model=${evalResult.modelUsed}`);
      await Promise.all(
        evalResult.rejected.map((r) =>
          storage.updateBoardAssetForUser(boardId, r.assetId, userId, {
            status: "rejected",
            rejectionReason: r.reason,
          }),
        ),
      );
    }
  } catch (err) {
    console.error("[boards-chat] auto-eval pass failed:", err instanceof Error ? err.message : err);
  }
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
      const genMode = inferGenMode(refKinds, body.message);
      const provider: Provider = body.provider || pickDefaultProvider(genMode, body.message);

      // Hard rule: v2v only on luma or runway. The Luma integration cannot yet consume
      // a referenced video as input, so we additionally block Luma at the preflight to
      // avoid kicking off a batch that would all asynchronously fail. Runway is the
      // working v2v default until Luma v2v is wired.
      if (genMode === "video-to-video") {
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

      const variations = body.variations ?? 3;
      const batchId = randomUUID();
      const batchLabel = `Generate ${variations} ${genMode.replace(/-/g, " ")} variation${variations === 1 ? "" : "s"} (${provider})`;

      const rows: BoardAsset[] = [];
      for (let i = 0; i < variations; i++) {
        const payload: BoardAssetCreate = {
          batchId,
          batchLabel,
          kind: "video",
          provider,
          status: "generating",
          modelLabel: body.forceModel ?? null,
          positionX: 40 + i * 340,
          positionY: 40,
          width: 320,
          height: 180,
          assetUrl: null,
          thumbnailUrl: null,
          durationSeconds: null,
          rejectionReason: null,
        };
        const created = await storage.createBoardAssetForUser(boardId, userId, payload);
        if (created) rows.push(created);
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
}
