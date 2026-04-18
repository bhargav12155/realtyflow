import type { Express } from "express";
import { z } from "zod";
import { storage as defaultStorage, type IStorage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { insertBoardAssetSchema } from "@shared/schema";

export const ASSET_KINDS = ["image", "video", "audio"] as const;
export const ASSET_PROVIDERS = [
  "luma",
  "runway",
  "sora2",
  "seedance",
  "veo",
  "kling",
  "gemini-image",
  "openai-image",
  "heygen",
] as const;

const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isShared: z.boolean().optional(),
});

const createBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isShared: z.boolean().optional(),
  // Optional seed payload (e.g. when launched from a Discover template). The
  // server doesn't persist these — they're echoed back to the client so the
  // newly opened board page can prefill the chat.
  seedPrompt: z.string().min(1).max(8000).optional(),
  seedProvider: z.enum(ASSET_PROVIDERS).optional(),
  seedGenerationMode: z.enum(["text-to-video", "image-to-video", "video-to-video"]).optional(),
  seedTemplateId: z.string().min(1).max(120).optional(),
});
export const ASSET_STATUSES = ["queued", "generating", "ready", "failed", "rejected"] as const;

const createAssetSchema = insertBoardAssetSchema
  .omit({ boardId: true })
  .extend({
    kind: z.enum(ASSET_KINDS),
    provider: z.enum(ASSET_PROVIDERS),
    status: z.enum(ASSET_STATUSES).optional(),
  });

const updateAssetSchema = z.object({
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  status: z.enum(["queued", "generating", "ready", "failed", "rejected"]).optional(),
  rejectionReason: z.string().nullable().optional(),
  assetUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  modelLabel: z.string().nullable().optional(),
  batchLabel: z.string().nullable().optional(),
});

// =====================================================
// Board chat — v2v validation gate
// =====================================================
// The full unified Brainstorm/Create handler is implemented in a separate task.
// What we ship here is the public API surface + the validation rule the UI
// (and other callers) must obey: Video → Video generation mode is only valid
// when the selected provider supports it (Luma or Runway today).

export const V2V_PROVIDERS = new Set<string>(["luma", "runway"]);
export const BOARD_CHAT_GENERATION_MODES = [
  "text-to-video",
  "image-to-video",
  "video-to-video",
] as const;
export type BoardChatGenerationMode = (typeof BOARD_CHAT_GENERATION_MODES)[number];

export const boardChatPayloadSchema = z.object({
  message: z.string().min(1).max(8000),
  mode: z.enum(["brainstorm", "create"]).default("create"),
  provider: z.enum(ASSET_PROVIDERS),
  generationMode: z.enum(BOARD_CHAT_GENERATION_MODES).optional(),
  referencedAssetIds: z.array(z.string()).optional().default([]),
});

export type BoardChatPayload = z.infer<typeof boardChatPayloadSchema>;

export class BoardChatValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "BoardChatValidationError";
  }
}

export function assertProviderSupportsGenerationMode(
  provider: string,
  generationMode?: BoardChatGenerationMode,
): void {
  if (generationMode === "video-to-video" && !V2V_PROVIDERS.has(provider)) {
    throw new BoardChatValidationError(
      `Video → video is only available on Luma or Runway, not ${provider}.`,
    );
  }
}

export function registerBoardsRoutes(
  app: Express,
  deps: { storage?: IStorage; auth?: any } = {},
) {
  const storage = deps.storage ?? defaultStorage;
  // Allow tests to inject a permissive auth middleware. Defaults to real requireAuth.
  const auth =
    deps.auth ??
    (deps.storage
      ? (req: any, _res: any, next: any) => {
          if (!req.user) req.user = { id: "test-user", type: "agent", email: "test@example.com" };
          next();
        }
      : requireAuth);

  // List all boards for the current user, with up to 4 most recent asset thumbnails per board
  app.get("/api/boards", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const boards = await storage.getBoardsByUserId(userId);

      const enriched = await Promise.all(
        boards.map(async (board) => {
          const assets = await storage.getBoardAssetsForUser(board.id, userId);
          const thumbnails = assets
            .filter((a) => a.thumbnailUrl || a.assetUrl)
            .slice(0, 4)
            .map((a) => ({
              id: a.id,
              thumbnailUrl: a.thumbnailUrl || a.assetUrl,
              kind: a.kind,
            }));
          return {
            ...board,
            assetCount: assets.length,
            thumbnails,
          };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      console.error("[boards] list error:", error);
      res.status(500).json({ error: "Failed to list boards" });
    }
  });

  // Create a new board
  app.post("/api/boards", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const parsed = createBoardSchema.parse(req.body ?? {});
      const board = await storage.createBoard({
        userId,
        title: parsed.title || parsed.seedPrompt?.slice(0, 80) || "Untitled board",
        isShared: parsed.isShared ?? false,
      });
      res.json({
        ...board,
        seed: parsed.seedPrompt
          ? {
              prompt: parsed.seedPrompt,
              provider: parsed.seedProvider ?? null,
              generationMode: parsed.seedGenerationMode ?? null,
              templateId: parsed.seedTemplateId ?? null,
            }
          : null,
      });
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create error:", error);
      res.status(500).json({ error: "Failed to create board" });
    }
  });

  // Get a board with all assets grouped by batchId
  app.get("/api/boards/:id", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardByIdForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const assets = await storage.getBoardAssetsForUser(board.id, userId);
      const batchMap = new Map<string, { batchId: string; batchLabel: string | null; assets: typeof assets }>();
      for (const a of assets) {
        const entry = batchMap.get(a.batchId) ?? {
          batchId: a.batchId,
          batchLabel: a.batchLabel,
          assets: [],
        };
        entry.assets.push(a);
        batchMap.set(a.batchId, entry);
      }
      res.json({
        ...board,
        batches: Array.from(batchMap.values()),
        assets,
      });
    } catch (error: any) {
      console.error("[boards] get error:", error);
      res.status(500).json({ error: "Failed to get board" });
    }
  });

  // Update board (rename, share)
  app.patch("/api/boards/:id", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const updates = updateBoardSchema.parse(req.body ?? {});
      const updated = await storage.updateBoardForUser(req.params.id, userId, updates);
      if (!updated) return res.status(404).json({ error: "Board not found" });
      res.json(updated);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update error:", error);
      res.status(500).json({ error: "Failed to update board" });
    }
  });

  // Delete board
  app.delete("/api/boards/:id", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.deleteBoardForUser(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Board not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[boards] delete error:", error);
      res.status(500).json({ error: "Failed to delete board" });
    }
  });

  // Add an asset to a board
  app.post("/api/boards/:id/assets", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const parsed = createAssetSchema.parse(req.body ?? {});
      const asset = await storage.createBoardAssetForUser(req.params.id, userId, parsed);
      if (!asset) return res.status(404).json({ error: "Board not found" });
      res.json(asset);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create asset error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  // Update an asset (position, status, rejection reason, etc.)
  app.patch("/api/boards/:id/assets/:assetId", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const updates = updateAssetSchema.parse(req.body ?? {});
      const updated = await storage.updateBoardAssetForUser(
        req.params.id,
        req.params.assetId,
        userId,
        updates,
      );
      if (!updated) return res.status(404).json({ error: "Asset not found" });
      res.json(updated);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update asset error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  // Delete an asset
  app.delete("/api/boards/:id/assets/:assetId", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.deleteBoardAssetForUser(req.params.id, req.params.assetId, userId);
      if (!ok) return res.status(404).json({ error: "Asset not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[boards] delete asset error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // Board chat — accepts a user message and returns an acknowledgement.
  // The full Brainstorm/Create handler with auto-eval is wired up in a
  // companion task; this endpoint enforces the validation rules the UI
  // depends on today (provider/v2v gate, board ownership, payload shape)
  // and emits a stub assistant reply so the panel can be exercised end-to-end.
  app.post("/api/boards/:id/chat", auth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardByIdForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });

      const payload = boardChatPayloadSchema.parse(req.body ?? {});
      assertProviderSupportsGenerationMode(payload.provider, payload.generationMode);

      // Acknowledgement reply (full agent runs in the unified handler task).
      res.json({
        boardId: board.id,
        accepted: true,
        mode: payload.mode,
        provider: payload.provider,
        generationMode: payload.generationMode ?? null,
        referencedAssetIds: payload.referencedAssetIds,
        reply: {
          role: "assistant",
          content:
            payload.mode === "brainstorm"
              ? "Got it — I'll plan only and won't execute anything until you switch to Create."
              : "Queued. I'll generate a batch and drop it on the canvas as it finishes.",
        },
      });
    } catch (error: any) {
      if (error instanceof BoardChatValidationError) {
        return res.status(error.status).json({ error: error.message });
      }
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] chat error:", error);
      res.status(500).json({ error: "Failed to handle chat" });
    }
  });
}
