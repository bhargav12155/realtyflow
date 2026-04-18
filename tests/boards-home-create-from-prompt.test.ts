/**
 * Smoke test for the create-from-prompt path used by BoardsHomeView
 * (rendered both at /boards and inside the dashboard's Boards overlay).
 *
 * The component calls:
 *   apiRequest("POST", "/api/boards", title ? { title } : {})
 * and on success navigates to `/boards/:id`. This test pins that contract
 * so the route and the overlay surface stay in sync.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { registerBoardsRoutes } from "../server/routes/boards";
import type { Board, InsertBoard } from "@shared/schema";
import type { IStorage, BoardUpdate } from "../server/storage";

class FakeBoardsStorage {
  private boards = new Map<string, Board>();
  private idCounter = 0;
  private nextId() {
    this.idCounter += 1;
    return `brd_${this.idCounter}`;
  }
  async getBoardsByUserId(userId: string): Promise<Board[]> {
    return Array.from(this.boards.values()).filter((b) => b.userId === userId);
  }
  async getBoardByIdForUser(id: string, userId: string): Promise<Board | undefined> {
    const b = this.boards.get(id);
    return b && b.userId === userId ? b : undefined;
  }
  async createBoard(board: InsertBoard): Promise<Board> {
    const now = new Date();
    const created: Board = {
      id: this.nextId(),
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
  async touchBoardForUser(): Promise<void> {}
  async deleteBoardForUser(): Promise<boolean> { return false; }
  async getBoardAssetsForUser(): Promise<[]> { return []; }
  async getBoardAssetByIdForUser(): Promise<undefined> { return undefined; }
  async createBoardAssetForUser(): Promise<undefined> { return undefined; }
  async updateBoardAssetForUser(): Promise<undefined> { return undefined; }
  async deleteBoardAssetForUser(): Promise<boolean> { return false; }
}

function buildApp(userId = "user-1"): Express {
  const app: Express = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: userId, type: "agent", email: "test@example.com" };
    next();
  });
  registerBoardsRoutes(app, { storage: new FakeBoardsStorage() as unknown as IStorage });
  return app;
}

async function postBoards(app: Express, body: Record<string, unknown>) {
  const server = app.listen(0);
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const res = await fetch(`http://127.0.0.1:${addr.port}/api/boards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, unknown>;
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

describe("BoardsHomeView create-from-prompt API contract", () => {
  it("creates a titled board when the prompt is non-empty (matches { title } payload)", async () => {
    const app = buildApp();
    const res = await postBoards(app, { title: "Plan a listing video for 123 Main St" });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, "Plan a listing video for 123 Main St");
    assert.ok(typeof res.body.id === "string" && res.body.id.length > 0,
      "response must include an id so the client can navigate to /boards/:id");
  });

  it("creates an untitled board when the prompt is empty (matches {} payload)", async () => {
    const app = buildApp();
    const res = await postBoards(app, {});
    assert.equal(res.status, 200);
    assert.equal(res.body.title, "Untitled board");
    assert.ok(typeof res.body.id === "string" && res.body.id.length > 0);
  });
});
