import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  createV3VoicesDesignHandler,
  type V3DesignVoiceServiceLike,
  type V3DesignVoiceStorageLike,
} from "../server/routes/heygen-v3";

interface CreatedVoiceRow {
  userId: string;
  name: string;
  audioUrl: string;
  fileSize: number | null;
  heygenAudioAssetId: string | null;
  status: string;
  heygenVoiceId: string;
  language: string | null;
  gender: string | null;
  sampleAudioUrl: string | null;
}

class FakeStorage implements V3DesignVoiceStorageLike {
  created: CreatedVoiceRow[] = [];

  async createCustomVoice(voice: CreatedVoiceRow): Promise<unknown> {
    this.created.push(voice);
    return { id: `voice-${this.created.length}`, ...voice };
  }
}

interface FakeServiceCalls {
  designVoice: Array<{
    name: string;
    description: string;
    language?: string;
    gender?: string;
  }>;
}

function makeService(opts: {
  voiceId?: string;
  previewUrl?: string | undefined;
  designFails?: boolean;
}): { service: V3DesignVoiceServiceLike; calls: FakeServiceCalls } {
  const calls: FakeServiceCalls = { designVoice: [] };
  const service: V3DesignVoiceServiceLike = {
    async designVoice(input) {
      calls.designVoice.push(input);
      if (opts.designFails) throw new Error("heygen down");
      return {
        voice_id: opts.voiceId ?? "voice_abc",
        preview_url: opts.previewUrl,
      };
    },
  };
  return { service, calls };
}

interface BuildAppOpts {
  storage: FakeStorage;
  service: V3DesignVoiceServiceLike;
  userId?: string | null;
}

function buildApp({ storage, service, userId = "user-1" }: BuildAppOpts) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId)
      (req as Request & { user: { id: string } }).user = { id: userId };
    next();
  });
  app.post(
    "/api/v3/voices/design",
    createV3VoicesDesignHandler({
      storage,
      getV3Service: () => service,
    }),
  );
  return app;
}

async function call(
  app: express.Express,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(`http://127.0.0.1:${port}/api/v3/voices/design`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const respBody = (await r.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        resolve({ status: r.status, body: respBody });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe("POST /api/v3/voices/design", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("save:false returns a preview without inserting into custom_voices", async () => {
    const { service, calls } = makeService({
      voiceId: "voice_xyz",
      previewUrl: "https://heygen/preview.mp3",
    });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      description: "warm friendly female narrator",
      language: "English",
      gender: "Female",
      save: false,
    });

    assert.equal(status, 200);
    assert.deepEqual(body, {
      preview: {
        heygenVoiceId: "voice_xyz",
        previewUrl: "https://heygen/preview.mp3",
        language: "English",
        gender: "Female",
      },
    });
    assert.equal(calls.designVoice.length, 1);
    assert.equal(calls.designVoice[0].description, "warm friendly female narrator");
    assert.equal(calls.designVoice[0].language, "English");
    assert.equal(calls.designVoice[0].gender, "Female");
    // Crucially: no row inserted on a preview-only call.
    assert.equal(storage.created.length, 0);
  });

  it("save:false does not require a name", async () => {
    const { service } = makeService({ voiceId: "voice_xyz" });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      description: "calm british male",
      save: false,
    });
    assert.equal(status, 200);
    assert.equal(
      (body.preview as { heygenVoiceId: string }).heygenVoiceId,
      "voice_xyz",
    );
    assert.equal(storage.created.length, 0);
  });

  it("default save:true synthesises and inserts a custom_voices row", async () => {
    const { service, calls } = makeService({
      voiceId: "voice_def",
      previewUrl: "https://heygen/sample.mp3",
    });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "  My Narrator  ",
      description: "warm friendly female narrator",
      language: "English",
      gender: "Female",
    });

    assert.equal(status, 201);
    assert.equal(calls.designVoice.length, 1);
    assert.equal(storage.created.length, 1);
    const row = storage.created[0];
    assert.equal(row.userId, "user-1");
    assert.equal(row.name, "My Narrator", "name must be trimmed before persisting");
    assert.equal(row.heygenVoiceId, "voice_def");
    assert.equal(row.audioUrl, "https://heygen/sample.mp3");
    assert.equal(row.sampleAudioUrl, "https://heygen/sample.mp3");
    assert.equal(row.language, "English");
    assert.equal(row.gender, "Female");
    assert.equal(row.status, "ready");
    assert.equal((body as { heygenVoiceId: string }).heygenVoiceId, "voice_def");
  });

  it("save:true with previewVoiceId persists without calling HeyGen again", async () => {
    const { service, calls } = makeService({ voiceId: "should-not-be-used" });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Saved Voice",
      previewVoiceId: "voice_already_previewed",
      previewUrl: "https://heygen/already.mp3",
      language: "Spanish",
      gender: "Male",
    });

    assert.equal(status, 201);
    // Critical: no second HeyGen synthesis call.
    assert.equal(
      calls.designVoice.length,
      0,
      "must not re-synthesise when a preview voice id is supplied",
    );
    assert.equal(storage.created.length, 1);
    const row = storage.created[0];
    assert.equal(row.heygenVoiceId, "voice_already_previewed");
    assert.equal(row.audioUrl, "https://heygen/already.mp3");
    assert.equal(row.sampleAudioUrl, "https://heygen/already.mp3");
    assert.equal(row.language, "Spanish");
    assert.equal(row.gender, "Male");
    assert.equal(
      (body as { heygenVoiceId: string }).heygenVoiceId,
      "voice_already_previewed",
    );
  });

  it("rejects save:true without a name", async () => {
    const { service, calls } = makeService({});
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      description: "anything",
    });
    assert.equal(status, 400);
    assert.equal(body.error, "name is required");
    assert.equal(calls.designVoice.length, 0);
    assert.equal(storage.created.length, 0);
  });

  it("rejects when description is missing and there is no previewVoiceId to fall back on", async () => {
    const { service, calls } = makeService({});
    const app = buildApp({ storage, service });

    // save:false without description
    const r1 = await call(app, { save: false });
    assert.equal(r1.status, 400);
    assert.equal(r1.body.error, "description is required");

    // save:true (default) with a name but no description and no previewVoiceId
    const r2 = await call(app, { name: "Something" });
    assert.equal(r2.status, 400);
    assert.equal(r2.body.error, "description is required");

    assert.equal(calls.designVoice.length, 0);
    assert.equal(storage.created.length, 0);
  });

  it("returns 401 when there is no authenticated user", async () => {
    const { service, calls } = makeService({});
    const app = buildApp({ storage, service, userId: null });
    const { status, body } = await call(app, {
      description: "anything",
      save: false,
    });
    assert.equal(status, 401);
    assert.equal(body.error, "unauthorized");
    assert.equal(calls.designVoice.length, 0);
  });

  it("returns 502 when HeyGen designVoice fails (no row persisted)", async () => {
    const { service } = makeService({ designFails: true });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Narrator",
      description: "anything",
    });
    assert.equal(status, 502);
    assert.equal(body.error, "heygen_v3_voice_design_failed");
    assert.equal(storage.created.length, 0);
  });
});
