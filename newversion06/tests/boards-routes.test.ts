import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { realtimeService } from "../server/websocket";
import {
  registerBoardsRoutes,
  assertProviderSupportsGenerationMode,
  BoardChatValidationError,
  V2V_PROVIDERS,
} from "../server/routes/boards";
import {
  registerBoardsChatRoutes,
  dispatchOne,
  inferGenMode,
  pickDefaultProvider,
  type DispatchOne,
  type DispatchImage,
  type DispatchResult,
} from "../server/routes/boards-chat";
import { lumaService } from "../server/services/luma";
import { runwayService } from "../server/services/runway";
import { sora2Service } from "../server/services/sora2";
import { veoVideoService } from "../server/services/veo-video";
import { seedanceService } from "../server/services/seedance";
import { registerNotificationsRoutes } from "../server/routes/notifications";
import type { Board, BoardAsset, BoardShare, InsertBoard, InsertNotification, Notification, User } from "@shared/schema";
import { DRAWING_MAX_CONTENT_BYTES } from "@shared/schema";
import type {
  IStorage,
  AccessibleBoard,
  BoardAssetSummaries,
  BoardShareRecipient,
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

  private shares = new Map<string, BoardShare>();
  notifications = new Map<string, Notification>();
  users: User[] = [];

  async getUser(id: string): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }
  async createNotification(n: InsertNotification): Promise<Notification> {
    const created: Notification = {
      id: this.nextId("ntf"),
      userId: n.userId,
      type: n.type,
      data: (n.data ?? {}) as Notification["data"],
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.set(created.id, created);
    return created;
  }
  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => (b.createdAt!.getTime() - a.createdAt!.getTime()));
  }
  async markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
    const n = this.notifications.get(id);
    if (!n || n.userId !== userId) return undefined;
    const updated = { ...n, isRead: true };
    this.notifications.set(id, updated);
    return updated;
  }
  async markAllNotificationsRead(userId: string): Promise<number> {
    let count = 0;
    for (const [id, n] of this.notifications) {
      if (n.userId === userId && !n.isRead) {
        this.notifications.set(id, { ...n, isRead: true });
        count += 1;
      }
    }
    return count;
  }

  async getBoardsByUserId(userId: string): Promise<Board[]> {
    return Array.from(this.boards.values())
      .filter((b) => b.userId === userId)
      .sort((a, b) => (b.updatedAt!.getTime() - a.updatedAt!.getTime()));
  }
  async getAccessibleBoardsForUser(userId: string): Promise<AccessibleBoard[]> {
    const owned: AccessibleBoard[] = Array.from(this.boards.values())
      .filter((b) => b.userId === userId)
      .map((b) => ({ ...b, isOwner: true }));
    const sharedIds = Array.from(this.shares.values())
      .filter((s) => s.sharedWithUserId === userId)
      .map((s) => s.boardId);
    const ownedIds = new Set(owned.map((b) => b.id));
    const shared: AccessibleBoard[] = sharedIds
      .filter((id) => !ownedIds.has(id))
      .map((id) => this.boards.get(id))
      .filter((b): b is Board => !!b)
      .map((b) => ({ ...b, isOwner: false }));
    return [...owned, ...shared].sort(
      (a, b) => (b.updatedAt!.getTime() - a.updatedAt!.getTime()),
    );
  }
  async getBoardByIdForUser(id: string, userId: string): Promise<Board | undefined> {
    const b = this.boards.get(id);
    return b && b.userId === userId ? b : undefined;
  }
  async getAccessibleBoardForUser(id: string, userId: string): Promise<AccessibleBoard | undefined> {
    const b = this.boards.get(id);
    if (!b) return undefined;
    if (b.userId === userId) return { ...b, isOwner: true };
    const sharedHit = Array.from(this.shares.values()).find(
      (s) => s.boardId === id && s.sharedWithUserId === userId,
    );
    return sharedHit ? { ...b, isOwner: false } : undefined;
  }
  async getBoardShares(boardId: string, ownerUserId: string): Promise<BoardShareRecipient[]> {
    const owner = await this.getBoardByIdForUser(boardId, ownerUserId);
    if (!owner) return [];
    return Array.from(this.shares.values())
      .filter((s) => s.boardId === boardId)
      .map((s) => {
        const u = this.users.find((x) => x.id === s.sharedWithUserId);
        return {
          userId: s.sharedWithUserId,
          name: u?.name ?? null,
          email: u?.email ?? null,
          sharedAt: s.createdAt ?? null,
        };
      });
  }
  async shareBoard(boardId: string, ownerUserId: string, sharedWithUserId: string): Promise<BoardShare | undefined> {
    if (sharedWithUserId === ownerUserId) return undefined;
    const owner = await this.getBoardByIdForUser(boardId, ownerUserId);
    if (!owner) return undefined;
    const existing = Array.from(this.shares.values()).find(
      (s) => s.boardId === boardId && s.sharedWithUserId === sharedWithUserId,
    );
    if (existing) return existing;
    const created: BoardShare = {
      id: this.nextId("shr"),
      boardId,
      sharedWithUserId,
      sharedByUserId: ownerUserId,
      createdAt: new Date(),
    };
    this.shares.set(created.id, created);
    return created;
  }
  async unshareBoard(boardId: string, ownerUserId: string, sharedWithUserId: string): Promise<boolean> {
    const owner = await this.getBoardByIdForUser(boardId, ownerUserId);
    if (!owner) return false;
    const hit = Array.from(this.shares.entries()).find(
      ([, s]) => s.boardId === boardId && s.sharedWithUserId === sharedWithUserId,
    );
    if (!hit) return false;
    this.shares.delete(hit[0]);
    return true;
  }
  async leaveSharedBoard(boardId: string, userId: string): Promise<boolean> {
    const hit = Array.from(this.shares.entries()).find(
      ([, s]) => s.boardId === boardId && s.sharedWithUserId === userId,
    );
    if (!hit) return false;
    this.shares.delete(hit[0]);
    return true;
  }
  async getAllUsers(): Promise<User[]> {
    return [...this.users];
  }
  async getUser(id: string): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }
  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    const set = new Set(ids);
    return this.users.filter((u) => set.has(u.id));
  }
  async getBoardSharesForBoards(boardIds: string[]): Promise<Map<string, BoardShareRecipient[]>> {
    const result = new Map<string, BoardShareRecipient[]>();
    for (const id of boardIds) result.set(id, []);
    for (const s of this.shares.values()) {
      if (!result.has(s.boardId)) continue;
      const u = this.users.find((x) => x.id === s.sharedWithUserId);
      result.get(s.boardId)!.push({
        userId: s.sharedWithUserId,
        name: u?.name ?? null,
        email: u?.email ?? null,
        sharedAt: s.createdAt ?? null,
      });
    }
    return result;
  }
  async createBoard(board: InsertBoard): Promise<Board> {
    const now = new Date();
    const created: Board = {
      id: this.nextId("brd"),
      userId: board.userId,
      title: board.title ?? "Untitled board",
      isShared: board.isShared ?? false,
      // The boards table now persists a per-board cap on chat history; default
      // to the historical 200 so freshly created boards keep current behavior.
      chatHistoryCap: (board as { chatHistoryCap?: number }).chatHistoryCap ?? 200,
      notifyOnCollaboratorChange:
        (board as { notifyOnCollaboratorChange?: boolean }).notifyOnCollaboratorChange ?? true,
      createdAt: now,
      updatedAt: now,
    } as Board;
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
    // Mirrors the real storage (Task #232): owner OR shared collaborator
    // can list assets, since collaborators need this list to drive winner
    // overrides and re-evaluation on shared boards.
    const access = await this.getAccessibleBoardForUser(boardId, userId);
    if (!access) return [];
    return Array.from(this.assets.values())
      .filter((a) => a.boardId === boardId)
      .sort((a, b2) => b2.createdAt!.getTime() - a.createdAt!.getTime());
  }
  async getBoardAssetSummariesForBoards(
    boardIds: string[],
  ): Promise<Map<string, BoardAssetSummaries>> {
    const result = new Map<string, BoardAssetSummaries>();
    if (!boardIds.length) return result;
    const unique = Array.from(new Set(boardIds));
    for (const id of unique) result.set(id, { assetCount: 0, thumbnails: [] });
    const sorted = Array.from(this.assets.values()).sort(
      (a, b) => b.createdAt!.getTime() - a.createdAt!.getTime(),
    );
    for (const a of sorted) {
      const entry = result.get(a.boardId);
      if (!entry) continue;
      entry.assetCount += 1;
      if (entry.thumbnails.length < 4 && (a.thumbnailUrl || a.assetUrl)) {
        entry.thumbnails.push({
          id: a.id,
          kind: a.kind,
          thumbnailUrl: a.thumbnailUrl,
          assetUrl: a.assetUrl,
        });
      }
    }
    return result;
  }
  async getBoardAssetByIdForUser(boardId: string, assetId: string, userId: string): Promise<BoardAsset | undefined> {
    // Mirrors the real storage (Task #229): owner OR shared collaborator
    // can read board assets.
    const access = await this.getAccessibleBoardForUser(boardId, userId);
    if (!access) return undefined;
    const a = this.assets.get(assetId);
    return a && a.boardId === boardId ? a : undefined;
  }
  async createBoardAssetForUser(boardId: string, userId: string, asset: BoardAssetCreate): Promise<BoardAsset | undefined> {
    // Mirrors the real storage (Task #230): owner OR shared collaborator
    // can create board assets.
    const access = await this.getAccessibleBoardForUser(boardId, userId);
    if (!access) return undefined;
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
      content: asset.content ?? null,
      createdAt: new Date(),
    } as BoardAsset;
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
    // Owner-only (Task #229): destructive actions stay with the board owner.
    const owner = await this.getBoardByIdForUser(boardId, userId);
    if (!owner) return false;
    const a = this.assets.get(assetId);
    if (!a || a.boardId !== boardId) return false;
    this.assets.delete(assetId);
    return true;
  }
  async bulkUpdateBoardAssetPositionsForUser(
    boardId: string,
    userId: string,
    moves: Array<{ id: string; positionX: number; positionY: number }>,
  ): Promise<BoardAsset[] | undefined> {
    // Atomic stub: verify ownership of every asset first, then apply.
    const verified: BoardAsset[] = [];
    for (const m of moves) {
      const a = await this.getBoardAssetByIdForUser(boardId, m.id, userId);
      if (!a) return undefined;
      verified.push(a);
    }
    const updated: BoardAsset[] = [];
    for (const m of moves) {
      const a = this.assets.get(m.id)!;
      const next = { ...a, positionX: m.positionX, positionY: m.positionY };
      this.assets.set(m.id, next);
      updated.push(next);
    }
    return updated;
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
  registerNotificationsRoutes(app, { storage: storageAsInterface });
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

describe("/api/boards sharing", () => {
  it("places shared boards on the recipient's list (not in 'mine'), and only the owner sees them in 'mine'", async () => {
    const ownerApp = buildApp("owner-1");
    const recipientApp = buildApp("recipient-2");
    // Seed owner's board, then share it.
    const created = await callJson(ownerApp.app, "POST", "/api/boards", { title: "Sharable" });
    const boardId = created.body!.id as string;

    // Recipient sees nothing yet.
    const beforeShare = await callJson(recipientApp.app, "GET", "/api/boards");
    assert.equal(beforeShare.status, 200);
    assert.equal((beforeShare.body as unknown[]).length, 0);

    // Cross-stub the share so both fakes agree on the share table being mutated.
    const ok = await ownerApp.storage.shareBoard(boardId, "owner-1", "recipient-2");
    assert.ok(ok, "owner can share their board");
    // Mirror the board + share into the recipient's storage so its GET sees it.
    const boardCopy = (await ownerApp.storage.getBoardByIdForUser(boardId, "owner-1"))!;
    (recipientApp.storage as unknown as { boards: Map<string, Board> }).boards.set(boardId, boardCopy);
    await recipientApp.storage.shareBoard(boardId, "owner-1", "recipient-2");

    // Recipient now sees the board, flagged as not owned by them.
    const afterShare = await callJson(recipientApp.app, "GET", "/api/boards");
    assert.equal(afterShare.status, 200);
    const recipList = afterShare.body as Array<{ id: string; isOwner: boolean }>;
    assert.equal(recipList.length, 1);
    assert.equal(recipList[0].id, boardId);
    assert.equal(recipList[0].isOwner, false);

    // Owner still sees it as their own.
    const ownerList = await callJson(ownerApp.app, "GET", "/api/boards");
    const ownList = ownerList.body as Array<{ id: string; isOwner: boolean }>;
    assert.equal(ownList.length, 1);
    assert.equal(ownList[0].isOwner, true);
  });

  it("POST /api/boards/:id/shares creates a share and DELETE removes it", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push({
      id: "recipient-2",
      username: "rec",
      password: "x",
      name: "Recipient",
      email: "rec@example.com",
      role: "agent",
      isDemo: false,
      createdAt: new Date(),
    });
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;

    // Initial shares list is empty.
    const empty = await callJson(app, "GET", `/api/boards/${boardId}/shares`);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, []);

    // Share with recipient.
    const shared = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "recipient-2" });
    assert.equal(shared.status, 200);
    assert.equal((shared.body as { sharedWithUserId: string }).sharedWithUserId, "recipient-2");

    // Listing now returns the recipient.
    const listed = await callJson(app, "GET", `/api/boards/${boardId}/shares`);
    const recipients = listed.body as Array<{ userId: string; email: string | null }>;
    assert.equal(recipients.length, 1);
    assert.equal(recipients[0].userId, "recipient-2");
    assert.equal(recipients[0].email, "rec@example.com");

    // Sharing the same person twice is idempotent (still 1 entry).
    await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "recipient-2" });
    const stillOne = await callJson(app, "GET", `/api/boards/${boardId}/shares`);
    assert.equal((stillOne.body as unknown[]).length, 1);

    // DELETE removes the share.
    const removed = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/recipient-2`);
    assert.equal(removed.status, 200);
    const afterRemove = await callJson(app, "GET", `/api/boards/${boardId}/shares`);
    assert.deepEqual(afterRemove.body, []);
  });

  it("DELETE /api/boards/:id/shares/:userId pushes a board_access_revoked event to the removed user", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push({
      id: "recipient-3",
      username: "rec3",
      password: "x",
      name: "Recipient Three",
      email: "rec3@example.com",
      role: "agent",
      isDemo: false,
      createdAt: new Date(),
    });
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;
    await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "recipient-3" });

    // Intercept realtimeService.sendToUser before unshare so we can assert
    // the typed eviction event fires for the removed collaborator and not
    // for anyone else.
    const { realtimeService } = await import("../server/websocket");
    const original = realtimeService.sendToUser.bind(realtimeService);
    const calls: Array<{ userId: string; type: string; data: unknown }> = [];
    (realtimeService as unknown as { sendToUser: typeof realtimeService.sendToUser }).sendToUser = (
      userId,
      message,
    ) => {
      calls.push({ userId, type: message.type, data: message.data });
    };
    try {
      const removed = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/recipient-3`);
      assert.equal(removed.status, 200);
    } finally {
      (realtimeService as unknown as { sendToUser: typeof realtimeService.sendToUser }).sendToUser = original;
    }

    const evictions = calls.filter((c) => c.type === "board_access_revoked");
    assert.equal(evictions.length, 1, "expected exactly one board_access_revoked event");
    assert.equal(evictions[0].userId, "recipient-3");
    assert.deepEqual(evictions[0].data, { boardId });
  });

  it("creates a notification for the recipient when a board is shared", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push({
      id: "owner-1",
      username: "own",
      password: "x",
      name: "Owner Person",
      email: "owner@example.com",
      role: "agent",
      isDemo: false,
      createdAt: new Date(),
    });
    storage.users.push({
      id: "recipient-2",
      username: "rec",
      password: "x",
      name: "Recipient",
      email: "rec@example.com",
      role: "agent",
      isDemo: false,
      createdAt: new Date(),
    });
    const created = await callJson(app, "POST", "/api/boards", { title: "Shared Board" });
    const boardId = created.body!.id as string;

    const shared = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "recipient-2" });
    assert.equal(shared.status, 200);

    // The recipient should now have one unread "board_shared" notification.
    const list = Array.from(storage.notifications.values()).filter((n) => n.userId === "recipient-2");
    assert.equal(list.length, 1);
    assert.equal(list[0].type, "board_shared");
    assert.equal(list[0].isRead, false);
    const data = list[0].data as { boardId: string; boardTitle: string; sharedByName: string | null };
    assert.equal(data.boardId, boardId);
    assert.equal(data.boardTitle, "Shared Board");
    assert.equal(data.sharedByName, "Owner Person");

    // Re-sharing the same person is idempotent on the share table but still
    // produces a fresh notification (recipient may have dismissed the prior).
    await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "recipient-2" });
    const after = Array.from(storage.notifications.values()).filter((n) => n.userId === "recipient-2");
    assert.equal(after.length, 2);
  });

  it("lists, dismisses, and bulk-marks notifications via /api/notifications", async () => {
    const { app, storage } = buildApp("user-1");
    // Seed two notifications for user-1.
    await storage.createNotification({ userId: "user-1", type: "board_shared", data: { boardId: "b1", boardTitle: "B1" } });
    await storage.createNotification({ userId: "user-1", type: "board_shared", data: { boardId: "b2", boardTitle: "B2" } });
    // And one for someone else, which must never leak.
    await storage.createNotification({ userId: "other", type: "board_shared", data: { boardId: "b3" } });

    const list = await callJson(app, "GET", "/api/notifications");
    assert.equal(list.status, 200);
    const items = list.body as Array<{ id: string; isRead: boolean; userId: string }>;
    assert.equal(items.length, 2);
    assert.ok(items.every((n) => n.userId === "user-1"));

    // Dismiss the first.
    const firstId = items[0].id;
    const dismiss = await callJson(app, "POST", `/api/notifications/${firstId}/read`);
    assert.equal(dismiss.status, 200);
    assert.equal((dismiss.body as { isRead: boolean }).isRead, true);

    // Mark all read clears the remaining unread one.
    const all = await callJson(app, "POST", `/api/notifications/read-all`);
    assert.equal(all.status, 200);
    assert.equal((all.body as { updated: number }).updated, 1);

    // Cannot mark another user's notification as read.
    const otherId = Array.from(storage.notifications.values()).find((n) => n.userId === "other")!.id;
    const stranger = await callJson(app, "POST", `/api/notifications/${otherId}/read`);
    assert.equal(stranger.status, 404);
  });

  it("dismissed/read notifications disappear from the bell's unread feed", async () => {
    const { app, storage } = buildApp("user-1");
    await storage.createNotification({ userId: "user-1", type: "board_shared", data: { boardId: "b1", boardTitle: "B1" } });
    await storage.createNotification({ userId: "user-1", type: "board_shared", data: { boardId: "b2", boardTitle: "B2" } });

    // Bell sources from /api/notifications and filters to unread on the client.
    const initial = (await callJson(app, "GET", "/api/notifications")).body as Array<{ id: string; isRead: boolean }>;
    const initialUnread = initial.filter((n) => !n.isRead);
    assert.equal(initialUnread.length, 2);

    // Dismiss one.
    await callJson(app, "POST", `/api/notifications/${initialUnread[0].id}/read`);
    const afterOne = (await callJson(app, "GET", "/api/notifications")).body as Array<{ isRead: boolean }>;
    assert.equal(afterOne.filter((n) => !n.isRead).length, 1);

    // Mark all read clears the rest from the bell.
    await callJson(app, "POST", `/api/notifications/read-all`);
    const afterAll = (await callJson(app, "GET", "/api/notifications")).body as Array<{ isRead: boolean }>;
    assert.equal(afterAll.filter((n) => !n.isRead).length, 0);
  });

  it("GET /api/boards uses bulk lookups instead of per-board getUser/getBoardShares", async () => {
    const { app, storage } = buildApp("owner-1");
    // Seed a few owned boards…
    for (let i = 0; i < 4; i++) {
      await callJson(app, "POST", "/api/boards", { title: `Owned ${i}` });
    }
    // …and a few shared-in boards from another owner.
    storage.users.push({
      id: "other-owner",
      username: "oth",
      password: "x",
      name: "Other Owner",
      email: "oth@example.com",
      role: "agent",
      isDemo: false,
      createdAt: new Date(),
    });
    for (let i = 0; i < 3; i++) {
      const b = await storage.createBoard({ userId: "other-owner", title: `Foreign ${i}`, isShared: false });
      await storage.shareBoard(b.id, "other-owner", "owner-1");
    }

    let perBoardShareCalls = 0;
    let perUserCalls = 0;
    let bulkShareCalls = 0;
    let bulkUserCalls = 0;
    const origGetBoardShares = storage.getBoardShares.bind(storage);
    const origGetUser = storage.getUser.bind(storage);
    const origBulkShares = storage.getBoardSharesForBoards.bind(storage);
    const origBulkUsers = storage.getUsersByIds.bind(storage);
    storage.getBoardShares = (...args: Parameters<typeof origGetBoardShares>) => {
      perBoardShareCalls += 1;
      return origGetBoardShares(...args);
    };
    storage.getUser = (...args: Parameters<typeof origGetUser>) => {
      perUserCalls += 1;
      return origGetUser(...args);
    };
    storage.getBoardSharesForBoards = (...args: Parameters<typeof origBulkShares>) => {
      bulkShareCalls += 1;
      return origBulkShares(...args);
    };
    storage.getUsersByIds = (...args: Parameters<typeof origBulkUsers>) => {
      bulkUserCalls += 1;
      return origBulkUsers(...args);
    };

    const listed = await callJson(app, "GET", "/api/boards");
    assert.equal(listed.status, 200);
    const items = listed.body as Array<{ id: string; isOwner: boolean }>;
    assert.equal(items.length, 7);

    // The whole point of the fix: fixed-cost lookups, not per-board ones.
    assert.equal(bulkShareCalls, 1, "expected one bulk share lookup");
    assert.equal(bulkUserCalls, 1, "expected one bulk user lookup");
    assert.equal(perBoardShareCalls, 0, "per-board getBoardShares must not be called from list endpoint");
    assert.equal(perUserCalls, 0, "per-board getUser must not be called from list endpoint");
  });

  it("rejects sharing with yourself and returns 404 when sharing a board you don't own", async () => {
    const { app } = buildApp("owner-1");
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;

    const self = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "owner-1" });
    assert.equal(self.status, 400);

    const other = buildApp("stranger-3");
    const notMine = await callJson(other.app, "POST", `/api/boards/${boardId}/shares`, { userId: "x" });
    // Strangers without their own board with that id get 404.
    assert.equal(notMine.status, 404);
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

describe("Bulk asset position update", () => {
  async function seedTwoAssets(app: Express, storage: FakeBoardsStorage, boardId: string) {
    const a = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "b", kind: "image", provider: "upload",
      assetUrl: "https://example.com/a.png", thumbnailUrl: null, status: "ready",
      positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    const b = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "b", kind: "image", provider: "upload",
      assetUrl: "https://example.com/b.png", thumbnailUrl: null, status: "ready",
      positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    return { a: a!, b: b! };
  }

  it("PATCH /api/boards/:id/assets/positions atomically updates the batch", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const { a, b } = await seedTwoAssets(app, storage, boardId);

    const res = await callJson(app, "PATCH", `/api/boards/${boardId}/assets/positions`, {
      moves: [
        { id: a.id, positionX: 10, positionY: 20 },
        { id: b.id, positionX: 30, positionY: 40 },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal((res.body as BoardAsset[]).length, 2);

    const refreshed = await callJson(app, "GET", `/api/boards/${boardId}`);
    const byId = new Map(
      (refreshed.body as { assets: BoardAsset[] }).assets.map((x) => [x.id, x] as const),
    );
    assert.equal(byId.get(a.id)!.positionX, 10);
    assert.equal(byId.get(a.id)!.positionY, 20);
    assert.equal(byId.get(b.id)!.positionX, 30);
    assert.equal(byId.get(b.id)!.positionY, 40);
  });

  it("rejects the whole batch when any id is missing (404, no partial writes)", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const { a } = await seedTwoAssets(app, storage, boardId);

    const res = await callJson(app, "PATCH", `/api/boards/${boardId}/assets/positions`, {
      moves: [
        { id: a.id, positionX: 99, positionY: 99 },
        { id: "missing-asset", positionX: 1, positionY: 1 },
      ],
    });
    assert.equal(res.status, 404);

    // First asset must still be at 0,0 — the batch was rejected as a whole.
    const refreshed = await callJson(app, "GET", `/api/boards/${boardId}`);
    const reloadedA = (refreshed.body as { assets: BoardAsset[] }).assets.find(
      (x) => x.id === a.id,
    )!;
    assert.equal(reloadedA.positionX, 0);
    assert.equal(reloadedA.positionY, 0);
  });

  it("rejects empty moves arrays with 400", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const res = await callJson(app, "PATCH", `/api/boards/${boardId}/assets/positions`, {
      moves: [],
    });
    assert.equal(res.status, 400);
  });
});

describe("Shared collaborators can rearrange tiles (Task #229)", () => {
  async function setupSharedBoard() {
    const { app, storage } = buildApp("recipient-2");
    // Seed owner's board + two assets, then share with recipient-2 (the
    // logged-in user for this app). The single-app fake satisfies both
    // owner-side seeding and recipient-side requests because it doesn't
    // tie boards to req.user.
    const board = await storage.createBoard({ userId: "owner-1", title: "Shared canvas" });
    const a = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "b", kind: "image", provider: "upload",
      assetUrl: "https://example.com/a.png", thumbnailUrl: null, status: "ready",
      positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    const b = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "b", kind: "image", provider: "upload",
      assetUrl: "https://example.com/b.png", thumbnailUrl: null, status: "ready",
      positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    return { app, storage, boardId: board.id, a: a!, b: b! };
  }

  it("PATCH single asset succeeds for a shared collaborator", async () => {
    const { app, boardId, a } = await setupSharedBoard();
    const res = await callJson(app, "PATCH", `/api/boards/${boardId}/assets/${a.id}`, {
      positionX: 42, positionY: 99,
    });
    assert.equal(res.status, 200);
    assert.equal((res.body as BoardAsset).positionX, 42);
    assert.equal((res.body as BoardAsset).positionY, 99);
  });

  it("PATCH /assets/positions bulk move succeeds for a shared collaborator", async () => {
    const { app, boardId, a, b } = await setupSharedBoard();
    const res = await callJson(app, "PATCH", `/api/boards/${boardId}/assets/positions`, {
      moves: [
        { id: a.id, positionX: 11, positionY: 22 },
        { id: b.id, positionX: 33, positionY: 44 },
      ],
    });
    assert.equal(res.status, 200);
    const rows = res.body as BoardAsset[];
    assert.equal(rows.length, 2);
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    assert.equal(byId.get(a.id)!.positionX, 11);
    assert.equal(byId.get(b.id)!.positionY, 44);
  });

  it("DELETE asset stays owner-only — collaborator gets 404", async () => {
    const { app, boardId, a } = await setupSharedBoard();
    const res = await callJson(app, "DELETE", `/api/boards/${boardId}/assets/${a.id}`);
    assert.equal(res.status, 404);
  });

  it("POST /assets succeeds for a shared collaborator (Task #230)", async () => {
    const { app, boardId } = await setupSharedBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "collab-batch",
      kind: "image",
      provider: "upload",
      assetUrl: "https://example.com/collab.png",
      thumbnailUrl: null,
      status: "ready",
      positionX: 100,
      positionY: 200,
    });
    assert.equal(res.status, 200);
    const body = res.body as BoardAsset;
    assert.equal(body.boardId, boardId);
    assert.equal(body.assetUrl, "https://example.com/collab.png");
    assert.equal(body.positionX, 100);
  });

  it("collaborators can create sticky / text / frame / drawing tiles", async () => {
    const { app, boardId } = await setupSharedBoard();
    const sticky = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "sticky-batch", kind: "sticky", provider: "tool",
      content: "hello from collab", positionX: 10, positionY: 10,
    });
    assert.equal(sticky.status, 200);
    assert.equal((sticky.body as BoardAsset).kind, "sticky");
    const text = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "text-batch", kind: "text", provider: "tool",
      content: "collab note", positionX: 20, positionY: 20,
    });
    assert.equal(text.status, 200);
    assert.equal((text.body as BoardAsset).kind, "text");
    const frame = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "frame-batch", kind: "frame", provider: "tool",
      content: "collab section", positionX: 30, positionY: 30,
    });
    assert.equal(frame.status, 200);
    assert.equal((frame.body as BoardAsset).kind, "frame");
    const drawing = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "drawing-batch",
      kind: "drawing",
      provider: "tool",
      content: JSON.stringify({
        v: 1, width: 300, height: 200,
        strokes: [{ color: "#000000", width: 2, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }],
      }),
      positionX: 40, positionY: 40,
    });
    assert.equal(drawing.status, 200);
    assert.equal((drawing.body as BoardAsset).kind, "drawing");
  });

  it("non-collaborators (no share row) still get 404 on POST /assets", async () => {
    const { app, storage } = buildApp("stranger-3");
    const board = await storage.createBoard({ userId: "owner-1", title: "Private" });
    const res = await callJson(app, "POST", `/api/boards/${board.id}/assets`, {
      batchId: "stranger-batch",
      kind: "image",
      provider: "upload",
      assetUrl: "https://example.com/x.png",
      thumbnailUrl: null,
      status: "ready",
      positionX: 0,
      positionY: 0,
    });
    assert.equal(res.status, 404);
  });

  it("non-collaborators (no share row) still get 404 on PATCH", async () => {
    const { app, storage } = buildApp("stranger-3");
    const board = await storage.createBoard({ userId: "owner-1", title: "Private" });
    const a = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "b", kind: "image", provider: "upload",
      assetUrl: "https://example.com/a.png", thumbnailUrl: null, status: "ready",
      positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    const single = await callJson(app, "PATCH", `/api/boards/${board.id}/assets/${a!.id}`, {
      positionX: 1, positionY: 2,
    });
    assert.equal(single.status, 404);
    const bulk = await callJson(app, "PATCH", `/api/boards/${board.id}/assets/positions`, {
      moves: [{ id: a!.id, positionX: 1, positionY: 2 }],
    });
    assert.equal(bulk.status, 404);
  });
});

describe("Shared collaborators can pick batch winners and re-evaluate (Task #232)", () => {
  // Seed a shared board with a 3-asset batch so winner-override and
  // re-evaluate both have something to act on. The signed-in user (`asUser`)
  // can be either the owner or a shared collaborator depending on the case
  // we want to exercise.
  async function setupSharedBatch(asUser: string) {
    const { app, storage } = buildApp(asUser);
    const board = await storage.createBoard({ userId: "owner-1", title: "Shared canvas" });
    const a = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "batch-x", batchLabel: "Batch X", kind: "image", provider: "openai-image",
      assetUrl: "https://example.com/a.png", thumbnailUrl: "https://example.com/a.png",
      status: "ready", positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    const b = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "batch-x", batchLabel: "Batch X", kind: "image", provider: "openai-image",
      assetUrl: "https://example.com/b.png", thumbnailUrl: "https://example.com/b.png",
      status: "ready", positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    const c = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "batch-x", batchLabel: "Batch X", kind: "image", provider: "openai-image",
      assetUrl: "https://example.com/c.png", thumbnailUrl: "https://example.com/c.png",
      status: "ready", positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    return { app, storage, boardId: board.id, a: a!, b: b!, c: c! };
  }

  it("collaborator can override the winner of a batch they did not start", async () => {
    const { app, storage, boardId, a, b, c } = await setupSharedBatch("recipient-2");
    const res = await callJson(
      app,
      "POST",
      `/api/boards/${boardId}/batches/batch-x/winner`,
      { winnerAssetId: b.id, reasonForPriorWinner: "collab vote" },
    );
    assert.equal(res.status, 200);
    const body = res.body as {
      success: boolean;
      winner: BoardAsset;
      demoted: BoardAsset[];
    };
    assert.equal(body.success, true);
    assert.equal(body.winner.id, b.id);
    assert.equal(body.winner.status, "ready");
    // Both prior "ready" siblings should be demoted by the override.
    const demotedIds = body.demoted.map((d) => d.id).sort();
    assert.deepEqual(demotedIds, [a.id, c.id].sort());
    // Confirm the persisted state reflects the override too.
    const fresh = await storage.getBoardAssetByIdForUser(boardId, b.id, "owner-1");
    assert.equal(fresh!.status, "ready");
    const demotedFresh = await storage.getBoardAssetByIdForUser(boardId, a.id, "owner-1");
    assert.equal(demotedFresh!.status, "rejected");
    assert.equal(demotedFresh!.rejectionReason, "collab vote");
  });

  it("collaborator can re-trigger auto-evaluation on a shared batch", async () => {
    const { app, storage, boardId, a } = await setupSharedBatch("recipient-2");
    // Demote one asset first so re-eval has both ready and rejected
    // candidates to reconsider — matching the production flow.
    await storage.updateBoardAssetForUser(boardId, a.id, "owner-1", {
      status: "rejected",
      rejectionReason: "earlier eval said so",
    });
    const res = await callJson(
      app,
      "POST",
      `/api/boards/${boardId}/batches/batch-x/re-evaluate`,
      { modelHint: "heuristic", prompt: "pick the best one" },
    );
    assert.equal(res.status, 200);
    const body = res.body as {
      success: boolean;
      batchId: string;
      winnerAssetId: string;
      modelUsed: string;
      rejected: Array<{ assetId: string; reason: string }>;
    };
    assert.equal(body.success, true);
    assert.equal(body.batchId, "batch-x");
    assert.equal(body.modelUsed, "heuristic");
    assert.ok(body.winnerAssetId);
    assert.ok(body.rejected.length >= 1);
  });

  it("non-collaborators (no share row) get 404 on winner override", async () => {
    const { app, storage } = buildApp("stranger-3");
    const board = await storage.createBoard({ userId: "owner-1", title: "Private" });
    const a = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "batch-x", batchLabel: "Batch X", kind: "image", provider: "openai-image",
      assetUrl: "https://example.com/a.png", thumbnailUrl: "https://example.com/a.png",
      status: "ready", positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    const res = await callJson(
      app,
      "POST",
      `/api/boards/${board.id}/batches/batch-x/winner`,
      { winnerAssetId: a!.id },
    );
    assert.equal(res.status, 404);
  });

  it("non-collaborators (no share row) get 404 on re-evaluate", async () => {
    const { app, storage } = buildApp("stranger-3");
    const board = await storage.createBoard({ userId: "owner-1", title: "Private" });
    await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "batch-x", batchLabel: "Batch X", kind: "image", provider: "openai-image",
      assetUrl: "https://example.com/a.png", thumbnailUrl: "https://example.com/a.png",
      status: "ready", positionX: 0, positionY: 0,
    } as BoardAssetCreate);
    const res = await callJson(
      app,
      "POST",
      `/api/boards/${board.id}/batches/batch-x/re-evaluate`,
      { modelHint: "heuristic" },
    );
    assert.equal(res.status, 404);
  });

  it("owner can still override winners on their own boards", async () => {
    const { app, boardId, b } = await setupSharedBatch("owner-1");
    const res = await callJson(
      app,
      "POST",
      `/api/boards/${boardId}/batches/batch-x/winner`,
      { winnerAssetId: b.id },
    );
    assert.equal(res.status, 200);
    assert.equal((res.body as { winner: BoardAsset }).winner.id, b.id);
  });

  // ----------------------------------------------------------------------
  // Live broadcast (Task #237): when a collaborator overrides the winner or
  // re-triggers auto-evaluation, every connected participant on the board —
  // owner + every share recipient — must receive the resulting asset status
  // updates and (for re-eval) the auto-eval summary in real time. Mirrors
  // how `notifyBoardAssetUpdated` fans out asset PATCH/POST changes.
  // ----------------------------------------------------------------------
  it("override fans out promoted/demoted asset statuses to owner + every collaborator", async () => {
    const { app, storage, boardId, a, b, c } = await setupSharedBatch("recipient-2");
    // Add a second collaborator so we can prove fan-out reaches more than
    // one share recipient — not just the actor.
    await storage.shareBoard(boardId, "owner-1", "recipient-3");

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(
        app,
        "POST",
        `/api/boards/${boardId}/batches/batch-x/winner`,
        { winnerAssetId: b.id },
      );
      assert.equal(res.status, 200);
      // Three assets in this batch (a, b, c). The override demotes a and c
      // (both previously "ready") and promotes b. So we expect 3 status
      // updates per recipient, fanned out to each of the 3 participants.
      const calls = statusSpy.mock.calls.map((c) => c.arguments as [string, { assetId: string }]);
      const recipientsSeen = new Set(calls.map((c) => c[0]));
      assert.deepEqual(
        [...recipientsSeen].sort(),
        ["owner-1", "recipient-2", "recipient-3"].sort(),
        "every participant receives at least one asset status update",
      );
      // For each affected asset we should have one frame per participant.
      for (const assetId of [a.id, b.id, c.id]) {
        const perAsset = calls.filter((c) => c[1].assetId === assetId);
        const recipientsForAsset = new Set(perAsset.map((c) => c[0]));
        assert.deepEqual(
          [...recipientsForAsset].sort(),
          ["owner-1", "recipient-2", "recipient-3"].sort(),
          `asset ${assetId} should be broadcast to all 3 participants`,
        );
      }
    } finally {
      statusSpy.mock.restore();
    }
  });

  it("re-evaluate fans out asset statuses + auto-eval summary to owner + every collaborator", async () => {
    const { app, storage, boardId, a } = await setupSharedBatch("recipient-2");
    await storage.shareBoard(boardId, "owner-1", "recipient-3");
    // Demote one asset first so re-eval has both ready and rejected
    // candidates to reconsider — matching the production flow.
    await storage.updateBoardAssetForUser(boardId, a.id, "owner-1", {
      status: "rejected",
      rejectionReason: "earlier eval said so",
    });

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    const autoEvalSpy = mock.method(realtimeService, "notifyBoardAutoEval", () => {});
    try {
      const res = await callJson(
        app,
        "POST",
        `/api/boards/${boardId}/batches/batch-x/re-evaluate`,
        { modelHint: "heuristic", prompt: "pick the best one" },
      );
      assert.equal(res.status, 200);

      // The auto-eval summary must reach every participant exactly once.
      const autoEvalCalls = autoEvalSpy.mock.calls.map(
        (c) => c.arguments as [string, { boardId: string; batchId: string }],
      );
      assert.equal(autoEvalCalls.length, 3);
      const autoEvalRecipients = autoEvalCalls.map((c) => c[0]).sort();
      assert.deepEqual(
        autoEvalRecipients,
        ["owner-1", "recipient-2", "recipient-3"].sort(),
      );
      for (const [, payload] of autoEvalCalls) {
        assert.equal(payload.boardId, boardId);
        assert.equal(payload.batchId, "batch-x");
      }

      // Status updates must reach every participant for at least the
      // promoted winner (so other collaborators see the new ready asset
      // without a refresh).
      const statusCalls = statusSpy.mock.calls.map(
        (c) => c.arguments as [string, { assetId: string }],
      );
      const statusRecipients = new Set(statusCalls.map((c) => c[0]));
      assert.deepEqual(
        [...statusRecipients].sort(),
        ["owner-1", "recipient-2", "recipient-3"].sort(),
        "every participant receives at least one asset status update",
      );
    } finally {
      statusSpy.mock.restore();
      autoEvalSpy.mock.restore();
    }
  });

  it("override does not push to strangers (no share row)", async () => {
    const { app, storage, boardId, b } = await setupSharedBatch("recipient-2");
    // "stranger-9" has no share row on this board.

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(
        app,
        "POST",
        `/api/boards/${boardId}/batches/batch-x/winner`,
        { winnerAssetId: b.id },
      );
      assert.equal(res.status, 200);
      const calls = statusSpy.mock.calls.map((c) => c.arguments as [string, { assetId: string }]);
      const recipientsSeen = new Set(calls.map((c) => c[0]));
      assert.ok(!recipientsSeen.has("stranger-9"));
      // Sanity: we did broadcast to the legitimate participants so the
      // negative assertion above is meaningful.
      assert.ok(recipientsSeen.has("owner-1"));
      assert.ok(recipientsSeen.has("recipient-2"));
      // Storage was seeded with one share recipient ("recipient-2") so the
      // total recipient set must be exactly {owner-1, recipient-2}.
      assert.deepEqual(
        [...recipientsSeen].sort(),
        ["owner-1", "recipient-2"].sort(),
      );
    } finally {
      statusSpy.mock.restore();
    }
  });
});

// ----------------------------------------------------------------------
// Live broadcast for the *initial* generation pass (Task #241): when a
// collaborator starts a chat-mode "create" batch on a shared board, every
// queued → ready / failed status flip in `runDispatchersForBatch` must
// fan out to owner + every share recipient (not just the actor) so other
// participants see the new tiles flip from "Generating…" to the finished
// image without a manual refresh.
// ----------------------------------------------------------------------
describe("Chat-mode create fans out generation progress to every collaborator (Task #241)", () => {
  // Build an isolated app + storage where the chat route is wired with
  // injected stubs for dispatchOne / dispatchImage / autoEvaluateBatch so
  // the test stays hermetic (no real OpenAI/Luma/etc. calls) and we can
  // observe every status flip via the spy on `notifyBoardAssetStatus`.
  function buildAppWithChatStubs(asUser: string): {
    app: Express;
    storage: FakeBoardsStorage;
    awaitBatches: () => Promise<void>;
  } {
    const app: Express = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { id: asUser, type: "agent", email: "test@example.com" };
      next();
    });
    const storage = new FakeBoardsStorage();
    const storageAsInterface = storage as unknown as IStorage;
    registerBoardsRoutes(app, { storage: storageAsInterface });

    let imageCount = 0;
    const dispatchImage: DispatchImage = async (provider) => {
      imageCount += 1;
      return {
        modelLabel: `${provider}-stub`,
        imageUrl: `https://example.com/generated-${imageCount}.png`,
        edited: false,
      };
    };
    const dispatchOne: DispatchOne = async (provider): Promise<DispatchResult> => {
      // Stubbed for completeness per the task description; the image
      // provider used in this test never reaches the video dispatch path.
      return {
        taskId: "stub-task",
        modelLabel: `${provider}-stub`,
        poll: async () => ({ status: "completed", videoUrl: "https://example.com/v.mp4" }),
      };
    };
    const autoEvaluateBatch = async () => {
      // No-op evaluation: the route only invokes this when there are >=2
      // ready/rejected candidates, so it's wired for hermeticity but the
      // result is intentionally inert (no winner match -> no extra
      // status flips that could confuse the recipient assertions).
      return { winnerAssetId: "noop", modelUsed: "heuristic", rejected: [] };
    };

    // Capture the in-flight background batch so the test can await every
    // queued -> ready status flip before inspecting the spy.
    const inFlight: Promise<void>[] = [];
    registerBoardsChatRoutes(app, {
      storage: storageAsInterface,
      dispatchImage,
      dispatchOne,
      autoEvaluateBatch,
      onBatchScheduled: (p) => inFlight.push(p),
    });
    return {
      app,
      storage,
      awaitBatches: async () => {
        await Promise.all(inFlight);
      },
    };
  }

  it("collaborator-initiated image batch broadcasts queued + ready frames to owner + every share recipient", async () => {
    const { app, storage, awaitBatches } = buildAppWithChatStubs("recipient-2");
    const board = await storage.createBoard({ userId: "owner-1", title: "Shared canvas" });
    // Two share recipients so we prove fan-out reaches the whole audience,
    // not just the actor.
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    await storage.shareBoard(board.id, "owner-1", "recipient-3");

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(app, "POST", `/api/boards/${board.id}/chat`, {
        message: "draw a calm landscape",
        mode: "create",
        provider: "openai-image",
        variations: 2,
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      // Drain the background batch promise so every status flip has
      // landed before we inspect the spy.
      await awaitBatches();

      const calls = statusSpy.mock.calls.map(
        (c) => c.arguments as [string, { assetId: string; status: string }],
      );

      // Each of the 2 variations should produce two frames per recipient:
      // queued (status="generating") and ready. With 3 participants
      // (owner-1, recipient-2, recipient-3) that's 12 calls minimum.
      // Group calls by assetId to verify each tile is broadcast to every
      // participant for both lifecycle stages.
      const byAsset = new Map<string, Array<[string, string]>>();
      for (const [uid, payload] of calls) {
        const arr = byAsset.get(payload.assetId) ?? [];
        arr.push([uid, payload.status]);
        byAsset.set(payload.assetId, arr);
      }
      assert.equal(byAsset.size, 2, "two variations should each emit status frames");
      for (const [assetId, frames] of byAsset) {
        const recipientsForAsset = new Set(frames.map(([uid]) => uid));
        assert.deepEqual(
          [...recipientsForAsset].sort(),
          ["owner-1", "recipient-2", "recipient-3"].sort(),
          `asset ${assetId} should be broadcast to every participant`,
        );
        const statuses = new Set(frames.map(([, s]) => s));
        assert.ok(
          statuses.has("generating"),
          `asset ${assetId} should emit a queued/generating frame`,
        );
        assert.ok(
          statuses.has("ready"),
          `asset ${assetId} should emit a ready frame after dispatch`,
        );
      }
    } finally {
      statusSpy.mock.restore();
    }
  });

  it("does not push generation progress to strangers (no share row)", async () => {
    const { app, storage, awaitBatches } = buildAppWithChatStubs("recipient-2");
    const board = await storage.createBoard({ userId: "owner-1", title: "Shared canvas" });
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    // "stranger-9" is intentionally not added as a share recipient.

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(app, "POST", `/api/boards/${board.id}/chat`, {
        message: "another landscape",
        mode: "create",
        provider: "openai-image",
        variations: 1,
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      await awaitBatches();

      const recipientsSeen = new Set(
        statusSpy.mock.calls.map((c) => (c.arguments as [string])[0]),
      );
      assert.ok(!recipientsSeen.has("stranger-9"));
      // Sanity: the legitimate participants did receive frames so the
      // negative assertion above is meaningful.
      assert.deepEqual(
        [...recipientsSeen].sort(),
        ["owner-1", "recipient-2"].sort(),
      );
    } finally {
      statusSpy.mock.restore();
    }
  });
});

describe("Non-chat board entry points fan out asset progress to every collaborator (Task #242)", () => {
  // Sibling coverage to the chat-mode test above: the upload (POST
  // /api/boards/:id/assets) and the status-flip PATCH (PATCH
  // /api/boards/:id/assets/:assetId) flows must broadcast queued/
  // generating/ready/failed frames to every connected board participant
  // (owner + every share recipient + actor), not just the actor — without
  // this a stranger viewing a shared board would see uploaded tiles
  // appear silently after a manual refresh, or watch a generation tile
  // sit on "Generating…" forever when the upstream PATCH lands.
  it("POST /assets broadcasts the new tile to owner + every share recipient", async () => {
    const { app, storage } = buildApp("recipient-2");
    const board = await storage.createBoard({
      userId: "owner-1",
      title: "Shared canvas",
    });
    // Two share recipients to prove fan-out reaches the whole audience,
    // not just the actor.
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    await storage.shareBoard(board.id, "owner-1", "recipient-3");

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(app, "POST", `/api/boards/${board.id}/assets`, {
        batchId: "upload-batch",
        batchLabel: "Uploaded image",
        kind: "image",
        provider: "upload",
        status: "ready",
        assetUrl: "https://example.com/uploaded.png",
        thumbnailUrl: "https://example.com/uploaded.png",
        positionX: 40,
        positionY: 40,
        width: 256,
        height: 256,
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const recipientsSeen = new Set(
        statusSpy.mock.calls.map((c) => (c.arguments as [string])[0]),
      );
      assert.deepEqual(
        [...recipientsSeen].sort(),
        ["owner-1", "recipient-2", "recipient-3"].sort(),
        "every board participant should receive the new-tile frame",
      );
      // And every frame should carry the actual ready URL the actor just
      // posted, so the collaborator's canvas can show the image rather
      // than a placeholder skeleton.
      for (const c of statusSpy.mock.calls) {
        const payload = (c.arguments as [string, { status: string; assetUrl: string | null }])[1];
        assert.equal(payload.status, "ready");
        assert.equal(payload.assetUrl, "https://example.com/uploaded.png");
      }
    } finally {
      statusSpy.mock.restore();
    }
  });

  it("POST /assets does not push to strangers (no share row)", async () => {
    const { app, storage } = buildApp("recipient-2");
    const board = await storage.createBoard({
      userId: "owner-1",
      title: "Shared canvas",
    });
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    // "stranger-9" is intentionally not added as a share recipient.

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(app, "POST", `/api/boards/${board.id}/assets`, {
        batchId: "upload-batch",
        kind: "image",
        provider: "upload",
        status: "ready",
        assetUrl: "https://example.com/u.png",
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const recipientsSeen = new Set(
        statusSpy.mock.calls.map((c) => (c.arguments as [string])[0]),
      );
      assert.ok(!recipientsSeen.has("stranger-9"));
      // Sanity: the legitimate participants did receive frames so the
      // negative assertion above is meaningful.
      assert.deepEqual(
        [...recipientsSeen].sort(),
        ["owner-1", "recipient-2"].sort(),
      );
    } finally {
      statusSpy.mock.restore();
    }
  });

  it("PATCH /assets/:assetId fans status flips out to every collaborator", async () => {
    const { app, storage } = buildApp("owner-1");
    const board = await storage.createBoard({
      userId: "owner-1",
      title: "Shared canvas",
    });
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    await storage.shareBoard(board.id, "owner-1", "recipient-3");
    // Seed a generating tile (e.g. a queued upload waiting on a backend
    // post-processing step) so the PATCH below flips it to ready.
    const seed = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "upload-batch",
      kind: "image",
      provider: "upload",
      status: "generating",
    });
    assert.ok(seed, "seed asset should be created");

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(
        app,
        "PATCH",
        `/api/boards/${board.id}/assets/${seed!.id}`,
        {
          status: "ready",
          assetUrl: "https://example.com/processed.png",
          thumbnailUrl: "https://example.com/processed.png",
        },
      );
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const recipientsSeen = new Set(
        statusSpy.mock.calls.map((c) => (c.arguments as [string])[0]),
      );
      assert.deepEqual(
        [...recipientsSeen].sort(),
        ["owner-1", "recipient-2", "recipient-3"].sort(),
        "PATCH status flip should broadcast to every board participant",
      );
      // Every frame should carry the new ready status + the resolved URL
      // so the collaborator's tile flips out of the "Generating…"
      // placeholder.
      for (const c of statusSpy.mock.calls) {
        const payload = (c.arguments as [string, { status: string; assetUrl: string | null }])[1];
        assert.equal(payload.status, "ready");
        assert.equal(payload.assetUrl, "https://example.com/processed.png");
      }
    } finally {
      statusSpy.mock.restore();
    }
  });

  it("PATCH /assets/:assetId without status/url changes does not push a status frame", async () => {
    // Drag-only / inline-edit-only PATCHes already broadcast via
    // `notifyBoardAssetUpdated`; we must not also fire a redundant
    // `pushAssetStatus` for them or every tile drag would emit two
    // frames per participant.
    const { app, storage } = buildApp("owner-1");
    const board = await storage.createBoard({
      userId: "owner-1",
      title: "Shared canvas",
    });
    await storage.shareBoard(board.id, "owner-1", "recipient-2");
    const seed = await storage.createBoardAssetForUser(board.id, "owner-1", {
      batchId: "upload-batch",
      kind: "image",
      provider: "upload",
      status: "ready",
      assetUrl: "https://example.com/x.png",
    });
    assert.ok(seed);

    const statusSpy = mock.method(realtimeService, "notifyBoardAssetStatus", () => {});
    try {
      const res = await callJson(
        app,
        "PATCH",
        `/api/boards/${board.id}/assets/${seed!.id}`,
        { positionX: 100, positionY: 200 },
      );
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(
        statusSpy.mock.calls.length,
        0,
        "drag-only PATCH must not emit a status_update frame",
      );
    } finally {
      statusSpy.mock.restore();
    }
  });
});

describe("Drawing asset content sanitization", () => {
  const validDrawing = JSON.stringify({
    v: 1,
    width: 480,
    height: 320,
    strokes: [
      { color: "#111827", width: 3, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
    ],
  });

  it("accepts a valid drawing payload on POST", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const res = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: validDrawing,
    });
    assert.equal(res.status, 200);
    assert.equal((res.body as { kind: string }).kind, "drawing");
    assert.ok((res.body as { content: string }).content);
  });

  it("rejects non-JSON drawing content on POST", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const res = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: "<svg><script>alert(1)</script></svg>",
    });
    assert.equal(res.status, 400);
    assert.equal((res.body as { error: string }).error, "Invalid body");
  });

  it("rejects drawing payloads with disallowed colors (e.g. url(...))", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const malicious = JSON.stringify({
      v: 1,
      width: 480,
      height: 320,
      strokes: [
        {
          color: "url(#xss)",
          width: 3,
          points: [{ x: 1, y: 2 }],
        },
      ],
    });
    const res = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: malicious,
    });
    assert.equal(res.status, 400);
  });

  it("strips unknown fields from drawing payloads on POST", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const tainted = JSON.stringify({
      v: 1,
      width: 480,
      height: 320,
      strokes: [
        { color: "#111827", width: 3, points: [{ x: 1, y: 2 }] },
      ],
      __proto__: { evil: true },
      foreign: "<script>alert(1)</script>",
    });
    const res = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: tainted,
    });
    assert.equal(res.status, 200);
    const stored = JSON.parse((res.body as { content: string }).content);
    assert.deepEqual(Object.keys(stored).sort(), ["height", "strokes", "v", "width"]);
  });

  it("rejects invalid drawing payloads on PATCH for drawing assets", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const drawing = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: validDrawing,
    } as BoardAssetCreate);
    const res = await callJson(
      app,
      "PATCH",
      `/api/boards/${boardId}/assets/${drawing!.id}`,
      { content: "<svg onload=alert(1)/>" },
    );
    assert.equal(res.status, 400);
  });

  it("accepts a large (>10k) valid drawing payload on PATCH for drawing assets", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const drawing = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: validDrawing,
    } as BoardAssetCreate);
    // Build a payload that serializes well above the 10k free-text cap but
    // well under the 100k drawing schema cap to prove the cap parity fix.
    const points = Array.from({ length: 1500 }, (_, i) => ({ x: i, y: i * 0.5 }));
    const big = JSON.stringify({
      v: 1,
      width: 480,
      height: 320,
      strokes: [{ color: "#111827", width: 3, points }],
    });
    assert.ok(big.length > 10_000, "test payload should exceed the legacy 10k cap");
    const res = await callJson(
      app,
      "PATCH",
      `/api/boards/${boardId}/assets/${drawing!.id}`,
      { content: big },
    );
    assert.equal(res.status, 200);
    assert.ok((res.body as { content: string }).content.length > 10_000);
  });

  it("strips unknown fields from drawing payloads on PATCH", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const drawing = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: validDrawing,
    } as BoardAssetCreate);
    const tainted = JSON.stringify({
      v: 1,
      width: 480,
      height: 320,
      strokes: [{ color: "#111827", width: 3, points: [{ x: 1, y: 2 }] }],
      foreign: "<script>alert(1)</script>",
    });
    const res = await callJson(
      app,
      "PATCH",
      `/api/boards/${boardId}/assets/${drawing!.id}`,
      { content: tainted },
    );
    assert.equal(res.status, 200);
    const stored = JSON.parse((res.body as { content: string }).content);
    assert.deepEqual(Object.keys(stored).sort(), ["height", "strokes", "v", "width"]);
  });

  it("rejects drawing payloads larger than DRAWING_MAX_CONTENT_BYTES on POST", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    // Build a syntactically valid drawing JSON whose serialized size exceeds
    // the schema-level byte ceiling. We pad with extra points until the JSON
    // string is over DRAWING_MAX_CONTENT_BYTES.
    const points = Array.from({ length: 4000 }, (_, i) => ({ x: i, y: i }));
    const oversized = JSON.stringify({
      v: 1,
      width: 480,
      height: 320,
      strokes: [{ color: "#111827", width: 3, points }],
    });
    assert.ok(
      oversized.length > DRAWING_MAX_CONTENT_BYTES,
      "test payload should exceed the schema-level byte ceiling",
    );
    const res = await callJson(app, "POST", `/api/boards/${boardId}/assets`, {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: oversized,
    });
    assert.equal(res.status, 400);
  });

  it("rejects drawing payloads larger than DRAWING_MAX_CONTENT_BYTES on PATCH", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const drawing = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "draw-batch",
      kind: "drawing",
      provider: "tool",
      content: validDrawing,
    } as BoardAssetCreate);
    const points = Array.from({ length: 4000 }, (_, i) => ({ x: i, y: i }));
    const oversized = JSON.stringify({
      v: 1,
      width: 480,
      height: 320,
      strokes: [{ color: "#111827", width: 3, points }],
    });
    assert.ok(
      oversized.length > DRAWING_MAX_CONTENT_BYTES,
      "test payload should exceed the schema-level byte ceiling",
    );
    const res = await callJson(
      app,
      "PATCH",
      `/api/boards/${boardId}/assets/${drawing!.id}`,
      { content: oversized },
    );
    assert.equal(res.status, 400);
  });

  it("rejects oversized free-text content on PATCH for non-drawing assets", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const sticky = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "sticky-batch",
      kind: "sticky",
      provider: "tool",
      content: "Note",
    } as BoardAssetCreate);
    const res = await callJson(
      app,
      "PATCH",
      `/api/boards/${boardId}/assets/${sticky!.id}`,
      { content: "x".repeat(10_001) },
    );
    assert.equal(res.status, 400);
  });

  it("PATCH /api/boards/:id accepts a valid chatHistoryCap and persists it on the board", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string; chatHistoryCap?: number }).id;
    // Default is the historical 200, since createBoard didn't set it.
    const before = await callJson(app, "GET", `/api/boards/${boardId}`);
    assert.equal((before.body as { chatHistoryCap: number }).chatHistoryCap, 200);

    const updated = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      chatHistoryCap: 50,
    });
    assert.equal(updated.status, 200);
    assert.equal((updated.body as { chatHistoryCap: number }).chatHistoryCap, 50);

    const after = await callJson(app, "GET", `/api/boards/${boardId}`);
    assert.equal((after.body as { chatHistoryCap: number }).chatHistoryCap, 50);
  });

  it("PATCH /api/boards/:id rejects chatHistoryCap below the documented minimum", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;

    const res = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      chatHistoryCap: 5,
    });
    assert.equal(res.status, 400);
    // The board row must not have been mutated by a rejected request.
    const after = await callJson(app, "GET", `/api/boards/${boardId}`);
    assert.equal((after.body as { chatHistoryCap: number }).chatHistoryCap, 200);
  });

  it("PATCH /api/boards/:id rejects chatHistoryCap above the documented maximum", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;

    const res = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      chatHistoryCap: 5000,
    });
    assert.equal(res.status, 400);
  });

  it("PATCH /api/boards/:id rejects a non-integer chatHistoryCap", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;

    const fractional = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      chatHistoryCap: 42.5,
    });
    assert.equal(fractional.status, 400);

    const wrongType = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      chatHistoryCap: "100",
    });
    assert.equal(wrongType.status, 400);
  });

  it("PATCH /api/boards/:id round-trips notifyOnCollaboratorChange (Task #218 / #219)", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string; notifyOnCollaboratorChange?: boolean }).id;
    // New boards default to unmuted (true).
    const before = await callJson(app, "GET", `/api/boards/${boardId}`);
    assert.equal(
      (before.body as { notifyOnCollaboratorChange: boolean }).notifyOnCollaboratorChange,
      true,
    );

    // Mute the board.
    const muted = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      notifyOnCollaboratorChange: false,
    });
    assert.equal(muted.status, 200);
    assert.equal(
      (muted.body as { notifyOnCollaboratorChange: boolean }).notifyOnCollaboratorChange,
      false,
    );
    const afterMute = await callJson(app, "GET", `/api/boards/${boardId}`);
    assert.equal(
      (afterMute.body as { notifyOnCollaboratorChange: boolean }).notifyOnCollaboratorChange,
      false,
    );

    // Unmute again.
    const unmuted = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      notifyOnCollaboratorChange: true,
    });
    assert.equal(unmuted.status, 200);
    assert.equal(
      (unmuted.body as { notifyOnCollaboratorChange: boolean }).notifyOnCollaboratorChange,
      true,
    );
  });

  it("PATCH /api/boards/:id rejects a non-boolean notifyOnCollaboratorChange", async () => {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;

    const res = await callJson(app, "PATCH", `/api/boards/${boardId}`, {
      notifyOnCollaboratorChange: "false",
    });
    assert.equal(res.status, 400);
    // Row must not have been mutated by a rejected request.
    const after = await callJson(app, "GET", `/api/boards/${boardId}`);
    assert.equal(
      (after.body as { notifyOnCollaboratorChange: boolean }).notifyOnCollaboratorChange,
      true,
    );
  });

  it("PATCH /api/boards/:id with chatHistoryCap on a board the caller does not own returns 404", async () => {
    const ownerApp = buildApp("owner-1");
    const created = await callJson(ownerApp.app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;

    const otherApp = buildApp("intruder-1");
    const res = await callJson(otherApp.app, "PATCH", `/api/boards/${boardId}`, {
      chatHistoryCap: 50,
    });
    assert.equal(res.status, 404);
  });

  it("does not validate content for non-drawing assets on PATCH", async () => {
    const { app, storage } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    const sticky = await storage.createBoardAssetForUser(boardId, "user-1", {
      batchId: "sticky-batch",
      kind: "sticky",
      provider: "tool",
      content: "Note",
    } as BoardAssetCreate);
    const res = await callJson(
      app,
      "PATCH",
      `/api/boards/${boardId}/assets/${sticky!.id}`,
      { content: "Updated note text" },
    );
    assert.equal(res.status, 200);
    assert.equal((res.body as { content: string }).content, "Updated note text");
  });
});

// =====================================================
// Asset endpoint smoke tests
// =====================================================
describe("/api/boards/:id/assets CRUD smoke", () => {
  it("creates an asset and returns its full row", async () => {
    const { app } = buildApp();
    const board = await callJson(app, "POST", "/api/boards", { title: "B" });
    const id = board.body.id;

    const created = await callJson(app, "POST", `/api/boards/${id}/assets`, {
      batchId: "batch-1",
      batchLabel: "Batch 1",
      kind: "image",
      provider: "luma",
      assetUrl: "https://example.com/x.png",
      thumbnailUrl: "https://example.com/x-thumb.png",
      status: "ready",
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.boardId, id);
    assert.equal(created.body.kind, "image");
    assert.equal(created.body.provider, "luma");
    assert.equal(created.body.batchId, "batch-1");
    assert.equal(created.body.assetUrl, "https://example.com/x.png");
    assert.equal(created.body.status, "ready");
  });

  it("rejects asset payload with invalid kind / provider", async () => {
    const { app } = buildApp();
    const board = await callJson(app, "POST", "/api/boards", { title: "B" });
    const id = board.body.id;

    const bad1 = await callJson(app, "POST", `/api/boards/${id}/assets`, {
      batchId: "b", kind: "audio-bad", provider: "luma",
    });
    assert.equal(bad1.status, 400);

    const bad2 = await callJson(app, "POST", `/api/boards/${id}/assets`, {
      batchId: "b", kind: "image", provider: "not-a-provider",
    });
    assert.equal(bad2.status, 400);

    const bad3 = await callJson(app, "POST", `/api/boards/${id}/assets`, {
      kind: "image", provider: "luma", // missing batchId
    });
    assert.equal(bad3.status, 400);
  });

  it("returns 404 when creating an asset on an unknown board", async () => {
    const { app } = buildApp();
    const res = await callJson(app, "POST", `/api/boards/missing/assets`, {
      batchId: "b", kind: "image", provider: "luma",
    });
    assert.equal(res.status, 404);
  });

  it("patches an asset's position and status", async () => {
    const { app } = buildApp();
    const board = await callJson(app, "POST", "/api/boards", { title: "B" });
    const id = board.body.id;
    const created = await callJson(app, "POST", `/api/boards/${id}/assets`, {
      batchId: "b", kind: "image", provider: "luma",
    });
    const aid = created.body.id;

    const patched = await callJson(app, "PATCH", `/api/boards/${id}/assets/${aid}`, {
      positionX: 200,
      positionY: 300,
      status: "ready",
      assetUrl: "https://example.com/y.png",
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.positionX, 200);
    assert.equal(patched.body.positionY, 300);
    assert.equal(patched.body.status, "ready");
    assert.equal(patched.body.assetUrl, "https://example.com/y.png");
  });

  it("rejects invalid asset patch (bad status)", async () => {
    const { app } = buildApp();
    const board = await callJson(app, "POST", "/api/boards", { title: "B" });
    const id = board.body.id;
    const created = await callJson(app, "POST", `/api/boards/${id}/assets`, {
      batchId: "b", kind: "image", provider: "luma",
    });
    const aid = created.body.id;

    const bad = await callJson(app, "PATCH", `/api/boards/${id}/assets/${aid}`, {
      status: "totally-bogus",
    });
    assert.equal(bad.status, 400);
  });

  it("returns 404 when patching an unknown asset", async () => {
    const { app } = buildApp();
    const board = await callJson(app, "POST", "/api/boards", { title: "B" });
    const id = board.body.id;
    const res = await callJson(app, "PATCH", `/api/boards/${id}/assets/missing`, {
      positionX: 1,
    });
    assert.equal(res.status, 404);
  });

  it("deletes an asset and returns 404 thereafter", async () => {
    const { app } = buildApp();
    const board = await callJson(app, "POST", "/api/boards", { title: "B" });
    const id = board.body.id;
    const created = await callJson(app, "POST", `/api/boards/${id}/assets`, {
      batchId: "b", kind: "image", provider: "luma",
    });
    const aid = created.body.id;

    const del = await callJson(app, "DELETE", `/api/boards/${id}/assets/${aid}`);
    assert.equal(del.status, 200);
    assert.deepEqual(del.body, { success: true });

    // Asset is gone — patch returns 404.
    const after = await callJson(app, "PATCH", `/api/boards/${id}/assets/${aid}`, {
      positionX: 0,
    });
    assert.equal(after.status, 404);
  });

  it("returns 404 when deleting an unknown asset", async () => {
    const { app } = buildApp();
    const board = await callJson(app, "POST", "/api/boards", { title: "B" });
    const id = board.body.id;
    const del = await callJson(app, "DELETE", `/api/boards/${id}/assets/missing`);
    assert.equal(del.status, 404);
  });
});

// =====================================================
// Inline-edit broadcast: PATCH /api/boards/:id/assets/:assetId with a `content`
// change must fan out a `board_asset_updated` WS event to the owner and every
// share recipient (Task #158 wired this; Task #183 covers it with a test).
// =====================================================
describe("PATCH asset content broadcasts board_asset_updated", () => {
  it("notifies owner and every share recipient when content changes", async () => {
    const { app, storage } = buildApp("owner-1");
    const created = await callJson(app, "POST", "/api/boards", { title: "Shared" });
    const boardId = (created.body as { id: string }).id;
    await storage.shareBoard(boardId, "owner-1", "recipient-2");
    await storage.shareBoard(boardId, "owner-1", "recipient-3");
    const sticky = await storage.createBoardAssetForUser(boardId, "owner-1", {
      batchId: "sticky-batch",
      kind: "sticky",
      provider: "tool",
      content: "Hi",
    } as BoardAssetCreate);

    const spy = mock.method(realtimeService, "notifyBoardAssetUpdated", () => {});
    try {
      const res = await callJson(
        app,
        "PATCH",
        `/api/boards/${boardId}/assets/${sticky!.id}`,
        { content: "Updated copy" },
      );
      assert.equal(res.status, 200);
      assert.equal(spy.mock.calls.length, 1);
      const [userIds, payload] = spy.mock.calls[0].arguments as [
        string[],
        { boardId: string; batchId: string; assetId: string; content?: string | null },
      ];
      assert.deepEqual(
        [...userIds].sort(),
        ["owner-1", "recipient-2", "recipient-3"],
      );
      assert.equal(payload.boardId, boardId);
      assert.equal(payload.assetId, sticky!.id);
      assert.equal(payload.batchId, "sticky-batch");
      assert.equal(payload.content, "Updated copy");
    } finally {
      spy.mock.restore();
    }
  });

  it("broadcasts the new positionX/Y when a drag-only PATCH lands", async () => {
    const { app, storage } = buildApp("owner-1");
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    await storage.shareBoard(boardId, "owner-1", "recipient-2");
    const sticky = await storage.createBoardAssetForUser(boardId, "owner-1", {
      batchId: "sticky-batch",
      kind: "sticky",
      provider: "tool",
      content: "Hi",
    } as BoardAssetCreate);

    const spy = mock.method(realtimeService, "notifyBoardAssetUpdated", () => {});
    try {
      const res = await callJson(
        app,
        "PATCH",
        `/api/boards/${boardId}/assets/${sticky!.id}`,
        { positionX: 42, positionY: -7 },
      );
      assert.equal(res.status, 200);
      assert.equal(spy.mock.calls.length, 1);
      const [recipients, payload] = spy.mock.calls[0].arguments as [
        string[],
        {
          boardId: string;
          assetId: string;
          positionX?: number;
          positionY?: number;
          content?: string | null;
        },
      ];
      assert.deepEqual(recipients.sort(), ["owner-1", "recipient-2"].sort());
      assert.equal(payload.boardId, boardId);
      assert.equal(payload.assetId, sticky!.id);
      assert.equal(payload.positionX, 42);
      assert.equal(payload.positionY, -7);
      // Content was not part of the PATCH so it must not be in the payload.
      assert.equal(payload.content, undefined);
    } finally {
      spy.mock.restore();
    }
  });

  it("does not broadcast when the PATCH only changes non-broadcast fields", async () => {
    const { app, storage } = buildApp("owner-1");
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = (created.body as { id: string }).id;
    await storage.shareBoard(boardId, "owner-1", "recipient-2");
    const sticky = await storage.createBoardAssetForUser(boardId, "owner-1", {
      batchId: "sticky-batch",
      kind: "sticky",
      provider: "tool",
      content: "Hi",
    } as BoardAssetCreate);

    const spy = mock.method(realtimeService, "notifyBoardAssetUpdated", () => {});
    try {
      const res = await callJson(
        app,
        "PATCH",
        `/api/boards/${boardId}/assets/${sticky!.id}`,
        { width: 200 },
      );
      assert.equal(res.status, 200);
      assert.equal(spy.mock.calls.length, 0);
    } finally {
      spy.mock.restore();
    }
  });
});

// =====================================================
// Chat endpoint payload validation
// =====================================================
describe("POST /api/boards/:id/chat — payload validation", () => {
  async function withBoard(): Promise<{ app: Express; boardId: string }> {
    const { app } = buildApp();
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    return { app, boardId: created.body.id as string };
  }

  it("rejects when message is missing", async () => {
    const { app, boardId } = await withBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      mode: "brainstorm",
      provider: "luma",
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Invalid body");
  });

  it("rejects when message is empty string", async () => {
    const { app, boardId } = await withBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "",
      mode: "brainstorm",
      provider: "luma",
    });
    assert.equal(res.status, 400);
  });

  it("rejects when message exceeds max length", async () => {
    const { app, boardId } = await withBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "x".repeat(4001),
      mode: "brainstorm",
      provider: "luma",
    });
    assert.equal(res.status, 400);
  });

  it("rejects when mode is missing or invalid", async () => {
    const { app, boardId } = await withBoard();
    const missing = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "hi",
      provider: "luma",
    });
    assert.equal(missing.status, 400);

    const invalid = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "hi",
      mode: "explain",
      provider: "luma",
    });
    assert.equal(invalid.status, 400);
  });

  it("rejects when provider is invalid", async () => {
    const { app, boardId } = await withBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "hi",
      mode: "create",
      provider: "midjourney",
    });
    assert.equal(res.status, 400);
  });

  it("rejects when referencedAssetIds is not an array of strings", async () => {
    const { app, boardId } = await withBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "hi",
      mode: "create",
      provider: "luma",
      referencedAssetIds: [123, true],
    });
    assert.equal(res.status, 400);
  });

  it("rejects when variations is out of range", async () => {
    const { app, boardId } = await withBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "hi",
      mode: "create",
      provider: "luma",
      variations: 99,
    });
    assert.equal(res.status, 400);
  });

  it("rejects malformed conversationHistory entries", async () => {
    const { app, boardId } = await withBoard();
    const res = await callJson(app, "POST", `/api/boards/${boardId}/chat`, {
      message: "hi",
      mode: "brainstorm",
      provider: "luma",
      conversationHistory: [{ role: "system", content: "x" }],
    });
    assert.equal(res.status, 400);
  });
});

// =====================================================
// Chat router — gen-mode + provider-pick helpers
// =====================================================
describe("Board chat helpers — inferGenMode / pickDefaultProvider", () => {
  it("infers video-to-video when a video is referenced", () => {
    assert.equal(inferGenMode(["video"], "make it cinematic"), "video-to-video");
  });

  it("infers image-to-video when an image is referenced", () => {
    assert.equal(inferGenMode(["image"], "make it move"), "image-to-video");
  });

  it("infers text-to-video when no refs", () => {
    assert.equal(inferGenMode([], "a cat surfing"), "text-to-video");
  });

  it("honours explicit T2V mention even if a video is referenced", () => {
    assert.equal(inferGenMode(["video"], "ignore this video, t2v please"), "text-to-video");
  });

  it("picks Runway as the default v2v provider, Luma when explicitly mentioned", () => {
    assert.equal(pickDefaultProvider("video-to-video", "restyle this"), "runway");
    assert.equal(pickDefaultProvider("video-to-video", "use luma to restyle"), "luma");
  });

  it("picks Luma as the default i2v provider; respects keyword overrides", () => {
    assert.equal(pickDefaultProvider("image-to-video", "animate this"), "luma");
    assert.equal(pickDefaultProvider("image-to-video", "use kling please"), "kling");
    assert.equal(pickDefaultProvider("image-to-video", "use veo please"), "veo");
    assert.equal(pickDefaultProvider("image-to-video", "use runway please"), "runway");
  });

  it("picks Luma as the default t2v, with keyword overrides", () => {
    assert.equal(pickDefaultProvider("text-to-video", "a cat"), "luma");
    assert.equal(pickDefaultProvider("text-to-video", "try sora"), "sora2");
    assert.equal(pickDefaultProvider("text-to-video", "use seedance"), "seedance");
    assert.equal(pickDefaultProvider("text-to-video", "use runway"), "runway");
  });
});

// =====================================================
// Chat dispatch routing — mock-based per provider
// =====================================================
function makeAsset(over: Partial<BoardAsset>): BoardAsset {
  return {
    id: over.id ?? "ast_x",
    boardId: over.boardId ?? "brd_x",
    batchId: over.batchId ?? "b",
    batchLabel: over.batchLabel ?? null,
    kind: over.kind ?? "image",
    assetUrl: over.assetUrl ?? null,
    thumbnailUrl: over.thumbnailUrl ?? null,
    durationSeconds: over.durationSeconds ?? null,
    provider: over.provider ?? "luma",
    modelLabel: over.modelLabel ?? null,
    positionX: over.positionX ?? 0,
    positionY: over.positionY ?? 0,
    width: over.width ?? 320,
    height: over.height ?? 180,
    status: over.status ?? "queued",
    rejectionReason: over.rejectionReason ?? null,
    createdAt: over.createdAt ?? new Date(),
  };
}

type Restorable = { obj: Record<string, unknown>; key: string; original: unknown };
function patch(obj: Record<string, unknown>, key: string, value: unknown): Restorable {
  const original = obj[key];
  obj[key] = value;
  return { obj, key, original };
}
function restoreAll(patches: Restorable[]) {
  for (const p of patches) p.obj[p.key] = p.original;
}

describe("dispatchOne — provider routing matrix", () => {
  it("routes Luma t2v through lumaService.createVideoTask with default model", async () => {
    const calls: Array<{ prompt: string; opts: unknown }> = [];
    const patches = [
      patch(lumaService as unknown as Record<string, unknown>, "createVideoTask",
        async (prompt: string, opts: unknown) => {
          calls.push({ prompt, opts });
          return { taskId: "luma-task-1" };
        }),
      patch(lumaService as unknown as Record<string, unknown>, "getTaskStatus",
        async () => ({ status: "completed", videoUrl: "https://luma/out.mp4" })),
    ];
    try {
      const r = await dispatchOne("luma", "text-to-video", { prompt: "hello", refAssets: [] });
      assert.equal(r.taskId, "luma-task-1");
      assert.equal(r.modelLabel, "ray-2");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].prompt, "hello");
      const poll = await r.poll();
      assert.equal(poll.status, "completed");
      assert.equal(poll.videoUrl, "https://luma/out.mp4");
    } finally { restoreAll(patches); }
  });

  it("routes Luma i2v with the first referenced image as keyframe", async () => {
    const seen: { opts?: { keyframeImageUrl?: string; model?: string } } = {};
    const patches = [
      patch(lumaService as unknown as Record<string, unknown>, "createVideoTask",
        async (_p: string, opts: { keyframeImageUrl?: string; model?: string }) => {
          seen.opts = opts;
          return { taskId: "luma-task-2" };
        }),
      patch(lumaService as unknown as Record<string, unknown>, "getTaskStatus",
        async () => ({ status: "processing" })),
    ];
    try {
      const ref = makeAsset({ kind: "image", assetUrl: "https://img/a.png" });
      const r = await dispatchOne("luma", "image-to-video", { prompt: "p", refAssets: [ref], forceModel: "ray-flash-2" });
      assert.equal(seen.opts?.keyframeImageUrl, "https://img/a.png");
      assert.equal(r.modelLabel, "ray-flash-2");
    } finally { restoreAll(patches); }
  });

  it("routes Runway t2v / i2v / v2v to the right service methods", async () => {
    const seen: { method?: string; args?: unknown[] } = {};
    function makeStub(method: string) {
      return async (...args: unknown[]) => {
        seen.method = method; seen.args = args;
        return { taskId: `runway-${method}` };
      };
    }
    const patches = [
      patch(runwayService as unknown as Record<string, unknown>, "createTextToVideoTask", makeStub("t2v")),
      patch(runwayService as unknown as Record<string, unknown>, "createImageToVideoTask", makeStub("i2v")),
      patch(runwayService as unknown as Record<string, unknown>, "createVideoToVideoTask", makeStub("v2v")),
      patch(runwayService as unknown as Record<string, unknown>, "getTaskStatus",
        async () => ({ status: "completed", videoUrl: "https://r/x.mp4" })),
    ];
    try {
      const t = await dispatchOne("runway", "text-to-video", { prompt: "p", refAssets: [] });
      assert.equal(seen.method, "t2v");
      assert.equal(t.taskId, "runway-t2v");

      const img = makeAsset({ kind: "image", assetUrl: "https://img/a.png" });
      const i = await dispatchOne("runway", "image-to-video", { prompt: "p", refAssets: [img] });
      assert.equal(seen.method, "i2v");
      assert.equal(i.taskId, "runway-i2v");

      const vid = makeAsset({ kind: "video", assetUrl: "https://vid/a.mp4" });
      const v = await dispatchOne("runway", "video-to-video", { prompt: "p", refAssets: [vid] });
      assert.equal(seen.method, "v2v");
      assert.equal(v.taskId, "runway-v2v");

      const poll = await v.poll();
      assert.equal(poll.status, "completed");
      assert.equal(poll.videoUrl, "https://r/x.mp4");
    } finally { restoreAll(patches); }
  });

  it("Runway i2v throws without a referenced image", async () => {
    const patches = [
      patch(runwayService as unknown as Record<string, unknown>, "createImageToVideoTask",
        async () => ({ taskId: "should-not-be-called" })),
    ];
    try {
      await assert.rejects(
        () => dispatchOne("runway", "image-to-video", { prompt: "p", refAssets: [] }),
        /requires a referenced image/,
      );
    } finally { restoreAll(patches); }
  });

  it("Runway v2v throws without a referenced video", async () => {
    const patches = [
      patch(runwayService as unknown as Record<string, unknown>, "createVideoToVideoTask",
        async () => ({ taskId: "should-not-be-called" })),
    ];
    try {
      await assert.rejects(
        () => dispatchOne("runway", "video-to-video", { prompt: "p", refAssets: [] }),
        /requires a referenced video/,
      );
    } finally { restoreAll(patches); }
  });

  it("routes Sora2 through sora2Service.createVideoTask with imageUrls when present", async () => {
    const seen: { prompt?: string; opts?: { imageUrls?: string[] } } = {};
    const patches = [
      patch(sora2Service as unknown as Record<string, unknown>, "createVideoTask",
        async (prompt: string, opts: { imageUrls?: string[] }) => {
          seen.prompt = prompt; seen.opts = opts;
          return { taskId: "sora-1" };
        }),
      patch(sora2Service as unknown as Record<string, unknown>, "getTaskStatus",
        async () => ({ status: "completed", videoUrl: "https://sora/x.mp4" })),
    ];
    try {
      const img = makeAsset({ kind: "image", assetUrl: "https://img/p.png" });
      const r = await dispatchOne("sora2", "image-to-video", { prompt: "go", refAssets: [img] });
      assert.equal(r.taskId, "sora-1");
      assert.deepEqual(seen.opts?.imageUrls, ["https://img/p.png"]);
    } finally { restoreAll(patches); }
  });

  it("routes Veo to veoVideoService.generateVideo, requires an image", async () => {
    const patches = [
      patch(veoVideoService as unknown as Record<string, unknown>, "generateVideo",
        async () => ({ success: true, operationId: "veo-op-1" })),
      patch(veoVideoService as unknown as Record<string, unknown>, "checkOperationStatus",
        async () => ({ done: true, videoUrl: "https://veo/x.mp4" })),
    ];
    try {
      await assert.rejects(
        () => dispatchOne("veo", "image-to-video", { prompt: "p", refAssets: [] }),
        /requires a referenced image/,
      );
      const img = makeAsset({ kind: "image", assetUrl: "https://img/a.png" });
      const r = await dispatchOne("veo", "image-to-video", { prompt: "p", refAssets: [img] });
      assert.equal(r.taskId, "veo-op-1");
      const poll = await r.poll();
      assert.equal(poll.status, "completed");
      assert.equal(poll.videoUrl, "https://veo/x.mp4");
    } finally { restoreAll(patches); }
  });

  it("Veo bubbles up an error when generateVideo returns success=false", async () => {
    const patches = [
      patch(veoVideoService as unknown as Record<string, unknown>, "generateVideo",
        async () => ({ success: false, error: "quota exceeded" })),
    ];
    try {
      const img = makeAsset({ kind: "image", assetUrl: "https://img/a.png" });
      await assert.rejects(
        () => dispatchOne("veo", "image-to-video", { prompt: "p", refAssets: [img] }),
        /quota exceeded/,
      );
    } finally { restoreAll(patches); }
  });

  it("routes Seedance t2v via createTextToVideo and i2v via createImageToVideo", async () => {
    const seen: { method?: string } = {};
    const patches = [
      patch(seedanceService as unknown as Record<string, unknown>, "createTextToVideo",
        async () => { seen.method = "t2v"; return { taskId: "sd-t2v" }; }),
      patch(seedanceService as unknown as Record<string, unknown>, "createImageToVideo",
        async () => { seen.method = "i2v"; return { taskId: "sd-i2v" }; }),
      patch(seedanceService as unknown as Record<string, unknown>, "getStatus",
        async () => ({ status: "ready", videoUrl: "https://sd/x.mp4" })),
    ];
    try {
      const t = await dispatchOne("seedance", "text-to-video", { prompt: "p", refAssets: [] });
      assert.equal(seen.method, "t2v");
      assert.equal(t.taskId, "sd-t2v");

      const img = makeAsset({ kind: "image", assetUrl: "https://img/a.png" });
      const i = await dispatchOne("seedance", "image-to-video", { prompt: "p", refAssets: [img] });
      assert.equal(seen.method, "i2v");
      assert.equal(i.taskId, "sd-i2v");

      const poll = await i.poll();
      assert.equal(poll.status, "completed");
      assert.equal(poll.videoUrl, "https://sd/x.mp4");
    } finally { restoreAll(patches); }
  });
});
