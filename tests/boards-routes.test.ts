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
import { registerBoardsChatRoutes } from "../server/routes/boards-chat";
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

  it("does not broadcast when the PATCH does not include a content change", async () => {
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
        { positionX: 42 },
      );
      assert.equal(res.status, 200);
      assert.equal(spy.mock.calls.length, 0);
    } finally {
      spy.mock.restore();
    }
  });
});
