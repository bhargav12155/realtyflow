import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  insertBoardSchema,
  insertBoardAssetSchema,
} from "@shared/schema";

const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isShared: z.boolean().optional(),
});

const createBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isShared: z.boolean().optional(),
  seedTemplate: z.string().optional(),
});

const createAssetSchema = insertBoardAssetSchema.omit({ boardId: true });

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

export function registerBoardsRoutes(app: Express) {
  // List all boards for the current user, with up to 4 most recent asset thumbnails per board
  app.get("/api/boards", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const boards = await storage.getBoardsByUserId(userId);

      const enriched = await Promise.all(
        boards.map(async (board) => {
          const assets = await storage.getBoardAssets(board.id);
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
  app.post("/api/boards", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const parsed = createBoardSchema.parse(req.body ?? {});
      const board = await storage.createBoard({
        userId,
        title: parsed.title || "Untitled board",
        isShared: parsed.isShared ?? false,
      });
      res.json(board);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create error:", error);
      res.status(500).json({ error: "Failed to create board" });
    }
  });

  // Get a board with all assets grouped by batchId
  app.get("/api/boards/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardById(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(404).json({ error: "Board not found" });
      }
      const assets = await storage.getBoardAssets(board.id);
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
  app.patch("/api/boards/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const updates = updateBoardSchema.parse(req.body ?? {});
      const updated = await storage.updateBoard(req.params.id, userId, updates);
      if (!updated) return res.status(404).json({ error: "Board not found" });
      res.json(updated);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update error:", error);
      res.status(500).json({ error: "Failed to update board" });
    }
  });

  // Delete board
  app.delete("/api/boards/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.deleteBoard(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Board not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[boards] delete error:", error);
      res.status(500).json({ error: "Failed to delete board" });
    }
  });

  // Add an asset to a board
  app.post("/api/boards/:id/assets", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardById(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(404).json({ error: "Board not found" });
      }
      const parsed = createAssetSchema.parse(req.body ?? {});
      const asset = await storage.createBoardAsset({
        ...parsed,
        boardId: board.id,
      });
      // Touch board updatedAt
      await storage.updateBoard(board.id, userId, {});
      res.json(asset);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create asset error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  // Update an asset (position, status, rejection reason, etc.)
  app.patch("/api/boards/:id/assets/:assetId", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardById(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(404).json({ error: "Board not found" });
      }
      const existing = await storage.getBoardAssetById(req.params.assetId);
      if (!existing || existing.boardId !== board.id) {
        return res.status(404).json({ error: "Asset not found" });
      }
      const updates = updateAssetSchema.parse(req.body ?? {});
      const updated = await storage.updateBoardAsset(existing.id, updates as any);
      res.json(updated);
    } catch (error: any) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update asset error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  // Delete an asset
  app.delete("/api/boards/:id/assets/:assetId", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardById(req.params.id);
      if (!board || board.userId !== userId) {
        return res.status(404).json({ error: "Board not found" });
      }
      const existing = await storage.getBoardAssetById(req.params.assetId);
      if (!existing || existing.boardId !== board.id) {
        return res.status(404).json({ error: "Asset not found" });
      }
      await storage.deleteBoardAsset(existing.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[boards] delete asset error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });
}
