import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
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

export const BOARD_INTENTS = [
  "social-post",
  "blog-article",
  "image",
  "video",
] as const;
export type BoardIntent = (typeof BOARD_INTENTS)[number];

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
  seedIntent: z.enum(BOARD_INTENTS).optional(),
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
  deps: { storage?: IStorage; auth?: RequestHandler } = {},
) {
  const storage = deps.storage ?? defaultStorage;
  // Allow tests to inject a permissive auth middleware. Defaults to real requireAuth.
  const auth =
    deps.auth ??
    (deps.storage
      ? (req: Request, _res: Response, next: NextFunction) => {
          if (!req.user) req.user = { id: "test-user", type: "agent", email: "test@example.com" };
          next();
        }
      : requireAuth);

  // List all boards the current user owns OR has been shared with. Each board
  // carries an `isOwner` flag so the home tabs ("All", "Shared", "Mine") can
  // filter without another round trip.
  app.get("/api/boards", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const boards = await storage.getAccessibleBoardsForUser(userId);

      const enriched = await Promise.all(
        boards.map(async (board) => {
          // Owner-scoped read so shared assets travel with the board view.
          const ownerId = board.isOwner ? userId : board.userId;
          const assets = await storage.getBoardAssetsForUser(board.id, ownerId);
          const thumbnails = assets
            .filter((a) => a.thumbnailUrl || a.assetUrl)
            .slice(0, 4)
            .map((a) => ({
              id: a.id,
              thumbnailUrl: a.thumbnailUrl || a.assetUrl,
              kind: a.kind,
            }));

          // Collaborator summary so the board card can render an avatar
          // stack without an extra round trip. Owners see who they've shared
          // with; recipients see who owns the board.
          let collaborators: { userId: string; name: string | null; email: string | null }[] = [];
          let owner: { id: string; name: string | null; email: string | null } | null = null;
          if (board.isOwner) {
            const shares = await storage.getBoardShares(board.id, userId);
            collaborators = shares.map((s) => ({
              userId: s.userId,
              name: s.name,
              email: s.email,
            }));
          } else {
            const ownerUser = await storage.getUser(board.userId);
            if (ownerUser) {
              owner = {
                id: ownerUser.id,
                name: ownerUser.name ?? null,
                email: ownerUser.email ?? null,
              };
            } else {
              owner = { id: board.userId, name: null, email: null };
            }
          }

          return {
            ...board,
            assetCount: assets.length,
            thumbnails,
            collaborators,
            owner,
          };
        })
      );

      res.json(enriched);
    } catch (error: unknown) {
      console.error("[boards] list error:", error);
      res.status(500).json({ error: "Failed to list boards" });
    }
  });

  // List candidate users to share a board with (everyone except the current
  // user). The dialog renders this so the owner can pick recipients.
  app.get("/api/boards/share-candidates", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const all = await storage.getAllUsers();
      const candidates = all
        .filter((u) => u.id !== userId)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, username: u.username }));
      res.json(candidates);
    } catch (error: unknown) {
      console.error("[boards] share candidates error:", error);
      res.status(500).json({ error: "Failed to list share candidates" });
    }
  });

  // Create a new board
  app.post("/api/boards", auth, async (req: Request, res: Response) => {
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
        seed: parsed.seedPrompt || parsed.seedIntent
          ? {
              prompt: parsed.seedPrompt ?? null,
              provider: parsed.seedProvider ?? null,
              generationMode: parsed.seedGenerationMode ?? null,
              templateId: parsed.seedTemplateId ?? null,
              intent: parsed.seedIntent ?? null,
            }
          : null,
      });
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create error:", error);
      res.status(500).json({ error: "Failed to create board" });
    }
  });

  // Get a board with all assets grouped by batchId. Accessible to the owner
  // and any user the board has been shared with. Assets are read with the
  // owner's userId so shared viewers see the same canvas.
  app.get("/api/boards/:id", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getAccessibleBoardForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const assets = await storage.getBoardAssetsForUser(board.id, board.userId);
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
    } catch (error: unknown) {
      console.error("[boards] get error:", error);
      res.status(500).json({ error: "Failed to get board" });
    }
  });

  // List who a board is shared with (owner only).
  app.get("/api/boards/:id/shares", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardByIdForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const shares = await storage.getBoardShares(board.id, userId);
      res.json(shares);
    } catch (error: unknown) {
      console.error("[boards] list shares error:", error);
      res.status(500).json({ error: "Failed to list shares" });
    }
  });

  // Share a board with another user (owner only). Idempotent.
  app.post("/api/boards/:id/shares", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const parsed = z.object({ userId: z.string().min(1) }).parse(req.body ?? {});
      if (parsed.userId === userId) {
        return res.status(400).json({ error: "Cannot share a board with yourself" });
      }
      const share = await storage.shareBoard(req.params.id, userId, parsed.userId);
      if (!share) return res.status(404).json({ error: "Board not found" });
      res.json(share);
    } catch (error: unknown) {
      if ((error as { issues?: unknown })?.issues) {
        return res.status(400).json({ error: "Invalid body", issues: (error as { issues: unknown }).issues });
      }
      console.error("[boards] share error:", error);
      res.status(500).json({ error: "Failed to share board" });
    }
  });

  // Recipient-initiated leave: a non-owner removes themselves from a shared board.
  // Returns 404 when the user has no share row (e.g. not a recipient, or the
  // owner calling this endpoint — owners should delete the board instead).
  app.delete("/api/boards/:id/share/me", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.leaveSharedBoard(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Not a shared recipient of this board" });
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] leave share error:", error);
      res.status(500).json({ error: "Failed to leave board" });
    }
  });

  // Remove a share (owner only).
  app.delete("/api/boards/:id/shares/:userId", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.unshareBoard(req.params.id, userId, req.params.userId);
      if (!ok) return res.status(404).json({ error: "Share not found" });
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] unshare error:", error);
      res.status(500).json({ error: "Failed to remove share" });
    }
  });

  // Update board (rename, share)
  app.patch("/api/boards/:id", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const updates = updateBoardSchema.parse(req.body ?? {});
      const updated = await storage.updateBoardForUser(req.params.id, userId, updates);
      if (!updated) return res.status(404).json({ error: "Board not found" });
      res.json(updated);
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update error:", error);
      res.status(500).json({ error: "Failed to update board" });
    }
  });

  // Delete board
  app.delete("/api/boards/:id", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.deleteBoardForUser(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Board not found" });
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] delete error:", error);
      res.status(500).json({ error: "Failed to delete board" });
    }
  });

  // Add an asset to a board
  app.post("/api/boards/:id/assets", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const parsed = createAssetSchema.parse(req.body ?? {});
      const asset = await storage.createBoardAssetForUser(req.params.id, userId, parsed);
      if (!asset) return res.status(404).json({ error: "Board not found" });
      res.json(asset);
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create asset error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  // Update an asset (position, status, rejection reason, etc.)
  app.patch("/api/boards/:id/assets/:assetId", auth, async (req: Request, res: Response) => {
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
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update asset error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  // Delete an asset
  app.delete("/api/boards/:id/assets/:assetId", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.deleteBoardAssetForUser(req.params.id, req.params.assetId, userId);
      if (!ok) return res.status(404).json({ error: "Asset not found" });
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] delete asset error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // NOTE: POST /api/boards/:id/chat is registered in `routes/boards-chat.ts`
  // (the full Brainstorm/Create handler with auto-eval). The chat schema and
  // validation helpers above are exported so that handler — and tests — can
  // share them.
}
