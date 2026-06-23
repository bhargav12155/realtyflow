import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  createRetryCloneHandler,
  createVoiceWithClone,
  createRenameVoiceHandler,
} from "../server/routes/custom-voices-clone";
import type { CustomVoice, InsertCustomVoice } from "@shared/schema";

type VoiceRow = CustomVoice;

class FakeStorage {
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
      heygenAudioAssetId: "heygenAudioAssetId" in v ? v.heygenAudioAssetId : "asset_xyz",
      heygenVoiceId: v.heygenVoiceId ?? null,
      language: v.language ?? null,
      gender: v.gender ?? null,
      sampleAudioUrl: v.sampleAudioUrl ?? null,
      status: v.status ?? "failed",
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
    updates: Record<string, unknown>
  ): Promise<VoiceRow | undefined> {
    this.updates.push({ id, userId, updates });
    const v = this.voices.get(id);
    if (!v || v.userId !== userId) return undefined;
    const next = { ...v, ...updates } as VoiceRow;
    this.voices.set(id, next);
    return next;
  }
}

interface BuildAppDeps {
  storage: FakeStorage;
  cloneVoice: (params: {
    audioAssetId: string;
    name: string;
    language?: string;
    gender?: string;
  }) => Promise<{ voiceId: string; previewAudioUrl?: string }>;
  userId?: string;
  onCloneComplete?: (params: { userId: string; voice: VoiceRow }) => void;
  onCloneFailed?: (params: {
    userId: string;
    voiceId: string;
    voiceName: string;
    error: string;
  }) => void;
}

function buildApp(deps: BuildAppDeps) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: { id: string } }).user = { id: deps.userId ?? "user-1" };
    next();
  });
  app.post(
    "/api/custom-voices/:id/retry-clone",
    createRetryCloneHandler({
      storage: deps.storage as unknown as Parameters<typeof createRetryCloneHandler>[0]["storage"],
      heygenServiceFactory: () => ({ cloneVoice: deps.cloneVoice }),
      onCloneComplete: deps.onCloneComplete as never,
      onCloneFailed: deps.onCloneFailed,
    })
  );
  return app;
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

async function call(app: express.Express, voiceId: string) {
  return await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(`http://127.0.0.1:${port}/api/custom-voices/${voiceId}/retry-clone`, {
          method: "POST",
        });
        const body = await r.json().catch(() => ({}));
        resolve({ status: r.status, body });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe("POST /api/custom-voices/:id/retry-clone", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("returns 202 immediately with status=cloning, then clones in the background and notifies on success", async () => {
    storage.seed({ id: "v1", userId: "user-1", name: "Casey" });
    const completions: Array<{ userId: string; voice: VoiceRow }> = [];
    const app = buildApp({
      storage,
      cloneVoice: async () => ({ voiceId: "voice_new", previewAudioUrl: "https://heygen/p.mp3" }),
      onCloneComplete: (params) => completions.push(params as { userId: string; voice: VoiceRow }),
    });

    const { status, body } = await call(app, "v1");

    assert.equal(status, 202);
    assert.equal((body as { status: string }).status, "cloning");

    await waitFor(() => completions.length > 0);
    const final = storage.voices.get("v1")!;
    assert.equal(final.heygenVoiceId, "voice_new");
    assert.equal(final.status, "ready");
    assert.equal(final.sampleAudioUrl, "https://heygen/p.mp3");
    // Status was first flipped to "cloning" then to "ready"
    assert.deepEqual(
      storage.updates.map((u) => u.updates.status).filter(Boolean),
      ["cloning", "ready"]
    );
    assert.equal(completions[0].voice.heygenVoiceId, "voice_new");
    assert.equal(completions[0].voice.status, "ready");
    assert.equal(completions[0].userId, "user-1");
  });

  it("flips status back to failed and notifies onCloneFailed when HeyGen rejects", async () => {
    storage.seed({ id: "v2", userId: "user-1", name: "Casey" });
    const failures: Array<{ voiceId: string; error: string }> = [];
    const app = buildApp({
      storage,
      cloneVoice: async () => {
        throw new Error("Voice sample is too short — please record at least 30 seconds.");
      },
      onCloneFailed: (p) => failures.push({ voiceId: p.voiceId, error: p.error }),
    });

    const { status, body } = await call(app, "v2");

    // Response is sent immediately as 202 with the cloning row.
    assert.equal(status, 202);
    assert.equal((body as { status: string }).status, "cloning");

    await waitFor(() => failures.length > 0);
    assert.equal(storage.voices.get("v2")!.status, "failed");
    assert.match(failures[0].error, /at least 30 seconds/);
    assert.equal(failures[0].voiceId, "v2");
  });

  it("returns 409 when a clone is already in progress for this voice", async () => {
    storage.seed({ id: "v3", userId: "user-1", name: "Casey", status: "cloning" });
    let cloneCalled = false;
    const app = buildApp({
      storage,
      cloneVoice: async () => {
        cloneCalled = true;
        return { voiceId: "x" };
      },
    });

    const { status, body } = await call(app, "v3");

    assert.equal(status, 409);
    assert.match((body as { error: string }).error, /already in progress/i);
    assert.equal(cloneCalled, false, "cloneVoice should not be invoked when already cloning");
    assert.equal(storage.voices.get("v3")!.status, "cloning");
  });

  it("returns 404 when the voice belongs to another user (no IDOR)", async () => {
    storage.seed({ id: "v4", userId: "user-OTHER", name: "Not yours" });
    let cloneCalled = false;
    const app = buildApp({
      storage,
      userId: "user-1",
      cloneVoice: async () => {
        cloneCalled = true;
        return { voiceId: "x" };
      },
    });

    const { status, body } = await call(app, "v4");

    assert.equal(status, 404);
    assert.equal((body as { error: string }).error, "Voice not found");
    assert.equal(cloneCalled, false);
    // The other user's row must not be mutated
    assert.equal(storage.voices.get("v4")!.status, "failed");
  });

  it("returns 400 when the voice has no HeyGen audio asset on file", async () => {
    storage.seed({ id: "v5", userId: "user-1", name: "Casey", heygenAudioAssetId: null as unknown as string });
    const app = buildApp({
      storage,
      cloneVoice: async () => ({ voiceId: "x" }),
    });

    const { status, body } = await call(app, "v5");

    assert.equal(status, 400);
    assert.match((body as { error: string }).error, /No audio sample/);
  });
});

describe("createVoiceWithClone (POST /api/custom-voices lifecycle)", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("uploads to HeyGen, clones, and persists status=ready with heygenVoiceId", async () => {
    let uploadCalled = 0;
    let cloneCalled = 0;
    const { voice, cloneError } = await createVoiceWithClone(
      {
        userId: "user-1",
        name: "Casey",
        audioBuffer: Buffer.from([1, 2, 3]),
        audioMimeType: "audio/webm",
        audioUrl: "https://s3/voice.mp3",
        fileSize: 1234,
        language: "en",
        gender: "female",
      },
      {
        storage: storage as never,
        heygenServiceFactory: () => ({
          uploadAudio: async () => {
            uploadCalled += 1;
            return "asset_abc";
          },
          cloneVoice: async () => {
            cloneCalled += 1;
            return { voiceId: "voice_xyz", previewAudioUrl: "https://heygen/p.mp3" };
          },
        }),
      }
    );

    assert.equal(uploadCalled, 1);
    assert.equal(cloneCalled, 1);
    assert.equal(cloneError, undefined);
    assert.equal(voice.status, "ready");
    assert.equal(voice.heygenVoiceId, "voice_xyz");
    assert.equal(voice.heygenAudioAssetId, "asset_abc");
    assert.equal(voice.sampleAudioUrl, "https://heygen/p.mp3");
    // Lifecycle: created as cloning, then updated to ready
    const created = storage.voices.get(voice.id)!;
    assert.equal(created.status, "ready");
    assert.deepEqual(
      storage.updates.map((u) => u.updates.status).filter(Boolean),
      ["ready"]
    );
  });

  it("persists status=failed with cloneError when HeyGen clone rejects (asset still saved)", async () => {
    const { voice, cloneError } = await createVoiceWithClone(
      {
        userId: "user-1",
        name: "Casey",
        audioBuffer: Buffer.from([1, 2, 3]),
        audioMimeType: "audio/webm",
        audioUrl: "https://s3/voice.mp3",
        fileSize: 1234,
      },
      {
        storage: storage as never,
        heygenServiceFactory: () => ({
          uploadAudio: async () => "asset_abc",
          cloneVoice: async () => {
            throw new Error("Voice sample is too short");
          },
        }),
      }
    );

    assert.equal(voice.status, "failed");
    assert.equal(voice.heygenAudioAssetId, "asset_abc");
    assert.equal(voice.heygenVoiceId, null);
    assert.match(cloneError ?? "", /too short/);
  });

  it("persists status=failed when HeyGen upload itself fails (no asset id)", async () => {
    const { voice, cloneError } = await createVoiceWithClone(
      {
        userId: "user-1",
        name: "Casey",
        audioBuffer: Buffer.from([1, 2, 3]),
        audioMimeType: "audio/webm",
        audioUrl: "https://s3/voice.mp3",
        fileSize: 1234,
      },
      {
        storage: storage as never,
        heygenServiceFactory: () => ({
          uploadAudio: async () => {
            throw new Error("HeyGen upload failed");
          },
          cloneVoice: async () => ({ voiceId: "x" }),
        }),
      }
    );

    assert.equal(voice.status, "failed");
    assert.equal(voice.heygenAudioAssetId, null);
    assert.equal(voice.heygenVoiceId, null);
    assert.match(cloneError ?? "", /upload failed/i);
  });
});

function buildRenameApp(deps: { storage: FakeStorage; userId?: string }) {
  const app = express();
  app.use(express.json());
  app.patch(
    "/api/custom-voices/:id",
    (req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { id: string } }).user = { id: deps.userId ?? "user-1" };
      next();
    },
    createRenameVoiceHandler({ storage: deps.storage as never })
  );
  return app;
}

async function callRename(app: express.Express, voiceId: string, body: unknown) {
  return await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(`http://127.0.0.1:${port}/api/custom-voices/${voiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const respBody = await r.json().catch(() => ({}));
        resolve({ status: r.status, body: respBody });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe("PATCH /api/custom-voices/:id (rename)", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("renames the voice when the new name is valid and owned by the user", async () => {
    storage.seed({ id: "v1", userId: "user-1", name: "Old name" });
    const app = buildRenameApp({ storage });
    const { status, body } = await callRename(app, "v1", { name: "Friendly New Name" });
    assert.equal(status, 200);
    assert.equal((body as { name: string }).name, "Friendly New Name");
    assert.equal(storage.voices.get("v1")!.name, "Friendly New Name");
  });

  it("returns 400 when the name is empty/whitespace", async () => {
    storage.seed({ id: "v1", userId: "user-1", name: "Old" });
    const app = buildRenameApp({ storage });
    const { status, body } = await callRename(app, "v1", { name: "   " });
    assert.equal(status, 400);
    assert.match((body as { error: string }).error, /required/i);
    assert.equal(storage.voices.get("v1")!.name, "Old");
  });

  it("returns 400 when the name exceeds 100 characters", async () => {
    storage.seed({ id: "v1", userId: "user-1", name: "Old" });
    const app = buildRenameApp({ storage });
    const longName = "a".repeat(101);
    const { status, body } = await callRename(app, "v1", { name: longName });
    assert.equal(status, 400);
    assert.match((body as { error: string }).error, /too long/i);
    assert.equal(storage.voices.get("v1")!.name, "Old");
  });

  it("returns 404 (no IDOR) when the voice belongs to another user", async () => {
    storage.seed({ id: "v1", userId: "user-OTHER", name: "Theirs" });
    const app = buildRenameApp({ storage, userId: "user-1" });
    const { status, body } = await callRename(app, "v1", { name: "Mine now" });
    assert.equal(status, 404);
    assert.equal((body as { error: string }).error, "Voice not found");
    assert.equal(storage.voices.get("v1")!.name, "Theirs");
  });

  it("trims surrounding whitespace before persisting", async () => {
    storage.seed({ id: "v1", userId: "user-1", name: "Old" });
    const app = buildRenameApp({ storage });
    const { status, body } = await callRename(app, "v1", { name: "   Padded   " });
    assert.equal(status, 200);
    assert.equal((body as { name: string }).name, "Padded");
  });
});
