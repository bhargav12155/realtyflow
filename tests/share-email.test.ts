import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { registerBoardsRoutes } from "../server/routes/boards";
import {
  sendBoardSharedEmail,
  sendEmail,
  getAppBaseUrl,
} from "../server/services/mailer";
import type {
  Board,
  BoardAsset,
  BoardShare,
  InsertBoard,
  InsertNotification,
  Notification,
  User,
} from "@shared/schema";
import type {
  IStorage,
  AccessibleBoard,
  BoardShareRecipient,
  BoardUpdate,
  BoardAssetCreate,
  BoardAssetUpdate,
} from "../server/storage";

// =====================================================
// Minimal storage stub: only what POST /api/boards/:id/shares touches.
// We mirror the shape used by tests/boards-routes.test.ts but trimmed down.
// =====================================================
class FakeStorage {
  boards = new Map<string, Board>();
  shares = new Map<string, BoardShare>();
  notifications = new Map<string, Notification>();
  users: User[] = [];
  private idCounter = 0;
  private nextId(prefix: string) {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }
  async getUser(id: string): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }
  async getUsersByIds(ids: string[]): Promise<User[]> {
    const set = new Set(ids);
    return this.users.filter((u) => set.has(u.id));
  }
  async getAllUsers(): Promise<User[]> {
    return [...this.users];
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
  async getBoardByIdForUser(id: string, userId: string): Promise<Board | undefined> {
    const b = this.boards.get(id);
    return b && b.userId === userId ? b : undefined;
  }
  async getAccessibleBoardForUser(): Promise<AccessibleBoard | undefined> {
    return undefined;
  }
  async getAccessibleBoardsForUser(): Promise<AccessibleBoard[]> {
    return [];
  }
  async getBoardSharesForBoards(): Promise<Map<string, BoardShareRecipient[]>> {
    return new Map();
  }
  async getBoardShares(): Promise<BoardShareRecipient[]> {
    return [];
  }
  async shareBoard(
    boardId: string,
    ownerUserId: string,
    sharedWithUserId: string,
  ): Promise<BoardShare | undefined> {
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
  async unshareBoard(
    boardId: string,
    ownerUserId: string,
    sharedWithUserId: string,
  ): Promise<boolean> {
    const owner = await this.getBoardByIdForUser(boardId, ownerUserId);
    if (!owner) return false;
    const hit = Array.from(this.shares.entries()).find(
      ([, s]) => s.boardId === boardId && s.sharedWithUserId === sharedWithUserId,
    );
    if (!hit) return false;
    this.shares.delete(hit[0]);
    return true;
  }
  async leaveSharedBoard(): Promise<boolean> { return false; }
  async updateBoardForUser(): Promise<Board | undefined> { return undefined; }
  async deleteBoardForUser(): Promise<boolean> { return false; }
  async touchBoardForUser(): Promise<void> {}
  async getBoardAssetsForUser(): Promise<BoardAsset[]> { return []; }
  async getBoardAssetByIdForUser(): Promise<BoardAsset | undefined> { return undefined; }
  async createBoardAssetForUser(): Promise<BoardAsset | undefined> { return undefined; }
  async updateBoardAssetForUser(): Promise<BoardAsset | undefined> { return undefined; }
  async deleteBoardAssetForUser(): Promise<boolean> { return false; }
  async getBoardsByUserId(): Promise<Board[]> { return []; }
}

function makeUser(over: Partial<User>): User {
  return {
    id: "u",
    username: "u",
    password: "x",
    name: "U",
    email: "u@example.com",
    role: "agent",
    isDemo: false,
    emailNotifications: true,
    createdAt: new Date(),
    ...over,
  } as User;
}

function buildApp(userId: string): { app: Express; storage: FakeStorage } {
  const app: Express = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: userId, type: "agent", email: "owner@example.com" };
    next();
  });
  const storage = new FakeStorage();
  registerBoardsRoutes(app, { storage: storage as unknown as IStorage });
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

// =====================================================
// Fetch stub. The mailer talks to SendGrid via global fetch, so we install
// a per-test stub that captures every send and routes everything else
// (e.g. the supertest-style HTTP call to our own express app) to the
// real implementation.
// =====================================================
type SendGridCall = { headers: Record<string, string>; body: any };

const realFetch = globalThis.fetch.bind(globalThis);
let sendGridCalls: SendGridCall[] = [];
let sendGridResponder: () => Promise<Response> = async () =>
  new Response("", { status: 202 });

function installFetchStub() {
  sendGridCalls = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (url.startsWith("https://api.sendgrid.com/")) {
      const headers: Record<string, string> = {};
      const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
      for (const [k, v] of Object.entries(rawHeaders)) headers[k.toLowerCase()] = String(v);
      const bodyText = typeof init?.body === "string" ? init.body : "";
      let parsed: any = null;
      try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch { /* leave null */ }
      sendGridCalls.push({ headers, body: parsed });
      return sendGridResponder();
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
  sendGridResponder = async () => new Response("", { status: 202 });
}

// Snapshot env so a stray test can't leak credentials between cases.
const ENV_KEYS = ["SENDGRID_API_KEY", "MAIL_FROM_EMAIL", "MAIL_FROM_NAME", "APP_BASE_URL", "BASE_URL"] as const;
const savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.SENDGRID_API_KEY = "test-key";
  process.env.MAIL_FROM_EMAIL = "no-reply@example.com";
  process.env.APP_BASE_URL = "https://app.example.com";
  delete process.env.MAIL_FROM_NAME;
  delete process.env.BASE_URL;
  installFetchStub();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  restoreFetch();
});

// =====================================================
// Route-level tests: POST /api/boards/:id/shares email fan-out
// =====================================================
describe("POST /api/boards/:id/shares — email fan-out", () => {
  it("sends a SendGrid email on the happy path with the board title and deep link", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", username: "own", name: "Owner Person", email: "owner@example.com" }));
    storage.users.push(makeUser({ id: "rec-2", username: "rec", name: "Recipient", email: "rec@example.com" }));

    const created = await callJson(app, "POST", "/api/boards", { title: "Launch plan" });
    const boardId = created.body!.id as string;

    const shared = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "rec-2" });
    assert.equal(shared.status, 200);

    assert.equal(sendGridCalls.length, 1, "expected exactly one SendGrid send");
    const call = sendGridCalls[0];
    assert.equal(call.headers["authorization"], "Bearer test-key");
    assert.equal(call.body.from.email, "no-reply@example.com");
    const personalization = call.body.personalizations[0];
    assert.deepEqual(personalization.to[0], { email: "rec@example.com", name: "Recipient" });
    assert.equal(personalization.subject, 'Owner Person shared "Launch plan" with you');
    const html = call.body.content.find((c: { type: string }) => c.type === "text/html").value as string;
    const text = call.body.content.find((c: { type: string }) => c.type === "text/plain").value as string;
    const expectedUrl = `https://app.example.com/boards/${encodeURIComponent(boardId)}`;
    assert.ok(html.includes(expectedUrl), "html should include the deep link");
    assert.ok(html.includes("Launch plan"), "html should include the board title");
    assert.ok(text.includes(expectedUrl), "text should include the deep link");
    assert.ok(text.includes("Launch plan"), "text should include the board title");
  });

  it("skips the email when the recipient has emailNotifications=false", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", name: "Owner", email: "owner@example.com" }));
    storage.users.push(
      makeUser({ id: "rec-2", name: "Opted Out", email: "opt@example.com", emailNotifications: false }),
    );
    const created = await callJson(app, "POST", "/api/boards", { title: "Quiet Board" });
    const boardId = created.body!.id as string;

    const shared = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "rec-2" });
    assert.equal(shared.status, 200, "share itself still succeeds");
    assert.equal(sendGridCalls.length, 0, "no email should be sent when recipient opted out");
    // In-app notification still fires.
    assert.equal(storage.notifications.size, 1);
  });

  it("skips the email silently when the recipient has no email address", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", name: "Owner", email: "owner@example.com" }));
    // Force an empty email — the runtime user record can have a blank string
    // even though the column is notNull (e.g. legacy rows or social logins).
    storage.users.push(makeUser({ id: "rec-2", name: "No Email", email: "   " }));
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;

    const shared = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "rec-2" });
    assert.equal(shared.status, 200);
    assert.equal(sendGridCalls.length, 0);
  });

  it("does not fail the share when the mailer throws", async () => {
    sendGridResponder = async () => { throw new Error("kaboom"); };
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", name: "Owner", email: "owner@example.com" }));
    storage.users.push(makeUser({ id: "rec-2", name: "Recipient", email: "rec@example.com" }));
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;

    const shared = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "rec-2" });
    assert.equal(shared.status, 200, "share must succeed even when SendGrid throws");
    assert.equal((shared.body as { sharedWithUserId: string }).sharedWithUserId, "rec-2");
  });

  it("does not fail the share when SendGrid returns a non-2xx response", async () => {
    sendGridResponder = async () => new Response("rate limited", { status: 429 });
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", name: "Owner", email: "owner@example.com" }));
    storage.users.push(makeUser({ id: "rec-2", name: "Recipient", email: "rec@example.com" }));
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;

    const shared = await callJson(app, "POST", `/api/boards/${boardId}/shares`, { userId: "rec-2" });
    assert.equal(shared.status, 200);
    assert.equal(sendGridCalls.length, 1);
  });
});

// =====================================================
// Route-level tests: DELETE /api/boards/:id/shares/:userId
// notification + email fan-out (Task #214)
// =====================================================
describe("DELETE /api/boards/:id/shares/:userId — notification + email fan-out", () => {
  async function seedSharedBoard(): Promise<{ app: Express; storage: FakeStorage; boardId: string }> {
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", username: "own", name: "Owner Person", email: "owner@example.com" }));
    storage.users.push(makeUser({ id: "rec-2", username: "rec", name: "Recipient", email: "rec@example.com" }));
    const created = await callJson(app, "POST", "/api/boards", { title: "Quarterly Plan" });
    const boardId = created.body!.id as string;
    // Create the share directly so the POST email/notification side-effects
    // don't pollute our DELETE assertions.
    await storage.shareBoard(boardId, "owner-1", "rec-2");
    sendGridCalls = [];
    storage.notifications.clear();
    return { app, storage, boardId };
  }

  it("creates a board_unshared notification with boardId, boardTitle, removedByUserId and removedByName", async () => {
    const { app, storage, boardId } = await seedSharedBoard();

    const res = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/rec-2`);
    assert.equal(res.status, 200);

    const list = Array.from(storage.notifications.values()).filter((n) => n.userId === "rec-2");
    assert.equal(list.length, 1, "exactly one notification fired for the removed teammate");
    const n = list[0];
    assert.equal(n.type, "board_unshared");
    assert.equal(n.isRead, false);
    const data = n.data as {
      boardId: string;
      boardTitle: string;
      removedByUserId: string;
      removedByName: string | null;
    };
    assert.equal(data.boardId, boardId);
    assert.equal(data.boardTitle, "Quarterly Plan");
    assert.equal(data.removedByUserId, "owner-1");
    assert.equal(data.removedByName, "Owner Person");
  });

  it("falls back to the remover email when their display name is null", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push(
      makeUser({ id: "owner-1", username: "own", name: null as unknown as string, email: "owner@example.com" }),
    );
    storage.users.push(makeUser({ id: "rec-2", name: "Recipient", email: "rec@example.com" }));
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;
    await storage.shareBoard(boardId, "owner-1", "rec-2");
    sendGridCalls = [];
    storage.notifications.clear();

    const res = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/rec-2`);
    assert.equal(res.status, 200);

    const n = Array.from(storage.notifications.values())[0];
    const data = n.data as { removedByName: string | null };
    assert.equal(data.removedByName, "owner@example.com");
    // Email subject also reflects the email-as-name fallback.
    assert.equal(sendGridCalls.length, 1);
    assert.equal(
      sendGridCalls[0].body.personalizations[0].subject,
      'owner@example.com removed your access to "B"',
    );
  });

  it("sends a SendGrid email on the happy path with the board title and remover name", async () => {
    const { app, boardId } = await seedSharedBoard();

    const res = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/rec-2`);
    assert.equal(res.status, 200);

    assert.equal(sendGridCalls.length, 1, "expected exactly one SendGrid send");
    const call = sendGridCalls[0];
    assert.equal(call.headers["authorization"], "Bearer test-key");
    assert.equal(call.body.from.email, "no-reply@example.com");
    const personalization = call.body.personalizations[0];
    assert.deepEqual(personalization.to[0], { email: "rec@example.com", name: "Recipient" });
    assert.equal(personalization.subject, 'Owner Person removed your access to "Quarterly Plan"');
    const html = call.body.content.find((c: { type: string }) => c.type === "text/html").value as string;
    const text = call.body.content.find((c: { type: string }) => c.type === "text/plain").value as string;
    assert.ok(html.includes("Quarterly Plan"));
    assert.ok(html.includes("Owner Person"));
    assert.ok(text.includes("Quarterly Plan"));
    assert.ok(text.includes("Owner Person"));
  });

  it("skips the email when the recipient has emailNotifications=false but still creates the in-app notification", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", name: "Owner Person", email: "owner@example.com" }));
    storage.users.push(
      makeUser({ id: "rec-2", name: "Opted Out", email: "opt@example.com", emailNotifications: false }),
    );
    const created = await callJson(app, "POST", "/api/boards", { title: "Quiet Board" });
    const boardId = created.body!.id as string;
    await storage.shareBoard(boardId, "owner-1", "rec-2");
    sendGridCalls = [];
    storage.notifications.clear();

    const res = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/rec-2`);
    assert.equal(res.status, 200, "DELETE itself still succeeds");
    assert.equal(sendGridCalls.length, 0, "no email should be sent when recipient opted out");
    // The in-app bell entry must still fire so the user notices on next visit.
    const list = Array.from(storage.notifications.values()).filter((n) => n.userId === "rec-2");
    assert.equal(list.length, 1);
    assert.equal(list[0].type, "board_unshared");
  });

  it("skips the email silently when the recipient has no email address", async () => {
    const { app, storage } = buildApp("owner-1");
    storage.users.push(makeUser({ id: "owner-1", name: "Owner", email: "owner@example.com" }));
    storage.users.push(makeUser({ id: "rec-2", name: "No Email", email: "   " }));
    const created = await callJson(app, "POST", "/api/boards", { title: "B" });
    const boardId = created.body!.id as string;
    await storage.shareBoard(boardId, "owner-1", "rec-2");
    sendGridCalls = [];
    storage.notifications.clear();

    const res = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/rec-2`);
    assert.equal(res.status, 200);
    assert.equal(sendGridCalls.length, 0);
    // Notification still persisted so the bell can render it.
    assert.equal(storage.notifications.size, 1);
  });

  it("does not fail the unshare when the mailer throws", async () => {
    sendGridResponder = async () => { throw new Error("kaboom"); };
    const { app, boardId } = await seedSharedBoard();

    const res = await callJson(app, "DELETE", `/api/boards/${boardId}/shares/rec-2`);
    assert.equal(res.status, 200, "unshare must succeed even when SendGrid throws");
  });
});

// =====================================================
// Unit tests: sendBoardSharedEmail body construction
// =====================================================
describe("sendBoardSharedEmail body construction", () => {
  it("builds subject, deep link, and escapes HTML in the rendered content", async () => {
    const ok = await sendBoardSharedEmail({
      recipientEmail: "rec@example.com",
      recipientName: "Pat <O'Reilly>",
      sharerName: 'Sam "Tester" & Co',
      boardTitle: '<script>alert(1)</script> "Launch"',
      boardUrl: "https://app.example.com/boards/abc?x=1&y=2",
    });
    assert.equal(ok, true);
    assert.equal(sendGridCalls.length, 1);
    const call = sendGridCalls[0];

    // Subject keeps the raw (unescaped) names — it travels in a JSON string
    // header, not in HTML, so escaping there would actively corrupt it.
    assert.equal(
      call.body.personalizations[0].subject,
      'Sam "Tester" & Co shared "<script>alert(1)</script> "Launch"" with you',
    );

    const html = call.body.content.find((c: { type: string }) => c.type === "text/html").value as string;
    // HTML output must NOT contain the raw script tag — escaping should have
    // turned it into entities.
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    // Quotes/apostrophes/ampersands escaped wherever they're interpolated.
    assert.ok(html.includes("Pat &lt;O&#39;Reilly&gt;"));
    assert.ok(html.includes("Sam &quot;Tester&quot; &amp; Co"));
    // Deep link is preserved with its query string escaped (& -> &amp;).
    assert.ok(html.includes("https://app.example.com/boards/abc?x=1&amp;y=2"));

    const text = call.body.content.find((c: { type: string }) => c.type === "text/plain").value as string;
    // Plain text is intentionally NOT HTML-escaped.
    assert.ok(text.includes("https://app.example.com/boards/abc?x=1&y=2"));
    assert.ok(text.includes('Sam "Tester" & Co'));
  });

  it("falls back to a generic greeting when no recipient name is provided", async () => {
    await sendBoardSharedEmail({
      recipientEmail: "rec@example.com",
      recipientName: null,
      sharerName: "Sam",
      boardTitle: "Board",
      boardUrl: "https://app.example.com/boards/x",
    });
    const call = sendGridCalls[0];
    assert.deepEqual(call.body.personalizations[0].to[0], { email: "rec@example.com" });
    const text = call.body.content.find((c: { type: string }) => c.type === "text/plain").value as string;
    assert.ok(text.startsWith("Hi,\n"));
  });
});

// =====================================================
// Unit tests: sendEmail / getAppBaseUrl edge cases
// =====================================================
describe("sendEmail config guards", () => {
  it("returns false (no fetch) when SENDGRID_API_KEY is unset", async () => {
    delete process.env.SENDGRID_API_KEY;
    const ok = await sendEmail({
      to: "x@example.com",
      subject: "s",
      text: "t",
      html: "<p>h</p>",
    });
    assert.equal(ok, false);
    assert.equal(sendGridCalls.length, 0);
  });

  it("returns false (no fetch) when MAIL_FROM_EMAIL is unset", async () => {
    delete process.env.MAIL_FROM_EMAIL;
    const ok = await sendEmail({
      to: "x@example.com",
      subject: "s",
      text: "t",
      html: "<p>h</p>",
    });
    assert.equal(ok, false);
    assert.equal(sendGridCalls.length, 0);
  });
});

describe("getAppBaseUrl", () => {
  it("prefers APP_BASE_URL when set, stripping trailing slashes", () => {
    process.env.APP_BASE_URL = "https://app.example.com/";
    assert.equal(getAppBaseUrl("ignored.example.com"), "https://app.example.com");
  });
  it("falls back to the request host when no env var is present", () => {
    delete process.env.APP_BASE_URL;
    delete process.env.BASE_URL;
    assert.equal(getAppBaseUrl("req.example.com"), "https://req.example.com");
  });
  it("returns an empty string when neither env nor host is available", () => {
    delete process.env.APP_BASE_URL;
    delete process.env.BASE_URL;
    assert.equal(getAppBaseUrl(null), "");
  });
});
