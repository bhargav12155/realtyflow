import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  classifyVoiceDesignError,
  createV3VoicesDesignHandler,
  type V3DesignVoiceServiceLike,
  type V3DesignVoiceStorageLike,
} from "../server/routes/heygen-v3";
import { HeyGenV3Error } from "../server/services/heygen-v3";

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

  it("returns 429 voice_design_rate_limited when HeyGen rate-limits", async () => {
    const { service } = makeService({});
    service.designVoice = async () => {
      throw new HeyGenV3Error(
        "rate limited",
        429,
        JSON.stringify({ message: "Too many requests" }),
      );
    };
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Narrator",
      description: "anything",
    });
    assert.equal(status, 429);
    assert.equal(body.error, "voice_design_rate_limited");
    assert.equal(storage.created.length, 0);
  });

  it("returns 502 voice_design_unauthorized when HeyGen returns 401", async () => {
    const { service } = makeService({});
    service.designVoice = async () => {
      throw new HeyGenV3Error(
        "unauthorized",
        401,
        JSON.stringify({ message: "Invalid API key" }),
      );
    };
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Narrator",
      description: "anything",
    });
    assert.equal(status, 502);
    assert.equal(body.error, "voice_design_unauthorized");
    assert.equal(storage.created.length, 0);
  });

  it("returns 402 voice_design_quota_exceeded when HeyGen returns 402", async () => {
    const { service } = makeService({});
    service.designVoice = async () => {
      throw new HeyGenV3Error(
        "payment required",
        402,
        JSON.stringify({ message: "quota exhausted" }),
      );
    };
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Narrator",
      description: "anything",
    });
    assert.equal(status, 402);
    assert.equal(body.error, "voice_design_quota_exceeded");
    assert.equal(storage.created.length, 0);
  });

  it("returns 400 voice_design_invalid_description when HeyGen returns 400", async () => {
    const { service } = makeService({});
    service.designVoice = async () => {
      throw new HeyGenV3Error(
        "bad request",
        400,
        JSON.stringify({ message: "invalid description" }),
      );
    };
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Narrator",
      description: "anything",
    });
    assert.equal(status, 400);
    assert.equal(body.error, "voice_design_invalid_description");
    assert.equal(storage.created.length, 0);
  });

  it("returns 502 voice_design_unavailable when HeyGen returns 5xx", async () => {
    const { service } = makeService({});
    service.designVoice = async () => {
      throw new HeyGenV3Error(
        "server error",
        503,
        JSON.stringify({ message: "service unavailable" }),
      );
    };
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Narrator",
      description: "anything",
    });
    assert.equal(status, 502);
    assert.equal(body.error, "voice_design_unavailable");
    assert.equal(storage.created.length, 0);
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

describe("classifyVoiceDesignError", () => {
  it("maps 429 to voice_design_rate_limited @ 429", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("rate", 429, JSON.stringify({ message: "Too many requests" })),
    );
    assert.equal(r.httpStatus, 429);
    assert.equal(r.code, "voice_design_rate_limited");
  });

  it("maps 401 to voice_design_unauthorized @ 502", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("auth", 401, JSON.stringify({ message: "Invalid API key" })),
    );
    assert.equal(r.httpStatus, 502);
    assert.equal(r.code, "voice_design_unauthorized");
  });

  it("maps 403 to voice_design_unauthorized @ 502", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("forbidden", 403, JSON.stringify({ message: "forbidden" })),
    );
    assert.equal(r.httpStatus, 502);
    assert.equal(r.code, "voice_design_unauthorized");
  });

  it("maps 402 to voice_design_quota_exceeded @ 402", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("payment", 402, JSON.stringify({ message: "quota exhausted" })),
    );
    assert.equal(r.httpStatus, 402);
    assert.equal(r.code, "voice_design_quota_exceeded");
  });

  it("maps quota-text 200 body to voice_design_quota_exceeded @ 402", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("biz", 200, JSON.stringify({ message: "not enough credits" })),
    );
    assert.equal(r.httpStatus, 402);
    assert.equal(r.code, "voice_design_quota_exceeded");
  });

  it("maps 400 to voice_design_invalid_description @ 400", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("bad", 400, JSON.stringify({ message: "invalid description" })),
    );
    assert.equal(r.httpStatus, 400);
    assert.equal(r.code, "voice_design_invalid_description");
  });

  it("maps moderation text to voice_design_invalid_description @ 400", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("mod", 422, JSON.stringify({ message: "content policy violation" })),
    );
    assert.equal(r.httpStatus, 400);
    assert.equal(r.code, "voice_design_invalid_description");
  });

  it("maps 500 to voice_design_unavailable @ 502", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("oops", 500, JSON.stringify({ message: "internal" })),
    );
    assert.equal(r.httpStatus, 502);
    assert.equal(r.code, "voice_design_unavailable");
  });

  it("maps 503 to voice_design_unavailable @ 502", () => {
    const r = classifyVoiceDesignError(
      new HeyGenV3Error("oops", 503, JSON.stringify({ message: "unavailable" })),
    );
    assert.equal(r.httpStatus, 502);
    assert.equal(r.code, "voice_design_unavailable");
  });

  it("falls back to heygen_v3_voice_design_failed @ 502 for unknown errors", () => {
    const r = classifyVoiceDesignError(new Error("totally unexpected"));
    assert.equal(r.httpStatus, 502);
    assert.equal(r.code, "heygen_v3_voice_design_failed");
  });
});
