import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, { type Express } from "express";
import {
  registerBoardsChatRoutes,
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
}

// =====================================================
// Fake chat providers
// =====================================================
type ChatCall = { message: string; systemPrompt: string };

function makeFakeChat(label: string, opts: { fail?: boolean; empty?: boolean } = {}) {
  const calls: ChatCall[] = [];
  const svc = {
    calls,
    async chat(message: string, _h: any, systemPrompt: string) {
      calls.push({ message, systemPrompt });
      if (opts.fail) return { success: false, error: `${label} unavailable` };
      if (opts.empty) return { success: true, message: "" };
      return { success: true, message: `${label}: ${message}` };
    },
  };
  return svc;
}

function makeFakeOpenAIBrainstorm(opts: { reply?: string; fail?: boolean } = {}) {
  const calls: { message: string }[] = [];
  return {
    calls,
    fn: async (message: string) => {
      calls.push({ message });
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

function buildApp(opts: BuildOpts = {}): BuildResult {
  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: "user-1", type: "agent", email: "u@example.com" };
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

async function postJson(app: Express, path: string, body: unknown) {
  const server = app.listen(0);
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no addr");
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
