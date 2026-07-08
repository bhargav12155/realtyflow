import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  createElevenLabsCloneHandler,
  createBoardSpeakHandler,
  boardSpeakSchema,
} from "../server/routes/elevenlabs-voices";
import type { CustomVoice, InsertCustomVoice, BoardAsset } from "@shared/schema";

type VoiceRow = CustomVoice;

class FakeVoiceStorage {
  voices = new Map<string, VoiceRow>();
  updates: Array<{ id: string; userId: string; updates: Record<string, unknown> }> = [];
  private idCounter = 0;

  seed(v: Partial<VoiceRow> & { id: string; userId: string; name: string }): VoiceRow {
    const row: VoiceRow = {
      id: v.id,
      userId: v.userId,
      name: v.name,
      audioUrl: v.audioUrl ?? "https://s3/voice.mp3",
      fileSize: v.fileSize ?? 100000,
      heygenAudioAssetId: "heygenAudioAssetId" in v ? v.heygenAudioAssetId : null,
      heygenVoiceId: v.heygenVoiceId ?? null,
      provider: v.provider ?? "elevenlabs",
      elevenlabsVoiceId: v.elevenlabsVoiceId ?? null,
      language: v.language ?? null,
      gender: v.gender ?? null,
      sampleAudioUrl: v.sampleAudioUrl ?? null,
      status: v.status ?? "ready",
      createdAt: v.createdAt ?? new Date(),
    } as VoiceRow;
    this.voices.set(row.id, row);
    return row;
  }

  async getCustomVoiceByIdAndUser(id: string, userId: string): Promise<VoiceRow | undefined> {
    const v = this.voices.get(id);
    return v && v.userId === userId ? v : undefined;
  }

  async createCustomVoice(input: InsertCustomVoice): Promise<VoiceRow> {
    this.idCounter += 1;
    const row: VoiceRow = {
      id: `v_${this.idCounter}`,
      userId: input.userId,
      name: input.name,
      audioUrl: input.audioUrl,
      fileSize: input.fileSize ?? 0,
      heygenAudioAssetId: input.heygenAudioAssetId ?? null,
      heygenVoiceId: input.heygenVoiceId ?? null,
      provider: (input as { provider?: string }).provider ?? "heygen",
      elevenlabsVoiceId: (input as { elevenlabsVoiceId?: string }).elevenlabsVoiceId ?? null,
      language: input.language ?? null,
      gender: input.gender ?? null,
      sampleAudioUrl: input.sampleAudioUrl ?? null,
      status: input.status ?? "pending",
      createdAt: new Date(),
    } as VoiceRow;
    this.voices.set(row.id, row);
    return row;
  }

  async updateCustomVoice(
    id: string,
    userId: string,
    updates: Record<string, unknown>,
  ): Promise<VoiceRow | undefined> {
    this.updates.push({ id, userId, updates });
    const v = this.voices.get(id);
    if (!v || v.userId !== userId) return undefined;
    const next = { ...v, ...updates } as VoiceRow;
    this.voices.set(id, next);
    return next;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for predicate");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function post(app: express.Express, path: string, body?: unknown) {
  const server = app.listen(0);
  try {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json as Record<string, unknown> | null };
  } finally {
    server.close();
  }
}

// ---------------------------------------------------------------------------
// POST /api/elevenlabs/voice-clone
// ---------------------------------------------------------------------------

describe("createElevenLabsCloneHandler", () => {
  let storage: FakeVoiceStorage;

  function buildCloneApp(opts: {
    configured?: boolean;
    withFile?: boolean;
    cloneFn?: (input: { name: string; audioBuffer: Buffer; mimeType?: string }) => Promise<{
      success: boolean;
      voiceId?: string;
      error?: string;
    }>;
    uploadSampleAudio?: () => Promise<string>;
    onCloneComplete?: (p: { userId: string; voice: VoiceRow }) => void;
    onCloneFailed?: (p: { userId: string; voiceId: string; voiceName: string; error: string }) => void;
  }) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { id: string } }).user = { id: "user-1" };
      if (opts.withFile !== false) {
        (req as Request & { file?: { buffer: Buffer; mimetype: string } }).file = {
          buffer: Buffer.from("fake-audio-bytes"),
          mimetype: "audio/webm",
        };
      }
      next();
    });
    app.post(
      "/api/elevenlabs/voice-clone",
      createElevenLabsCloneHandler({
        storage: storage as never,
        uploadSampleAudio: opts.uploadSampleAudio ?? (async () => "https://s3/sample.webm"),
        cloneFn: opts.cloneFn ?? (async () => ({ success: true, voiceId: "el_voice_1" })),
        isConfigured: () => opts.configured !== false,
        onCloneComplete: opts.onCloneComplete,
        onCloneFailed: opts.onCloneFailed,
      }),
    );
    return app;
  }

  beforeEach(() => {
    storage = new FakeVoiceStorage();
  });

  it("returns 400 when ElevenLabs is not configured", async () => {
    const app = buildCloneApp({ configured: false });
    const res = await post(app, "/api/elevenlabs/voice-clone", { name: "My voice" });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error), /isn't configured/);
  });

  it("returns 400 when no audio file is attached", async () => {
    const app = buildCloneApp({ withFile: false });
    const res = await post(app, "/api/elevenlabs/voice-clone", { name: "My voice" });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error), /No audio file/);
  });

  it("returns 400 when the name is missing", async () => {
    const app = buildCloneApp({});
    const res = await post(app, "/api/elevenlabs/voice-clone", {});
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error), /name is required/i);
  });

  it("responds 202 with a cloning row, then flips to ready with the ElevenLabs id", async () => {
    let completed: { userId: string; voice: VoiceRow } | null = null;
    const app = buildCloneApp({
      cloneFn: async () => ({ success: true, voiceId: "el_voice_42" }),
      onCloneComplete: (p) => {
        completed = p;
      },
    });
    const res = await post(app, "/api/elevenlabs/voice-clone", { name: "Agent voice" });
    assert.equal(res.status, 202);
    assert.equal(res.body?.status, "cloning");
    assert.equal(res.body?.provider, "elevenlabs");
    assert.equal(res.body?.name, "Agent voice");

    await waitFor(() => completed !== null);
    const row = storage.voices.get(String(res.body?.id));
    assert.equal(row?.status, "ready");
    assert.equal(row?.elevenlabsVoiceId, "el_voice_42");
    assert.equal(completed!.userId, "user-1");
  });

  it("flips the row to failed and notifies when cloning errors", async () => {
    let failed: { voiceId: string; voiceName: string; error: string } | null = null;
    const app = buildCloneApp({
      cloneFn: async () => ({ success: false, error: "sample too short" }),
      onCloneFailed: (p) => {
        failed = p;
      },
    });
    const res = await post(app, "/api/elevenlabs/voice-clone", { name: "Bad take" });
    assert.equal(res.status, 202);

    await waitFor(() => failed !== null);
    const row = storage.voices.get(String(res.body?.id));
    assert.equal(row?.status, "failed");
    assert.equal(failed!.error, "sample too short");
    assert.equal(failed!.voiceName, "Bad take");
  });

  it("returns 500 when storing the sample fails (no row created)", async () => {
    const app = buildCloneApp({
      uploadSampleAudio: async () => {
        throw new Error("s3 down");
      },
    });
    const res = await post(app, "/api/elevenlabs/voice-clone", { name: "My voice" });
    assert.equal(res.status, 500);
    assert.equal(storage.voices.size, 0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/boards/:id/speak
// ---------------------------------------------------------------------------

type AssetRow = BoardAsset;

class FakeBoardStorage extends FakeVoiceStorage {
  boards = new Set<string>();
  assets = new Map<string, AssetRow>();
  assetUpdates: Array<{ assetId: string; updates: Record<string, unknown> }> = [];
  private assetCounter = 0;

  async getAccessibleBoardForUser(boardId: string, _userId: string) {
    return this.boards.has(boardId) ? ({ id: boardId } as never) : undefined;
  }

  async createBoardAssetForUser(
    boardId: string,
    _userId: string,
    input: Record<string, unknown>,
  ): Promise<AssetRow | undefined> {
    if (!this.boards.has(boardId)) return undefined;
    this.assetCounter += 1;
    const row = {
      id: `a_${this.assetCounter}`,
      boardId,
      ...input,
    } as unknown as AssetRow;
    this.assets.set(row.id, row);
    return row;
  }

  async updateBoardAssetForUser(
    boardId: string,
    assetId: string,
    _userId: string,
    updates: Record<string, unknown>,
  ): Promise<AssetRow | undefined> {
    this.assetUpdates.push({ assetId, updates });
    const row = this.assets.get(assetId);
    if (!row || row.boardId !== boardId) return undefined;
    const next = { ...row, ...updates } as AssetRow;
    this.assets.set(assetId, next);
    return next;
  }
}

describe("createBoardSpeakHandler", () => {
  let storage: FakeBoardStorage;
  let pushed: Array<{ recipients: string[]; boardId: string; asset: AssetRow }>;

  function buildSpeakApp(opts: {
    configured?: boolean;
    generateSpeechFn?: (
      text: string,
      voiceId: string,
      options?: { uploadToS3?: boolean },
    ) => Promise<{ success: boolean; audioUrl?: string; error?: string }>;
  }) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { id: string } }).user = { id: "user-1" };
      next();
    });
    app.post(
      "/api/boards/:id/speak",
      createBoardSpeakHandler({
        storage: storage as never,
        generateSpeechFn:
          opts.generateSpeechFn ??
          (async () => ({ success: true, audioUrl: "https://s3/voiceover.mp3" })),
        isConfigured: () => opts.configured !== false,
        resolveRecipients: async () => ["user-1", "user-2"],
        pushStatus: (recipients, boardId, asset) => {
          pushed.push({ recipients, boardId, asset });
        },
      }),
    );
    return app;
  }

  beforeEach(() => {
    storage = new FakeBoardStorage();
    storage.boards.add("board-1");
    pushed = [];
  });

  it("returns 400 when ElevenLabs is not configured", async () => {
    const app = buildSpeakApp({ configured: false });
    const res = await post(app, "/api/boards/board-1/speak", {
      text: "Hello",
      voiceId: "stock-1",
    });
    assert.equal(res.status, 400);
  });

  it("returns 400 on an invalid body", async () => {
    const app = buildSpeakApp({});
    const res = await post(app, "/api/boards/board-1/speak", { text: "" });
    assert.equal(res.status, 400);
  });

  it("returns 404 for an inaccessible board", async () => {
    const app = buildSpeakApp({});
    const res = await post(app, "/api/boards/other-board/speak", {
      text: "Hello",
      voiceId: "stock-1",
    });
    assert.equal(res.status, 404);
  });

  it("rejects a custom voice that is still cloning", async () => {
    storage.seed({
      id: "cv-1",
      userId: "user-1",
      name: "My clone",
      provider: "elevenlabs",
      status: "cloning",
    });
    const app = buildSpeakApp({});
    const res = await post(app, "/api/boards/board-1/speak", {
      text: "Hello",
      voiceId: "cv-1",
    });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error), /still cloning/);
  });

  it("resolves a ready custom clone to its ElevenLabs id and lands a ready audio tile", async () => {
    storage.seed({
      id: "cv-2",
      userId: "user-1",
      name: "My clone",
      provider: "elevenlabs",
      status: "ready",
      elevenlabsVoiceId: "el_real_id",
    });
    let usedVoiceId: string | null = null;
    const app = buildSpeakApp({
      generateSpeechFn: async (_text, voiceId) => {
        usedVoiceId = voiceId;
        return { success: true, audioUrl: "https://s3/out.mp3" };
      },
    });
    const res = await post(app, "/api/boards/board-1/speak", {
      text: "Welcome to the open house",
      voiceId: "cv-2",
    });
    assert.equal(res.status, 202);
    const asset = res.body?.asset as Record<string, unknown>;
    assert.equal(asset.kind, "audio");
    assert.equal(asset.provider, "elevenlabs");
    assert.equal(asset.status, "generating");
    assert.equal(asset.content, "Welcome to the open house");

    await waitFor(() => pushed.length >= 2);
    assert.equal(usedVoiceId, "el_real_id");
    const final = pushed[pushed.length - 1].asset as unknown as Record<string, unknown>;
    assert.equal(final.status, "ready");
    assert.equal(final.assetUrl, "https://s3/out.mp3");
    assert.deepEqual(pushed[0].recipients, ["user-1", "user-2"]);
  });

  it("passes a stock voice id straight through", async () => {
    let usedVoiceId: string | null = null;
    const app = buildSpeakApp({
      generateSpeechFn: async (_text, voiceId) => {
        usedVoiceId = voiceId;
        return { success: true, audioUrl: "https://s3/out.mp3" };
      },
    });
    const res = await post(app, "/api/boards/board-1/speak", {
      text: "Hello there",
      voiceId: "stock-rachel",
    });
    assert.equal(res.status, 202);
    await waitFor(() => pushed.length >= 2);
    assert.equal(usedVoiceId, "stock-rachel");
  });

  it("marks the tile failed with a reason when generation errors", async () => {
    const app = buildSpeakApp({
      generateSpeechFn: async () => ({ success: false, error: "quota exceeded" }),
    });
    const res = await post(app, "/api/boards/board-1/speak", {
      text: "Hello",
      voiceId: "stock-1",
    });
    assert.equal(res.status, 202);
    await waitFor(() => pushed.length >= 2);
    const final = pushed[pushed.length - 1].asset as unknown as Record<string, unknown>;
    assert.equal(final.status, "failed");
    assert.equal(final.rejectionReason, "quota exceeded");
  });
});

describe("boardSpeakSchema", () => {
  it("caps text at 2500 characters", () => {
    assert.equal(
      boardSpeakSchema.safeParse({ text: "x".repeat(2501), voiceId: "v" }).success,
      false,
    );
    assert.equal(
      boardSpeakSchema.safeParse({ text: "x".repeat(2500), voiceId: "v" }).success,
      true,
    );
  });
});
