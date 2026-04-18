import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import { createRetryCloneHandler } from "../server/routes/custom-voices-clone";
import type { CustomVoice } from "@shared/schema";

type VoiceRow = CustomVoice;

class FakeStorage {
  voices = new Map<string, VoiceRow>();
  updates: Array<{ id: string; userId: string; updates: Record<string, unknown> }> = [];

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

function buildApp(deps: {
  storage: FakeStorage;
  cloneVoice: (params: {
    audioAssetId: string;
    name: string;
    language?: string;
    gender?: string;
  }) => Promise<{ voiceId: string; previewAudioUrl?: string }>;
  userId?: string;
}) {
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
    })
  );
  return app;
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

  it("clones the voice, persists the new heygenVoiceId, and flips status to ready", async () => {
    storage.seed({ id: "v1", userId: "user-1", name: "Casey" });
    const app = buildApp({
      storage,
      cloneVoice: async () => ({ voiceId: "voice_new", previewAudioUrl: "https://heygen/p.mp3" }),
    });

    const { status, body } = await call(app, "v1");

    assert.equal(status, 200);
    assert.equal((body as { heygenVoiceId: string }).heygenVoiceId, "voice_new");
    assert.equal((body as { status: string }).status, "ready");
    const final = storage.voices.get("v1")!;
    assert.equal(final.heygenVoiceId, "voice_new");
    assert.equal(final.status, "ready");
    assert.equal(final.sampleAudioUrl, "https://heygen/p.mp3");
    // Status was first flipped to "cloning" then to "ready"
    assert.deepEqual(
      storage.updates.map((u) => u.updates.status).filter(Boolean),
      ["cloning", "ready"]
    );
  });

  it("flips status back to failed and returns 502 with the friendly message when HeyGen rejects", async () => {
    storage.seed({ id: "v2", userId: "user-1", name: "Casey" });
    const app = buildApp({
      storage,
      cloneVoice: async () => {
        throw new Error("Voice sample is too short — please record at least 30 seconds.");
      },
    });

    const { status, body } = await call(app, "v2");

    assert.equal(status, 502);
    assert.match((body as { error: string }).error, /at least 30 seconds/);
    assert.equal(storage.voices.get("v2")!.status, "failed");
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
