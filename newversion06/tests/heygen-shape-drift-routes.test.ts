import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import {
  HEYGEN_SHAPE_DRIFT_ERROR_CODE,
  HeygenResponseValidationError,
  heygenShapeDriftErrorPayload,
} from "../shared/heygenPhotoAvatarSchemas";
import {
  classifyVoiceDesignError,
  createV3PhotoAvatarConsentHandler,
  createV3PhotoAvatarsHandler,
  createV3VoicesDesignHandler,
  type V3ConsentServiceLike,
  type V3ConsentStorageLike,
  type V3CreateAvatarServiceLike,
  type V3CreateAvatarStorageLike,
  type V3DesignVoiceServiceLike,
  type V3DesignVoiceStorageLike,
} from "../server/routes/heygen-v3";

function makeShapeDriftError(endpoint: string, groupId?: string) {
  // Build a real ZodIssue list so the error mirrors what `parseOrThrow`
  // produces in the wild — that way the test exercises the same code paths
  // (issue truncation, path joining, etc.) as the production parser.
  const issues = z
    .object({ data: z.object({ video_id: z.string() }) })
    .safeParse({ data: { other: 1 } });
  assert.equal(issues.success, false);
  const zissues = !issues.success ? issues.error.issues : [];
  return new HeygenResponseValidationError(endpoint, zissues, {}, groupId);
}

function buildAppWithConsent(opts: {
  service: V3ConsentServiceLike;
  storage?: V3ConsentStorageLike;
}) {
  const storage: V3ConsentStorageLike = opts.storage ?? {
    async getPhotoAvatarGroupByHeygenIdAndUser(_id, _userId) {
      return { id: "row-1" };
    },
    async updatePhotoAvatarGroup() {
      return { id: "row-1" };
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: { id: string } }).user = { id: "user-1" };
    next();
  });
  app.post(
    "/api/v3/photo-avatars/:groupId/consent",
    createV3PhotoAvatarConsentHandler({
      storage,
      getV3Service: () => opts.service,
    }),
  );
  return app;
}

async function postJson(
  app: express.Express,
  url: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(`http://127.0.0.1:${port}${url}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await r.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        resolve({ status: r.status, body: json });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe("heygenShapeDriftErrorPayload", () => {
  it("uses the shared error code and includes the endpoint + truncated issue paths", () => {
    const err = makeShapeDriftError("/v3/voices");
    const payload = heygenShapeDriftErrorPayload(err);
    assert.equal(payload.error, HEYGEN_SHAPE_DRIFT_ERROR_CODE);
    assert.equal(payload.error, "heygen_shape_drift");
    assert.equal(payload.endpoint, "/v3/voices");
    assert.ok(payload.message.includes("/v3/voices"));
    assert.ok(payload.message.includes("Please retry"));
    assert.ok(payload.message.includes("support"));
    assert.ok(payload.issuePaths.length > 0);
    assert.ok(payload.issuePaths.length <= 5);
  });
});

describe("classifyVoiceDesignError", () => {
  it("returns the heygen_shape_drift code when the error is a HeygenResponseValidationError", () => {
    const err = makeShapeDriftError("/v3/voices/design");
    const result = classifyVoiceDesignError(err);
    assert.equal(result.httpStatus, 502);
    assert.equal(result.code, HEYGEN_SHAPE_DRIFT_ERROR_CODE);
    assert.ok(result.message.includes("/v3/voices/design"));
  });
});

describe("POST /api/v3/photo-avatars/:groupId/consent — shape drift", () => {
  it("responds 502 with the heygen_shape_drift envelope when createConsent throws a validation error", async () => {
    const service: V3ConsentServiceLike = {
      async createConsent() {
        throw makeShapeDriftError("/v3/consent", "grp_xyz");
      },
    };
    const app = buildAppWithConsent({ service });
    const { status, body } = await postJson(
      app,
      "/api/v3/photo-avatars/grp_xyz/consent",
      { action: "approve", consentVideoUrl: "https://v/example.mp4" },
    );
    assert.equal(status, 502);
    assert.equal(body.error, HEYGEN_SHAPE_DRIFT_ERROR_CODE);
    assert.equal(body.endpoint, "/v3/consent");
    assert.ok(typeof body.message === "string");
    assert.ok(Array.isArray(body.issuePaths));
  });

  it("still returns the legacy heygen_v3_consent_failed code for non-validation errors", async () => {
    const service: V3ConsentServiceLike = {
      async createConsent() {
        throw new Error("network down");
      },
    };
    const app = buildAppWithConsent({ service });
    const { status, body } = await postJson(
      app,
      "/api/v3/photo-avatars/grp_xyz/consent",
      { action: "approve", consentVideoUrl: "https://v/example.mp4" },
    );
    assert.equal(status, 502);
    assert.equal(body.error, "heygen_v3_consent_failed");
  });
});

describe("POST /api/v3/photo-avatars — shape drift on createAvatar", () => {
  it("responds 502 with the heygen_shape_drift envelope and skips persistence", async () => {
    let createCount = 0;
    const storage: V3CreateAvatarStorageLike = {
      async createPhotoAvatarGroup() {
        createCount += 1;
        return { id: "row-1" };
      },
    };
    const service: V3CreateAvatarServiceLike = {
      async createAvatar() {
        throw makeShapeDriftError("/v2/photo_avatar/avatar_group/create");
      },
      async createConsent() {
        return { consent_id: "c1", status: "approved" as const };
      },
    };
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { id: string } }).user = { id: "user-1" };
      next();
    });
    app.post(
      "/api/v3/photo-avatars",
      createV3PhotoAvatarsHandler({ storage, getV3Service: () => service }),
    );
    const { status, body } = await postJson(app, "/api/v3/photo-avatars", {
      name: "Mike",
      imageKey: "img_abc",
      consentAcknowledged: true,
    });
    assert.equal(status, 502);
    assert.equal(body.error, HEYGEN_SHAPE_DRIFT_ERROR_CODE);
    assert.equal(body.endpoint, "/v2/photo_avatar/avatar_group/create");
    assert.equal(createCount, 0, "must not persist when HeyGen drift fires");
  });
});

describe("POST /api/v3/voices/design — shape drift", () => {
  it("responds 502 with the heygen_shape_drift envelope when designVoice throws a validation error", async () => {
    const storage: V3DesignVoiceStorageLike = {
      async createCustomVoice() {
        return { id: "voice-1" };
      },
    };
    const service: V3DesignVoiceServiceLike = {
      async designVoice() {
        throw makeShapeDriftError("/v3/voices/design");
      },
    };
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { id: string } }).user = { id: "user-1" };
      next();
    });
    app.post(
      "/api/v3/voices/design",
      createV3VoicesDesignHandler({ storage, getV3Service: () => service }),
    );
    const { status, body } = await postJson(app, "/api/v3/voices/design", {
      name: "My Voice",
      description: "Warm narrator",
    });
    assert.equal(status, 502);
    assert.equal(body.error, HEYGEN_SHAPE_DRIFT_ERROR_CODE);
    assert.ok(
      typeof body.message === "string" &&
        (body.message as string).includes("/v3/voices/design"),
    );
  });
});
