import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, { type Express } from "express";
import {
  registerBoardsChatRoutes,
  __resetChatProviderHealthForTests,
  type BoardsChatProviders,
  type DispatchOne,
  type DispatchResult,
  type Provider,
  type GenMode,
  type GeminiImageService,
} from "../server/routes/boards-chat";
import OpenAI from "openai";
import type { Board, BoardAsset, InsertBoard } from "@shared/schema";
import type {
  IStorage,
  BoardAssetCreate,
  BoardAssetUpdate,
} from "../server/storage";
import type { AutoEvalResult } from "../server/services/boardAutoEval";

// =====================================================
// Minimal in-memory storage (only the surface board chat uses)
// =====================================================
class FakeStorage {
  boards = new Map<string, Board>();
  assets = new Map<string, BoardAsset>();
  private idCounter = 0;
  private nextId(p: string) {
    this.idCounter += 1;
    return `${p}_${this.idCounter}`;
  }

  async createBoard(input: InsertBoard): Promise<Board> {
    const now = new Date();
    const b: Board = {
      id: this.nextId("brd"),
      userId: input.userId,
      title: input.title ?? "Untitled",
      isShared: input.isShared ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.boards.set(b.id, b);
    return b;
  }
  async getBoardByIdForUser(id: string, userId: string) {
    const b = this.boards.get(id);
    return b && b.userId === userId ? b : undefined;
  }
  async getBoardAssetByIdForUser(boardId: string, assetId: string, userId: string) {
    const b = await this.getBoardByIdForUser(boardId, userId);
    if (!b) return undefined;
    const a = this.assets.get(assetId);
    return a && a.boardId === boardId ? a : undefined;
  }
  async getBoardAssetsForUser(boardId: string, userId: string) {
    const b = await this.getBoardByIdForUser(boardId, userId);
    if (!b) return [];
    return Array.from(this.assets.values()).filter((a) => a.boardId === boardId);
  }
  async createBoardAssetForUser(boardId: string, userId: string, asset: BoardAssetCreate) {
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
  async updateBoardAssetForUser(
    boardId: string,
    assetId: string,
    userId: string,
    updates: BoardAssetUpdate,
  ) {
    const a = await this.getBoardAssetByIdForUser(boardId, assetId, userId);
    if (!a) return undefined;
    const merged: BoardAsset = { ...a, ...updates };
    this.assets.set(assetId, merged);
    return merged;
  }
  // ----- Board chat messages (persisted history) -----
  messages: Array<{
    id: string;
    boardId: string;
    authorUserId: string | null;
    role: "user" | "assistant";
    content: string;
    notice: string | null;
    cta: { label: string; href: string; testId?: string } | null;
    createdAt: Date;
  }> = [];
  // Map of userId -> {name,email} so the with-authors read can join.
  users = new Map<string, { id: string; name: string | null; email: string | null }>();
  // Junction: which userIds a board has been shared with. Mirrors the real
  // board_shares table; getAccessibleBoardForUser consults it.
  shares = new Map<string, Set<string>>();
  shareBoardWith(boardId: string, userId: string) {
    const s = this.shares.get(boardId) ?? new Set<string>();
    s.add(userId);
    this.shares.set(boardId, s);
  }
  // Mirrors `IStorage.getBoardShares` for the recipient-resolution path
  // that the create-mode chat handler hits to fan out generation progress
  // (Task #241). Returns the share-with userIds for the board so the
  // chat route can broadcast queued/ready status flips to every
  // collaborator. Owner-gated like the real implementation.
  async getBoardShares(boardId: string, ownerUserId: string) {
    const owner = await this.getBoardByIdForUser(boardId, ownerUserId);
    if (!owner) return [];
    const ids = this.shares.get(boardId);
    if (!ids) return [];
    return Array.from(ids).map((userId) => {
      const u = this.users.get(userId);
      return {
        userId,
        name: u?.name ?? null,
        email: u?.email ?? null,
        sharedAt: null as Date | null,
      };
    });
  }
  async getAccessibleBoardForUser(id: string, userId: string) {
    const b = this.boards.get(id);
    if (!b) return undefined;
    if (b.userId === userId) return { ...b, isOwner: true };
    if (this.shares.get(id)?.has(userId)) return { ...b, isOwner: false };
    return undefined;
  }
  async getBoardMessagesForUser(boardId: string, userId: string) {
    const access = await this.getAccessibleBoardForUser(boardId, userId);
    if (!access) return [];
    return this.messages
      .filter((m) => m.boardId === boardId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async getBoardMessagesWithAuthorsForUser(boardId: string, userId: string) {
    const rows = await this.getBoardMessagesForUser(boardId, userId);
    return rows.map((m) => {
      const u = m.authorUserId ? this.users.get(m.authorUserId) : null;
      return {
        ...m,
        author: m.authorUserId
          ? {
              id: m.authorUserId,
              name: u?.name ?? null,
              email: u?.email ?? null,
            }
          : null,
      };
    });
  }
  async createBoardMessageForUser(
    boardId: string,
    userId: string,
    msg: {
      role: "user" | "assistant";
      content: string;
      notice?: string | null;
      cta?: { label: string; href: string; testId?: string } | null;
    },
  ) {
    const access = await this.getAccessibleBoardForUser(boardId, userId);
    if (!access) return undefined;
    const row = {
      id: this.nextId("msg"),
      boardId,
      authorUserId: userId,
      role: msg.role,
      content: msg.content,
      notice: msg.notice ?? null,
      cta: msg.cta ?? null,
      createdAt: new Date(Date.now() + this.messages.length),
    };
    this.messages.push(row);
    return row as any;
  }
}

// =====================================================
// Fake chat providers
// =====================================================
type ChatCall = {
  message: string;
  systemPrompt: string;
  images?: { url: string; mediaType?: string }[];
};

function makeFakeChat(label: string, opts: { fail?: boolean; empty?: boolean } = {}) {
  const calls: ChatCall[] = [];
  const svc = {
    calls,
    async chat(
      message: string,
      _h: any,
      systemPrompt: string,
      images?: { url: string; mediaType?: string }[],
    ) {
      calls.push({ message, systemPrompt, images });
      if (opts.fail) return { success: false, error: `${label} unavailable` };
      if (opts.empty) return { success: true, message: "" };
      return { success: true, message: `${label}: ${message}` };
    },
  };
  return svc;
}

function makeFakeOpenAIBrainstorm(opts: { reply?: string; fail?: boolean } = {}) {
  const calls: { message: string; images?: { url: string; mediaType?: string }[] }[] = [];
  return {
    calls,
    fn: async (
      message: string,
      _h?: { role: "user" | "assistant"; content: string }[],
      images?: { url: string; mediaType?: string }[],
    ) => {
      calls.push({ message, images });
      if (opts.fail) return { success: false, error: "openai unavailable" };
      return { success: true, message: opts.reply ?? `openai: ${message}` };
    },
  };
}

// =====================================================
// Build app helper with full DI
// =====================================================
interface BuildOpts {
  providers?: Partial<BoardsChatProviders>;
  dispatchOne?: DispatchOne;
  autoEvaluateBatch?: (i: { prompt: string; assets: BoardAsset[] }) => Promise<AutoEvalResult>;
  openaiClientFactory?: () => OpenAI;
  geminiImageService?: GeminiImageService;
}

interface BuildResult {
  app: Express;
  storage: FakeStorage;
  bgPromises: Promise<void>[];
}

function buildApp(opts: BuildOpts & { userId?: string; userEmail?: string } = {}): BuildResult {
  const app: Express = express();
  app.use(express.json());
  // Tests can override which user is "logged in" per request by sending an
  // `x-test-user` header (used by the collaborator test); otherwise we
  // default to the userId passed at build time (or "user-1").
  app.use((req, _res, next) => {
    const headerUser = req.headers["x-test-user"];
    const id = typeof headerUser === "string" ? headerUser : opts.userId ?? "user-1";
    (req as any).user = {
      id,
      type: "agent",
      email: opts.userEmail ?? `${id}@example.com`,
    };
    next();
  });
  const storage = new FakeStorage();
  const bgPromises: Promise<void>[] = [];

  registerBoardsChatRoutes(app, {
    storage: storage as unknown as IStorage,
    auth: (_req, _res, next) => next(),
    chatProviders: {
      anthropic: opts.providers?.anthropic ?? makeFakeChat("anthropic"),
      gemini: opts.providers?.gemini ?? makeFakeChat("gemini"),
      openaiBrainstorm:
        opts.providers?.openaiBrainstorm ?? makeFakeOpenAIBrainstorm().fn,
    },
    dispatchOne:
      opts.dispatchOne ??
      (async () => ({
        taskId: "fake-task",
        modelLabel: "fake-model",
        // pollUntilDone resolves on first "completed".
        poll: async () => ({ status: "completed", videoUrl: "https://example.com/v.mp4" }),
      })),
    autoEvaluateBatch:
      opts.autoEvaluateBatch ??
      (async () => ({ winnerAssetId: "noop", rejected: [], modelUsed: "heuristic" })),
    openaiClientFactory: opts.openaiClientFactory,
    geminiImageService: opts.geminiImageService,
    onBatchScheduled: (p) => bgPromises.push(p),
  });

  return { app, storage, bgPromises };
}

async function getJson(app: Express, path: string, asUser?: string) {
  const server = app.listen(0);
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no addr");
    const headers: Record<string, string> = {};
    if (asUser) headers["x-test-user"] = asUser;
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, { headers });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

async function postJson(app: Express, path: string, body: unknown, asUser?: string) {
  const server = app.listen(0);
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no addr");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (asUser) headers["x-test-user"] = asUser;
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
    return { status: res.status, body: json };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

// =====================================================
// Tests
// =====================================================
describe("POST /api/boards/:id/chat — brainstorm mode", () => {
  it("calls Anthropic and never touches the dispatch/generation services", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    let dispatchCalls = 0;
    let evalCalls = 0;

    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
      dispatchOne: async () => {
        dispatchCalls += 1;
        return {
          taskId: "x",
          modelLabel: "x",
          poll: async () => ({ status: "completed", videoUrl: "https://x" }),
        };
      },
      autoEvaluateBatch: async () => {
        evalCalls += 1;
        return { winnerAssetId: "n", rejected: [], modelUsed: "heuristic" };
      },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "Help me brainstorm a coastal travel ad",
      mode: "brainstorm",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.mode, "brainstorm");
    assert.equal(res.body.reply, "anthropic: Help me brainstorm a coastal travel ad");
    assert.equal(anthropic.calls.length, 1);
    assert.equal(anthropic.calls[0].systemPrompt.includes("creative director"), true);
    assert.equal(gemini.calls.length, 0, "Gemini must not be called when Anthropic succeeds");
    assert.equal(openaiBrainstorm.calls.length, 0, "OpenAI fallback must not be called when Anthropic succeeds");
    assert.equal(dispatchCalls, 0, "Brainstorm must never trigger a generation dispatch");
    assert.equal(evalCalls, 0, "Brainstorm must never trigger auto-eval");
    assert.equal(storage.assets.size, 0, "Brainstorm must not create any asset rows");
  });

  it("falls back to Gemini when Anthropic fails", async () => {
    const anthropic = makeFakeChat("anthropic", { fail: true });
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "another idea please",
      mode: "brainstorm",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.reply, "gemini: another idea please");
    assert.equal(anthropic.calls.length, 1);
    assert.equal(gemini.calls.length, 1);
    assert.equal(openaiBrainstorm.calls.length, 0);
  });

  it("honors body.chatModel='gemini' by calling Gemini first and not touching Anthropic", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "use gemini please",
      mode: "brainstorm",
      chatModel: "gemini",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.chatModel, "gemini");
    assert.equal(res.body.reply, "gemini: use gemini please");
    assert.equal(gemini.calls.length, 1);
    assert.equal(anthropic.calls.length, 0, "Anthropic must not be called when chatModel=gemini succeeds");
    assert.equal(openaiBrainstorm.calls.length, 0);
  });

  it("honors body.chatModel='openai' by calling OpenAI first", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm({ reply: "from-openai" });
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "use chatgpt please",
      mode: "brainstorm",
      chatModel: "openai",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.reply, "from-openai");
    assert.equal(openaiBrainstorm.calls.length, 1);
    assert.equal(anthropic.calls.length, 0);
    assert.equal(gemini.calls.length, 0);
  });

  it("falls back from the picked chatModel to the other providers when it fails", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini", { fail: true });
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "gemini will fail",
      mode: "brainstorm",
      chatModel: "gemini",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.reply, "anthropic: gemini will fail");
    assert.equal(gemini.calls.length, 1);
    assert.equal(anthropic.calls.length, 1);
    assert.equal(openaiBrainstorm.calls.length, 0);
  });

  it("forwards referencedAssetIds to the picked vision model as image URLs", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const img = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "image",
      provider: "openai-image",
      assetUrl: "https://example.com/photo.jpg",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "what's in this photo?",
      mode: "brainstorm",
      referencedAssetIds: [img!.id],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.attachedImageCount, 1);
    assert.equal(anthropic.calls.length, 1);
    assert.deepEqual(anthropic.calls[0].images, [{ url: "https://example.com/photo.jpg" }]);
    assert.equal(gemini.calls.length, 0);
    assert.equal(openaiBrainstorm.calls.length, 0);
  });

  it("uses thumbnailUrl for video references and forwards to OpenAI when picked", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm({ reply: "I see a beach" });
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const vid = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "video",
      provider: "luma",
      assetUrl: "https://example.com/clip.mp4",
      thumbnailUrl: "https://example.com/clip-thumb.jpg",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "describe this clip",
      mode: "brainstorm",
      chatModel: "openai",
      referencedAssetIds: [vid!.id],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.attachedImageCount, 1);
    assert.equal(openaiBrainstorm.calls.length, 1);
    assert.deepEqual(openaiBrainstorm.calls[0].images, [
      { url: "https://example.com/clip-thumb.jpg" },
    ]);
  });

  it("drops unresolvable references (e.g. video with no thumbnail) without failing the request", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const vid = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "video",
      provider: "luma",
      assetUrl: "https://example.com/clip.mp4",
      // No thumbnailUrl on purpose.
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "anything?",
      mode: "brainstorm",
      referencedAssetIds: [vid!.id],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.attachedImageCount, 0);
    assert.equal(anthropic.calls.length, 1);
    assert.equal(anthropic.calls[0].images, undefined);
  });

  it("falls back from the picked vision model to others with the SAME images", async () => {
    const anthropic = makeFakeChat("anthropic");
    const gemini = makeFakeChat("gemini", { fail: true });
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const img = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "image",
      provider: "openai-image",
      assetUrl: "https://example.com/p.jpg",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "look at this",
      mode: "brainstorm",
      chatModel: "gemini",
      referencedAssetIds: [img!.id],
    });

    assert.equal(res.status, 200);
    assert.equal(gemini.calls.length, 1);
    assert.deepEqual(gemini.calls[0].images, [{ url: "https://example.com/p.jpg" }]);
    // Anthropic fallback also receives the same images.
    assert.equal(anthropic.calls.length, 1);
    assert.deepEqual(anthropic.calls[0].images, [{ url: "https://example.com/p.jpg" }]);
  });

  it("falls back to OpenAI when Anthropic and Gemini both fail", async () => {
    const anthropic = makeFakeChat("anthropic", { fail: true });
    const gemini = makeFakeChat("gemini", { fail: true });
    const openaiBrainstorm = makeFakeOpenAIBrainstorm({ reply: "openai-reply" });
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "third try",
      mode: "brainstorm",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.reply, "openai-reply");
    assert.equal(openaiBrainstorm.calls.length, 1);
  });

  it("persists the user turn AND the assistant turn (with notice) so /messages returns them later", async () => {
    __resetChatProviderHealthForTests();
    const anthropic = makeFakeChat("anthropic", { fail: true });
    const gemini = makeFakeChat("gemini");
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: makeFakeOpenAIBrainstorm().fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "hello world",
      mode: "brainstorm",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.fallbackUsed, true);

    const list = await getJson(app, `/api/boards/${board.id}/messages`);
    assert.equal(list.status, 200);
    assert.equal(list.body.messages.length, 2);
    assert.equal(list.body.messages[0].role, "user");
    assert.equal(list.body.messages[0].content, "hello world");
    assert.equal(list.body.messages[1].role, "assistant");
    assert.equal(list.body.messages[1].content, "gemini: hello world");
    // The fallback notice rides along on the assistant row so the UI can re-render the badge after a refresh.
    assert.match(String(list.body.messages[1].notice), /unavailable/i);
  });

  it("POST /messages accepts a CTA batch and returns it from GET /messages", async () => {
    const { app, storage } = buildApp({});
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const post = await postJson(app, `/api/boards/${board.id}/messages`, {
      messages: [
        { role: "user", content: "make me a photo avatar of myself" },
        {
          role: "assistant",
          content: "Head to Photo Avatars",
          cta: { label: "Open Photo Avatars", href: "/dashboard#photo-avatars" },
        },
      ],
    });
    assert.equal(post.status, 200);

    const list = await getJson(app, `/api/boards/${board.id}/messages`);
    assert.equal(list.status, 200);
    assert.equal(list.body.messages.length, 2);
    assert.equal(list.body.messages[1].cta.label, "Open Photo Avatars");
  });

  it("returns the friendly all-down message instead of a 500 when every provider fails", async () => {
    __resetChatProviderHealthForTests();
    const anthropic = makeFakeChat("anthropic", { fail: true });
    const gemini = makeFakeChat("gemini", { fail: true });
    const openaiBrainstorm = makeFakeOpenAIBrainstorm({ fail: true });
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "everything is down",
      mode: "brainstorm",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.allFailed, true);
    assert.equal(res.body.chatModel, "claude");
    assert.match(String(res.body.reply), /trouble reaching its providers/i);
    // The raw upstream error text must NEVER reach the client.
    assert.doesNotMatch(String(res.body.reply), /unavailable|401|403|api key/i);
  });

  it("includes a friendly notice when the picked model fell back to another provider", async () => {
    __resetChatProviderHealthForTests();
    const anthropic = makeFakeChat("anthropic", { fail: true });
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "claude is dead, lean on gemini",
      mode: "brainstorm",
      // claude is the default; this exercises the fallback notice path.
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.fallbackUsed, true);
    assert.equal(res.body.chatModel, "gemini");
    assert.equal(res.body.requestedModel, "claude");
    assert.match(String(res.body.notice), /Claude was unavailable/);
    assert.match(String(res.body.notice), /Gemini/);
  });

  it("skips a provider on subsequent requests after a permanent (401-style) error", async () => {
    __resetChatProviderHealthForTests();
    let anthropicCalls = 0;
    const anthropic = {
      async chat() {
        anthropicCalls += 1;
        return { success: false, error: "401 Unauthorized: invalid_api_key" };
      },
    };
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    // First call: Claude fails permanently → cascade hits Gemini.
    const r1 = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "first",
      mode: "brainstorm",
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.chatModel, "gemini");
    assert.equal(anthropicCalls, 1);

    // Second call: Claude is now in the down map → it MUST be skipped entirely.
    const r2 = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "second",
      mode: "brainstorm",
    });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.chatModel, "gemini");
    assert.equal(
      anthropicCalls,
      1,
      "Claude must not be retried on subsequent requests after a 401",
    );
  });

  it("does NOT mark a provider down on transient (429/503) errors", async () => {
    __resetChatProviderHealthForTests();
    let geminiCalls = 0;
    const gemini = {
      async chat() {
        geminiCalls += 1;
        // Transient: gemini is overloaded right now.
        return { success: false, error: "503 Service Unavailable: model overloaded" };
      },
    };
    const anthropic = makeFakeChat("anthropic");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    // Pick gemini explicitly so we exercise the transient path on it.
    const r1 = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "first",
      mode: "brainstorm",
      chatModel: "gemini",
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.chatModel, "claude"); // fell back
    assert.equal(geminiCalls, 1);

    // Second call: gemini must still be tried — transient errors don't poison.
    const r2 = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "second",
      mode: "brainstorm",
      chatModel: "gemini",
    });
    assert.equal(r2.status, 200);
    assert.equal(geminiCalls, 2, "Transient errors must not be cached as permanent");
  });

  it("injects a board-state summary into the brainstorm system prompt with counts and a selected marker", async () => {
    __resetChatProviderHealthForTests();
    const anthropic = makeFakeChat("anthropic");
    const { app, storage } = buildApp({ providers: { anthropic } });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    // Mix of kinds and statuses; one image is the one the user "selected".
    const img = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seedaaaa",
      kind: "image",
      provider: "openai-image",
      assetUrl: "https://example.com/p.jpg",
      status: "ready",
    } as BoardAssetCreate);
    await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seedbbbb",
      kind: "video",
      provider: "luma",
      status: "queued",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "what's on the board?",
      mode: "brainstorm",
      referencedAssetIds: [img!.id],
    });
    assert.equal(res.status, 200);
    assert.equal(anthropic.calls.length, 1);
    const sys = anthropic.calls[0].systemPrompt;
    assert.match(sys, /creative director/);
    assert.match(sys, /## Current board state/);
    assert.match(sys, /Total assets: 2/);
    assert.match(sys, /image: 1/);
    assert.match(sys, /video: 1/);
    assert.match(sys, /ready: 1/);
    assert.match(sys, /queued: 1/);
    // The selected asset is tagged so the model can refer to it naturally.
    assert.ok(
      sys.includes(`[${img!.id.slice(0, 8)}]`),
      "system prompt should list the selected asset by short id",
    );
    assert.match(sys, /currently selected/);
  });

  it("renders an 'empty board' hint when no assets exist yet", async () => {
    __resetChatProviderHealthForTests();
    const anthropic = makeFakeChat("anthropic");
    const { app, storage } = buildApp({ providers: { anthropic } });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "what should I make first?",
      mode: "brainstorm",
    });
    assert.equal(res.status, 200);
    assert.equal(anthropic.calls.length, 1);
    const sys = anthropic.calls[0].systemPrompt;
    assert.match(sys, /## Current board state/);
    assert.match(sys, /board is empty/i);
  });

  it("truncates the per-asset list past the cap with a '…and N more' tail", async () => {
    __resetChatProviderHealthForTests();
    const anthropic = makeFakeChat("anthropic");
    const { app, storage } = buildApp({ providers: { anthropic } });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    // 35 assets — above the 30-item cap.
    for (let i = 0; i < 35; i += 1) {
      await storage.createBoardAssetForUser(board.id, "user-1", {
        batchId: `b${i}`,
        kind: "image",
        provider: "openai-image",
        status: "ready",
      } as BoardAssetCreate);
    }

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "summarize",
      mode: "brainstorm",
    });
    assert.equal(res.status, 200);
    const sys = anthropic.calls[0].systemPrompt;
    assert.match(sys, /Total assets: 35/);
    assert.match(sys, /…and 5 more/);
  });
});

describe("GET /api/boards/chat/health", () => {
  it("reports all providers healthy when nothing has been marked down", async () => {
    __resetChatProviderHealthForTests();
    const { app } = buildApp();
    const server = app.listen(0);
    try {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("no addr");
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/boards/chat/health`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.deepEqual(body.healthy, ["claude", "gemini", "openai"]);
      assert.deepEqual(body.unhealthy, []);
      assert.equal(body.default, "claude");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("excludes a provider once it has returned a permanent (401) error", async () => {
    __resetChatProviderHealthForTests();
    const anthropic = {
      async chat() {
        return { success: false, error: "401 invalid_api_key" };
      },
    };
    const gemini = makeFakeChat("gemini");
    const openaiBrainstorm = makeFakeOpenAIBrainstorm();
    const { app, storage } = buildApp({
      providers: { anthropic, gemini, openaiBrainstorm: openaiBrainstorm.fn },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    // Trigger one chat to mark claude down.
    await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "trigger",
      mode: "brainstorm",
    });

    const server = app.listen(0);
    try {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("no addr");
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/boards/chat/health`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(!body.healthy.includes("claude"));
      assert.deepEqual(body.unhealthy, ["claude"]);
      assert.equal(body.default, "gemini");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe("POST /api/boards/:id/chat — v2v guardrail", () => {
  it("returns 400 with code v2v_provider_unsupported when v2v is requested on sora2", async () => {
    const { app, storage } = buildApp();
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const seed = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "video",
      provider: "luma",
      assetUrl: "https://example.com/seed.mp4",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "restyle this video",
      mode: "create",
      provider: "sora2",
      referencedAssetIds: [seed!.id],
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "v2v_provider_unsupported");
    assert.deepEqual(res.body.allowedProviders, ["luma", "runway"]);
  });

  it("returns 400 with code v2v_provider_unsupported for seedance, veo, and kling", async () => {
    for (const provider of ["seedance", "veo", "kling"] as const) {
      const { app, storage } = buildApp();
      const board = await storage.createBoard({ userId: "user-1", title: "B" });
      const seed = await storage.createBoardAssetForUser(board.id, "user-1", {
        batchId: "seed",
        kind: "video",
        provider: "luma",
        assetUrl: "https://example.com/seed.mp4",
        status: "ready",
      } as BoardAssetCreate);

      const res = await postJson(app, `/api/boards/${board.id}/chat`, {
        message: "restyle this video",
        mode: "create",
        provider,
        referencedAssetIds: [seed!.id],
      });
      assert.equal(res.status, 400, `provider=${provider} should be rejected`);
      assert.equal(res.body.code, "v2v_provider_unsupported", `provider=${provider} code mismatch`);
    }
  });

  it("returns 400 with code v2v_luma_unavailable when v2v is requested on luma", async () => {
    const { app, storage } = buildApp();
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const seed = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "video",
      provider: "luma",
      assetUrl: "https://example.com/seed.mp4",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "restyle this video",
      mode: "create",
      provider: "luma",
      referencedAssetIds: [seed!.id],
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "v2v_luma_unavailable");
    assert.equal(res.body.suggestedProvider, "runway");
  });

  it("allows v2v on runway", async () => {
    const dispatched: Array<{ provider: Provider; genMode: GenMode }> = [];
    const { app, storage, bgPromises } = buildApp({
      dispatchOne: async (provider, genMode): Promise<DispatchResult> => {
        dispatched.push({ provider, genMode });
        return {
          taskId: "rw-task",
          modelLabel: "gen4_aleph",
          poll: async () => ({ status: "completed", videoUrl: "https://rw/v.mp4" }),
        };
      },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const seed = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "video",
      provider: "luma",
      assetUrl: "https://example.com/seed.mp4",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "restyle this video please",
      mode: "create",
      provider: "runway",
      referencedAssetIds: [seed!.id],
      variations: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, "runway");
    assert.equal(res.body.genMode, "video-to-video");
    await Promise.all(bgPromises);
    assert.ok(dispatched.length >= 1);
    assert.equal(dispatched[0].provider, "runway");
    assert.equal(dispatched[0].genMode, "video-to-video");
  });
});

describe("POST /api/boards/:id/chat — create mode", () => {
  it("inserts N 'generating' rows that share a batchId and dispatches once per row", async () => {
    const dispatched: Array<{ provider: Provider; genMode: GenMode; prompt: string }> = [];
    const { app, storage, bgPromises } = buildApp({
      dispatchOne: async (provider, genMode, ctx): Promise<DispatchResult> => {
        dispatched.push({ provider, genMode, prompt: ctx.prompt });
        return {
          taskId: `t-${dispatched.length}`,
          modelLabel: "ray-2",
          poll: async () => ({ status: "completed", videoUrl: `https://x/${dispatched.length}.mp4` }),
        };
      },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "a sweeping coastal drone shot at sunset",
      mode: "create",
      variations: 3,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.mode, "create");
    assert.equal(res.body.provider, "luma", "default provider for t2v should be luma");
    assert.equal(res.body.genMode, "text-to-video");
    assert.equal(res.body.assets.length, 3);
    const batchId = res.body.batchId;
    assert.ok(batchId);

    // All returned rows must share the same batchId AND start in 'generating'.
    for (const a of res.body.assets) {
      assert.equal(a.batchId, batchId);
      assert.equal(a.status, "generating");
      assert.equal(a.provider, "luma");
      assert.equal(a.kind, "video");
    }

    // Storage must reflect the same — three persisted rows, one shared batchId.
    const allAssets = Array.from(storage.assets.values());
    assert.equal(allAssets.length, 3);
    const batchIds = new Set(allAssets.map((a) => a.batchId));
    assert.equal(batchIds.size, 1);

    await Promise.all(bgPromises);
    assert.equal(dispatched.length, 3, "dispatch must run once per row");
    for (const d of dispatched) {
      assert.equal(d.provider, "luma");
      assert.equal(d.genMode, "text-to-video");
      assert.equal(d.prompt, "a sweeping coastal drone shot at sunset");
    }
  });

  it("honours an explicit provider override and forwards forceModel to dispatch", async () => {
    const dispatched: Array<{ provider: Provider; forceModel?: string }> = [];
    const { app, storage, bgPromises } = buildApp({
      dispatchOne: async (provider, _gm, ctx) => {
        dispatched.push({ provider, forceModel: ctx.forceModel });
        return {
          taskId: "t",
          modelLabel: ctx.forceModel || "default",
          poll: async () => ({ status: "completed", videoUrl: "https://x/v.mp4" }),
        };
      },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "make a clip",
      mode: "create",
      provider: "sora2",
      forceModel: "sora-2",
      variations: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, "sora2");
    await Promise.all(bgPromises);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].provider, "sora2");
    assert.equal(dispatched[0].forceModel, "sora-2");
  });
});

describe("POST /api/boards/:id/chat — auto-eval write-back", () => {
  it("flips the losing assets to status='rejected' with the model-supplied reason", async () => {
    const { app, storage, bgPromises } = buildApp({
      dispatchOne: async () => ({
        taskId: "ok",
        modelLabel: "ray-2",
        poll: async () => ({ status: "completed", videoUrl: "https://x/v.mp4" }),
      }),
      autoEvaluateBatch: async ({ assets }) => {
        // Pick the first as winner, reject the rest with distinct reasons.
        const [winner, ...rest] = assets;
        return {
          winnerAssetId: winner.id,
          rejected: rest.map((a, i) => ({
            assetId: a.id,
            reason: `loser-${i + 1}: muddy composition`,
          })),
          modelUsed: "gpt-4o",
        };
      },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "bright neon city street",
      mode: "create",
      variations: 3,
    });
    assert.equal(res.status, 200);
    const winnerId = res.body.assets[0].id;
    const loserIds = res.body.assets.slice(1).map((a: any) => a.id);

    await Promise.all(bgPromises);

    const winner = storage.assets.get(winnerId)!;
    assert.equal(winner.status, "ready", "winner must remain ready");
    assert.equal(winner.assetUrl, "https://x/v.mp4");
    assert.equal(winner.rejectionReason, null);

    for (let i = 0; i < loserIds.length; i++) {
      const loser = storage.assets.get(loserIds[i])!;
      assert.equal(loser.status, "rejected", `loser ${i} must be rejected`);
      assert.equal(loser.rejectionReason, `loser-${i + 1}: muddy composition`);
    }
  });

  it("does NOT run auto-eval when fewer than 2 assets become ready", async () => {
    let evalCalls = 0;
    const { app, storage, bgPromises } = buildApp({
      dispatchOne: async () => ({
        taskId: "ok",
        modelLabel: "ray-2",
        poll: async () => ({ status: "completed", videoUrl: "https://x/v.mp4" }),
      }),
      autoEvaluateBatch: async () => {
        evalCalls += 1;
        return { winnerAssetId: "n", rejected: [], modelUsed: "heuristic" };
      },
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "single shot",
      mode: "create",
      variations: 1,
    });
    assert.equal(res.status, 200);
    await Promise.all(bgPromises);
    assert.equal(evalCalls, 0, "auto-eval must be skipped for batches of size < 2");
  });
});

// =====================================================
// Image edit flow — covers gpt-image-1 images.edit and
// gemini-image openaiService.editImage branches when a
// referenced image asset is attached.
// =====================================================

interface OpenAIEditCall {
  model: string;
  prompt: string;
  image: unknown;
  n?: number;
  size?: string;
}
interface OpenAIGenerateCall {
  model: string;
  prompt: string;
}
function makeFakeOpenAIClient(opts: { editUrl?: string; generateUrl?: string } = {}) {
  const editCalls: OpenAIEditCall[] = [];
  const generateCalls: OpenAIGenerateCall[] = [];
  // Return `url` instead of `b64_json` so the production dispatcher does not
  // try to upload the buffer to object storage during tests.
  const editUrl = opts.editUrl ?? "https://openai.example/edited.png";
  const generateUrl = opts.generateUrl ?? "https://openai.example/generated.png";
  const client = {
    images: {
      async edit(args: OpenAIEditCall) {
        editCalls.push(args);
        return { data: [{ url: editUrl }] };
      },
      async generate(args: OpenAIGenerateCall) {
        generateCalls.push(args);
        return { data: [{ url: generateUrl }] };
      },
    },
  };
  return { client: client as unknown as OpenAI, editCalls, generateCalls };
}

function makeFakeGeminiImageService() {
  const editCalls: Array<{ prompt: string; referenceImageUrls: string[] }> = [];
  const generateCalls: Array<{ prompt: string }> = [];
  const svc: GeminiImageService = {
    async editImage(input) {
      editCalls.push(input);
      return "https://gemini.example/edited.png";
    },
    async generateImage(input) {
      generateCalls.push(input);
      return "https://gemini.example/generated.png";
    },
  };
  return { svc, editCalls, generateCalls };
}

// A 1x1 transparent PNG as a data: URL so dispatchImage's fetchAsUploadable
// resolves synchronously without a network call.
const SAMPLE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

describe("POST /api/boards/:id/chat — image edit flow (openai-image)", () => {
  it("calls images.edit (not images.generate) with the fetched referenced image upload", async () => {
    const fake = makeFakeOpenAIClient();
    const { app, storage, bgPromises } = buildApp({
      openaiClientFactory: () => fake.client,
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const ref = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "image",
      provider: "openai-image",
      assetUrl: SAMPLE_DATA_URL,
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "make it look like a watercolour",
      mode: "create",
      provider: "openai-image",
      referencedAssetIds: [ref!.id],
      variations: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, "openai-image");
    assert.equal(res.body.isImageEdit, true);
    assert.match(String(res.body.batchLabel), /Edit referenced image/);

    await Promise.all(bgPromises);
    assert.equal(fake.editCalls.length, 1, "images.edit must be called exactly once");
    assert.equal(fake.generateCalls.length, 0, "images.generate must NOT be called when refs are present");
    const call = fake.editCalls[0];
    assert.equal(call.model, "gpt-image-1");
    assert.equal(call.prompt, "make it look like a watercolour");
    // The image is forwarded as the fetched upload (a single Uploadable, not the URL string).
    assert.notEqual(call.image, undefined);
    assert.notEqual(typeof call.image, "string", "image must be the fetched upload, not the URL");
  });

  it("falls back to images.generate when no referenced image is attached", async () => {
    const fake = makeFakeOpenAIClient();
    const { app, storage, bgPromises } = buildApp({
      openaiClientFactory: () => fake.client,
    });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "neon street market at dusk",
      mode: "create",
      provider: "openai-image",
      variations: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.isImageEdit, false);
    assert.match(String(res.body.batchLabel), /Generate \d+ image/);

    await Promise.all(bgPromises);
    assert.equal(fake.generateCalls.length, 1);
    assert.equal(fake.editCalls.length, 0);
    assert.equal(fake.generateCalls[0].model, "gpt-image-1");
  });
});

describe("POST /api/boards/:id/chat — image edit flow (gemini-image)", () => {
  it("calls openaiService.editImage with the referenced image URL when refs are attached", async () => {
    const gem = makeFakeGeminiImageService();
    const { app, storage, bgPromises } = buildApp({ geminiImageService: gem.svc });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const ref = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "image",
      provider: "gemini-image",
      assetUrl: "https://example.com/source.png",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "swap the sky for a sunset",
      mode: "create",
      provider: "gemini-image",
      referencedAssetIds: [ref!.id],
      variations: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, "gemini-image");
    assert.equal(res.body.isImageEdit, true);
    assert.match(String(res.body.batchLabel), /Edit referenced image/);

    await Promise.all(bgPromises);
    assert.equal(gem.editCalls.length, 1, "editImage must be called exactly once");
    assert.equal(gem.generateCalls.length, 0, "generateImage must NOT be called when refs are present");
    assert.equal(gem.editCalls[0].prompt, "swap the sky for a sunset");
    assert.deepEqual(gem.editCalls[0].referenceImageUrls, ["https://example.com/source.png"]);
  });

  it("routes a no-ref request through openaiService.generateImage instead of editImage", async () => {
    const gem = makeFakeGeminiImageService();
    const { app, storage, bgPromises } = buildApp({ geminiImageService: gem.svc });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "a cinematic forest at dawn",
      mode: "create",
      provider: "gemini-image",
      variations: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.isImageEdit, false);
    assert.match(String(res.body.batchLabel), /Generate \d+ image/);

    await Promise.all(bgPromises);
    assert.equal(gem.generateCalls.length, 1);
    assert.equal(gem.editCalls.length, 0);
    assert.equal(gem.generateCalls[0].prompt, "a cinematic forest at dawn");
  });

  it("forwards every referenced image URL to editImage when multiple refs are attached", async () => {
    const gem = makeFakeGeminiImageService();
    const { app, storage, bgPromises } = buildApp({ geminiImageService: gem.svc });
    const board = await storage.createBoard({ userId: "user-1", title: "B" });
    const r1 = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "image",
      provider: "gemini-image",
      assetUrl: "https://example.com/a.png",
      status: "ready",
    } as BoardAssetCreate);
    const r2 = await storage.createBoardAssetForUser(board.id, "user-1", {
      batchId: "seed",
      kind: "image",
      provider: "gemini-image",
      assetUrl: "https://example.com/b.png",
      status: "ready",
    } as BoardAssetCreate);

    const res = await postJson(app, `/api/boards/${board.id}/chat`, {
      message: "blend these into one composition",
      mode: "create",
      provider: "gemini-image",
      referencedAssetIds: [r1!.id, r2!.id],
      variations: 1,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.isImageEdit, true);
    assert.match(String(res.body.batchLabel), /Edit referenced images/);

    await Promise.all(bgPromises);
    assert.equal(gem.editCalls.length, 1);
    assert.deepEqual(
      gem.editCalls[0].referenceImageUrls,
      ["https://example.com/a.png", "https://example.com/b.png"],
    );
  });
});

describe("Shared boards — collaborator chat history", () => {
  it("lets a collaborator read history and post messages, and tags each turn with its author", async () => {
    const { app, storage } = buildApp();
    const owner = await storage.createBoard({ userId: "owner", title: "Shared", isShared: true });
    storage.shareBoardWith(owner.id, "collab");
    storage.users.set("owner", { id: "owner", name: "Olivia Owner", email: "olivia@example.com" });
    storage.users.set("collab", { id: "collab", name: "Carl Collab", email: "carl@example.com" });

    // Owner posts a message via the lightweight POST /messages route.
    const ownerPost = await postJson(
      app,
      `/api/boards/${owner.id}/messages`,
      { role: "user", content: "Hi team", notice: null, cta: null },
      "owner",
    );
    assert.equal(ownerPost.status, 200);

    // Collaborator can read what the owner wrote AND post their own reply.
    const collabRead = await getJson(app, `/api/boards/${owner.id}/messages`, "collab");
    assert.equal(collabRead.status, 200);
    assert.equal(collabRead.body.messages.length, 1);
    assert.equal(collabRead.body.messages[0].content, "Hi team");
    assert.equal(collabRead.body.messages[0].author?.id, "owner");
    assert.equal(collabRead.body.messages[0].author?.name, "Olivia Owner");

    const collabPost = await postJson(
      app,
      `/api/boards/${owner.id}/messages`,
      { role: "user", content: "Reply from collab", notice: null, cta: null },
      "collab",
    );
    assert.equal(collabPost.status, 200);

    // Owner sees both turns labelled with the right author.
    const ownerRead = await getJson(app, `/api/boards/${owner.id}/messages`, "owner");
    assert.equal(ownerRead.status, 200);
    assert.equal(ownerRead.body.messages.length, 2);
    assert.deepEqual(
      ownerRead.body.messages.map((m: any) => [m.content, m.author?.id]),
      [
        ["Hi team", "owner"],
        ["Reply from collab", "collab"],
      ],
    );
  });

  it("attributes a Plan-mode chat turn to the collaborator who sent it", async () => {
    const anthropic = makeFakeChat("anthropic");
    const { app, storage } = buildApp({
      providers: { anthropic, gemini: makeFakeChat("gemini"), openaiBrainstorm: makeFakeOpenAIBrainstorm().fn },
    });
    const owner = await storage.createBoard({ userId: "owner", title: "Shared", isShared: true });
    storage.shareBoardWith(owner.id, "collab");
    storage.users.set("collab", { id: "collab", name: "Carl Collab", email: null });

    const reply = await postJson(
      app,
      `/api/boards/${owner.id}/chat`,
      { message: "what should we try next?", mode: "brainstorm" },
      "collab",
    );
    assert.equal(reply.status, 200);

    const read = await getJson(app, `/api/boards/${owner.id}/messages`, "owner");
    assert.equal(read.status, 200);
    // Both turns produced by this brainstorm call should be attributed to
    // the collaborator who actually invoked the chat — otherwise the owner
    // can't tell who's been driving the conversation.
    assert.equal(read.body.messages.length, 2);
    for (const m of read.body.messages) {
      assert.equal(m.author?.id, "collab", `expected ${m.role} turn to be authored by collab`);
    }
  });

  it("rejects /messages access for users who are neither owner nor collaborators", async () => {
    const { app, storage } = buildApp();
    const owner = await storage.createBoard({ userId: "owner", title: "Private", isShared: false });

    const read = await getJson(app, `/api/boards/${owner.id}/messages`, "stranger");
    assert.equal(read.status, 404);

    const post = await postJson(
      app,
      `/api/boards/${owner.id}/messages`,
      { role: "user", content: "sneak", notice: null, cta: null },
      "stranger",
    );
    assert.equal(post.status, 404);
  });
});
