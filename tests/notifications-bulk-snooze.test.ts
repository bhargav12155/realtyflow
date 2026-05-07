import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { registerNotificationsRoutes } from "../server/routes/notifications";
import type {
  InsertNotification,
  Notification,
  User,
} from "@shared/schema";
import type { IStorage } from "../server/storage";

// Minimal in-memory storage covering only the surface the notifications
// routes touch. Mirrors the production behavior of the snooze map being
// process-local.
class FakeStorage {
  notifications = new Map<string, Notification>();
  private snoozes = new Map<string, Date>();
  private idCounter = 0;
  users: User[] = [];

  async getUser(id: string): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }
  async createNotification(n: InsertNotification): Promise<Notification> {
    this.idCounter += 1;
    const created: Notification = {
      id: `ntf_${this.idCounter}`,
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
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }
  async markNotificationRead(id: string, userId: string) {
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
  async markNotificationsReadByType(
    userId: string,
    type: string,
  ): Promise<number> {
    let count = 0;
    for (const [id, n] of this.notifications) {
      if (n.userId === userId && !n.isRead && n.type === type) {
        this.notifications.set(id, { ...n, isRead: true });
        count += 1;
      }
    }
    return count;
  }
  async getAdminAlertSnoozeUntil(userId: string): Promise<Date | null> {
    const until = this.snoozes.get(userId);
    if (!until) return null;
    if (until.getTime() <= Date.now()) {
      this.snoozes.delete(userId);
      return null;
    }
    return until;
  }
  async setAdminAlertSnoozeUntil(
    userId: string,
    until: Date | null,
  ): Promise<void> {
    if (!until || until.getTime() <= Date.now()) {
      this.snoozes.delete(userId);
      return;
    }
    this.snoozes.set(userId, until);
  }
}

function buildApp(userId = "admin-1"): {
  app: Express;
  storage: FakeStorage;
} {
  const app: Express = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: userId, type: "agent", email: "admin@example.com" };
    next();
  });
  const storage = new FakeStorage();
  registerNotificationsRoutes(app, {
    storage: storage as unknown as IStorage,
  });
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
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* leave null */
    }
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

describe("/api/notifications/clear-by-type", () => {
  let app: Express;
  let storage: FakeStorage;

  beforeEach(async () => {
    ({ app, storage } = buildApp());
    await storage.createNotification({
      userId: "admin-1",
      type: "admin_alert",
      data: { source: "heygen", title: "drift A" },
    });
    await storage.createNotification({
      userId: "admin-1",
      type: "admin_alert",
      data: { source: "heygen", title: "drift B" },
    });
    await storage.createNotification({
      userId: "admin-1",
      type: "board_shared",
      data: { boardId: "b1" },
    });
    // Foreign user's notifications must never be touched.
    await storage.createNotification({
      userId: "other-user",
      type: "admin_alert",
      data: { source: "heygen", title: "other" },
    });
  });

  it("dismisses only the admin_alert rows for the caller", async () => {
    const res = await callJson(app, "POST", "/api/notifications/clear-by-type", {
      type: "admin_alert",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body?.updated, 2);
    assert.equal(res.body?.type, "admin_alert");

    const remaining = await storage.getNotificationsForUser("admin-1");
    const unread = remaining.filter((n) => !n.isRead);
    assert.equal(unread.length, 1);
    assert.equal(unread[0].type, "board_shared");

    const otherRemaining = await storage.getNotificationsForUser("other-user");
    assert.equal(otherRemaining[0].isRead, false, "other user's row untouched");
  });

  it("rejects unknown notification types", async () => {
    const res = await callJson(app, "POST", "/api/notifications/clear-by-type", {
      type: "something_else",
    });
    assert.equal(res.status, 400);
  });
});

describe("/api/notifications/admin-alert-snooze", () => {
  let app: Express;
  let storage: FakeStorage;

  beforeEach(() => {
    ({ app, storage } = buildApp());
  });

  it("returns null until before any snooze is set", async () => {
    const res = await callJson(
      app,
      "GET",
      "/api/notifications/admin-alert-snooze",
    );
    assert.equal(res.status, 200);
    assert.equal(res.body?.until, null);
  });

  it("sets, persists and clears a per-user snooze window", async () => {
    const set = await callJson(
      app,
      "POST",
      "/api/notifications/admin-alert-snooze",
      { minutes: 60 },
    );
    assert.equal(set.status, 200);
    const until = new Date(String(set.body?.until));
    const deltaMs = until.getTime() - Date.now();
    // Should be roughly 60 minutes ahead. Generous bounds for test jitter.
    assert.ok(
      deltaMs > 59 * 60_000 && deltaMs <= 61 * 60_000,
      `expected ~60min ahead, got ${deltaMs}ms`,
    );

    const get = await callJson(
      app,
      "GET",
      "/api/notifications/admin-alert-snooze",
    );
    assert.equal(get.body?.until, set.body?.until);

    // Sanity: the underlying storage exposes the same snooze.
    const stored = await storage.getAdminAlertSnoozeUntil("admin-1");
    assert.ok(stored && stored.getTime() === until.getTime());

    const clear = await callJson(
      app,
      "POST",
      "/api/notifications/admin-alert-snooze",
      { minutes: 0 },
    );
    assert.equal(clear.status, 200);
    assert.equal(clear.body?.until, null);

    const cleared = await storage.getAdminAlertSnoozeUntil("admin-1");
    assert.equal(cleared, null);
  });

  it("rejects negative or absurdly long snoozes", async () => {
    const negative = await callJson(
      app,
      "POST",
      "/api/notifications/admin-alert-snooze",
      { minutes: -5 },
    );
    assert.equal(negative.status, 400);

    const tooLong = await callJson(
      app,
      "POST",
      "/api/notifications/admin-alert-snooze",
      { minutes: 60 * 24 * 30 },
    );
    assert.equal(tooLong.status, 400);
  });
});
