import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import {
  registerBoardsRoutes,
  assertProviderSupportsGenerationMode,
  BoardChatValidationError,
  V2V_PROVIDERS,
} from "../server/routes/boards";
import { registerBoardsChatRoutes } from "../server/routes/boards-chat";
import type { Board, BoardAsset, InsertBoard } from "@shared/schema";
import type {
  IStorage,
  BoardUpdate,
  BoardAssetCreate,
  BoardAssetUpdate,
} from "../server/storage";

// =====================================================
// In-memory storage stub (only the board surface used by routes)
// =====================================================
class FakeBoardsStorage {
  private boards = new Map<string, Board>();
  private assets = new Map<string, BoardAsset>();
  private idCounter = 0;
  private nextId(prefix: string) {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }

  async getBoardsByUserId(userId: string): Promise<Board[]> {
    return Array.from(this.boards.values())
      .filter((b) => b.userId === userId)
      .sort((a, b) => (b.updatedAt!.getTime() - a.updatedAt!.getTime()));
  }
  async getBoardByIdForUser(id: string, userId: string): Promise<Board | undefined> {
    const b = this.boards.get(id);
    return b && b.userId === userId ? b : undefined;
  }
  async createBoard(board: InsertBoard): Promise<Board> {
    const now = new Date();
    const created: Board = {
      id: this.nextId("brd"),
      userId: board.userId,
      title: board.title ?? "Untitled board",
      isShared: board.isShared ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.boards.set(created.id, created);
    return created;
  }
  async updateBoardForUser(id: string, userId: string, updates: BoardUpdate): Promise<Board | undefined> {
    const b = await this.getBoardByIdForUser(id, userId);
    if (!b) return undefined;
    const updated: Board = { ...b, ...updates, updatedAt: new Date() };
    this.boards.set(id, updated);
    return updated;
  }
  async touchBoardForUser(id: string, userId: string): Promise<void> {
    const b = await this.getBoardByIdForUser(id, userId);
    if (b) this.boards.set(id, { ...b, updatedAt: new Date() });
  }
  async deleteBoardForUser(id: string, userId: string): Promise<boolean> {
    const b = await this.getBoardByIdForUser(id, userId);
    if (!b) return false;
    this.boards.delete(id);
    for (const [aid, a] of this.assets) if (a.boardId === id) this.assets.delete(aid);
    return true;
  }
  async getBoardAssetsForUser(boardId: string, userId: string): Promise<BoardAsset[]> {
    const b = await this.getBoardByIdForUser(boardId, userId);
    if (!b) return [];
    return Array.from(this.assets.values())
      .filter((a) => a.boardId === boardId)
      .sort((a, b2) => b2.createdAt!.getTime() - a.createdAt!.getTime());
  }
  async getBoardAssetByIdForUser(boardId: string, assetId: string, userId: string): Promise<BoardAsset | undefined> {
    const b = await this.getBoardByIdForUser(boardId, userId);
    if (!b) return undefined;
    const a = this.assets.get(assetId);
    return a && a.boardId === boardId ? a : undefined;
  }
  async createBoardAssetForUser(boardId: string, userId: string, asset: BoardAssetCreate): Promise<BoardAsset | undefined> {
    const b = await this.getBoardByIdForUser(boardId, userId);
    if (!b) return undefined;
    const created: BoardAsset = {
      id: this.nextId("ast"),
      boardId,
      batchId: asset.batchId,
      batchLabel: asset.batchLabel ?? null,
      kind: asset.kind,
      assetUrl: asset.assetUrl ?? null,
      thumbnailUrl: asset.thumbnailUrl ?? null,
      durationSeconds: asset.durationSeconds ?? null,
      provider: asset.provider,
      modelLabel: asset.modelLabel ?? null,
      positionX: asset.positionX ?? 0,
      positionY: asset.positionY ?? 0,
      width: asset.width ?? 320,
      height: asset.height ?? 180,
      status: asset.status ?? "queued",
      rejectionReason: asset.rejectionReason ?? null,
      createdAt: new Date(),
    };
    this.assets.set(created.id, created);
    return created;
  }
  async updateBoardAssetForUser(boardId: string, assetId: string, userId: string, updates: BoardAssetUpdate): Promise<BoardAsset | undefined> {
    const a = await this.getBoardAssetByIdForUser(boardId, assetId, userId);
    if (!a) return undefined;
    const updated: BoardAsset = { ...a, ...updates };
    this.assets.set(assetId, updated);
    return updated;
  }
  async deleteBoardAssetForUser(boardId: string, assetId: string, userId: string): Promise<boolean> {
    const a = await this.getBoardAssetByIdForUser(boardId, assetId, userId);
    if (!a) return false;
    this.assets.delete(assetId);
    return true;
  }
}

function buildApp(userId = "user-1"): { app: Express; storage: FakeBoardsStorage } {
  const app: Express = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: userId, type: "agent", email: "test@example.com" };
    next();
  });
  const storage = new FakeBoardsStorage();
  const storageAsInterface = storage as unknown as IStorage;
  registerBoardsRoutes(app, { storage: storageAsInterface });
  registerBoardsChatRoutes(app, { storage: storageAsInterface });
  return { app, storage };
}

async function callJson(
  app: Express,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const server = app.listen(0);
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

describe("/api/boards CRUD smoke", () => {
  it("creates, lists, gets, patches, deletes a board", async () => {
    const { app } = buildApp();

    // initially empty
    const empty = await callJson(app, "GET", "/api/boards");
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, []);

    // create
    const created = await callJson(app, "POST", "/api/boards", { title: "My Board" });
    assert.equal(created.status, 200);
    assert.equal(created.body.title, "My Board");
    const id = created.body.id;
    assert.ok(id);

    // list now has 1
    const listed = await callJson(app, "GET", "/api/boards");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.length, 1);
    assert.equal(listed.body[0].id, id);
    assert.equal(listed.body[0].assetCount, 0);
    assert.deepEqual(listed.body[0].thumbnails, []);

    // get includes batches array
    const got = await callJson(app, "GET", `/api/boards/${id}`);
    assert.equal(got.status, 200);
    assert.equal(got.body.id, id);
    assert.deepEqual(got.body.batches, []);
    assert.deepEqual(got.body.assets, []);

    // patch (rename)
    const renamed = await callJson(app, "PATCH", `/api/boards/${id}`, { title: "Renamed" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.title, "Renamed");

    // delete
    const del = await callJson(app, "DELETE", `/api/boards/${id}`);
    assert.equal(del.status, 200);
    assert.deepEqual(del.body, { success: true });

    // gone
    const gone = await callJson(app, "GET", `/api/boards/${id}`);
    assert.equal(gone.status, 404);
  });

  it("groups assets by batchId in board detail", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body.id;

    await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "batch-a", batchLabel: "Batch A", kind: "image", provider: "luma",
    });
    await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "batch-a", batchLabel: "Batch A", kind: "image", provider: "luma",
    });
    await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "batch-b", batchLabel: "Batch B", kind: "video", provider: "runway",
    });

    const got = await callJson(app, "GET", `/api/boards/${boardId}`);
    assert.equal(got.status, 200);
    assert.equal(got.body.batches.length, 2);
    const a = got.body.batches.find((b: { batchId: string })  => b.batchId === "batch-a");
    const b = got.body.batches.find((b: { batchId: string })  => b.batchId === "batch-b");
    assert.equal(a.assets.length, 2);
    assert.equal(b.assets.length, 1);
  });
});

describe("Board chat — v2v-only-for-Luma/Runway validation", () => {
  it("allows video-to-video on Luma", () => {
    assert.doesNotThrow(() => assertProviderSupportsGenerationMode("luma", "video-to-video"));
  });

  it("allows video-to-video on Runway", () => {
    assert.doesNotThrow(() => assertProviderSupportsGenerationMode("runway", "video-to-video"));
  });

  it("rejects video-to-video on every other provider", () => {
    const others = ["sora2", "seedance", "veo", "kling", "gemini-image", "openai-image", "heygen"];
    for (const p of others) {
      assert.throws(
        () => assertProviderSupportsGenerationMode(p, "video-to-video"),
        BoardChatValidationError,
        `expected ${p} to be rejected`,
      );
    }
  });

  it("allows text-to-video and image-to-video on any provider", () => {
    for (const p of ["luma", "sora2", "seedance", "veo", "kling"]) {
      assert.doesNotThrow(() => assertProviderSupportsGenerationMode(p, "text-to-video"));
      assert.doesNotThrow(() => assertProviderSupportsGenerationMode(p, "image-to-video"));
    }
  });

  it("V2V_PROVIDERS contains exactly luma and runway", () => {
    assert.deepEqual(new Set(V2V_PROVIDERS), new Set(["luma", "runway"]));
  });

  it("POST /api/boards/:id/chat blocks v2v on non-luma/runway providers", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body.id;

    // Seed a referenced video asset so the chat handler infers v2v from refs.
    const videoAsset = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "seed-batch",
      kind: "video",
      provider: "luma",
      assetUrl: "https://example.com/seed.mp4",
      thumbnailUrl: null,
      status: "ready",
    } as BoardAssetCreate);

    const bad = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "restyle this video",
      mode: "create",
      provider: "sora2",
      referencedAssetIds: [videoAsset!.id],
    });
    assert.equal(bad.status, 400);
    assert.match(String(bad.body.error), /Luma or Runway/);

    // Luma+v2v is additionally blocked at the chat-handler preflight (the
    // generic helper allows it, but the live Luma integration cannot
    // consume a referenced video as input yet — see Task #58).
    const lumaV2v = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "restyle this video",
      mode: "create",
      provider: "luma",
      referencedAssetIds: [videoAsset!.id],
    });
    assert.equal(lumaV2v.status, 400);
    assert.match(String(lumaV2v.body.error), /Runway/i);
  });

  it("POST /api/boards/:id/chat returns 404 for unknown board", async () => {
    const { app } = buildApp();
    const res = await callJson(app, "POST", `/api/boards/missing/chat`, {
      message: "hi",
      mode: "brainstorm",
      provider: "luma",
    });
    assert.equal(res.status, 404);
  });
});
