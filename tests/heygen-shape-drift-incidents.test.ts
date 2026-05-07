import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";

import {
  HeygenResponseValidationError,
} from "../shared/heygenPhotoAvatarSchemas";
import {
  classifyVoiceDesignError,
  createV3PhotoAvatarConsentHandler,
  createV3PhotoAvatarsHandler,
  createV3VoicesDesignHandler,
  setHeygenShapeDriftIncidentRecorder,
  type V3ConsentServiceLike,
  type V3CreateAvatarServiceLike,
  type V3CreateAvatarStorageLike,
  type V3DesignVoiceServiceLike,
  type V3DesignVoiceStorageLike,
} from "../server/routes/heygen-v3";
import type { InsertHeygenShapeDriftIncident } from "@shared/schema";

function makeShapeDriftError(endpoint: string, groupId?: string) {
  const issues = z
    .object({ data: z.object({ video_id: z.string() }) })
    .safeParse({ data: { other: 1 } });
  assert.equal(issues.success, false);
  const zissues = !issues.success ? issues.error.issues : [];
  return new HeygenResponseValidationError(endpoint, zissues, {}, groupId);
}

let recorded: InsertHeygenShapeDriftIncident[] = [];

beforeEach(() => {
  recorded = [];
  setHeygenShapeDriftIncidentRecorder((incident) => {
    recorded.push(incident);
    return Promise.resolve();
  });
});

afterEach(() => {
  setHeygenShapeDriftIncidentRecorder(null);
});

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

function appWithUser(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: { id: string } }).user = { id: userId };
    next();
  });
  return app;
}

// Allow async incident recording (Promise.resolve().then(...)) to flush
// before assertions.
async function flushMicrotasks() {
  await new Promise((r) => setImmediate(r));
}

describe("heygen shape-drift incident recording", () => {
  it("records an incident from the consent handler with userId + endpoint", async () => {
    const service: V3ConsentServiceLike = {
      async createConsent() {
        throw makeShapeDriftError("/v3/consent", "grp_xyz");
      },
    };
    const app = appWithUser("user-42");
    app.post(
      "/api/v3/photo-avatars/:groupId/consent",
      createV3PhotoAvatarConsentHandler({
        storage: {
          async getPhotoAvatarGroupByHeygenIdAndUser() {
            return { id: "row-1" };
          },
          async updatePhotoAvatarGroup() {
            return { id: "row-1" };
          },
        },
        getV3Service: () => service,
      }),
    );

    const { status, body } = await postJson(
      app,
      "/api/v3/photo-avatars/grp_xyz/consent",
      { action: "approve", consentVideoUrl: "https://v/example.mp4" },
    );
    await flushMicrotasks();

    assert.equal(status, 502);
    assert.equal(body.error, "heygen_shape_drift");
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].endpoint, "/v3/consent");
    assert.equal(recorded[0].userId, "user-42");
    assert.equal(recorded[0].groupId, "grp_xyz");
    assert.ok(Array.isArray(recorded[0].issuePaths));
    assert.ok(recorded[0].issuePaths!.length > 0);
    assert.ok(typeof recorded[0].message === "string");
  });

  it("records an incident from the create-avatar handler", async () => {
    const storage: V3CreateAvatarStorageLike = {
      async createPhotoAvatarGroup() {
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
    const app = appWithUser("user-1");
    app.post(
      "/api/v3/photo-avatars",
      createV3PhotoAvatarsHandler({ storage, getV3Service: () => service }),
    );

    const { status } = await postJson(app, "/api/v3/photo-avatars", {
      name: "Mike",
      imageKey: "img_abc",
      consentAcknowledged: true,
    });
    await flushMicrotasks();

    assert.equal(status, 502);
    assert.equal(recorded.length, 1);
    assert.equal(
      recorded[0].endpoint,
      "/v2/photo_avatar/avatar_group/create",
    );
    assert.equal(recorded[0].userId, "user-1");
  });

  it("records an incident from the voice-design handler via classifyVoiceDesignError", async () => {
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
    const app = appWithUser("user-7");
    app.post(
      "/api/v3/voices/design",
      createV3VoicesDesignHandler({ storage, getV3Service: () => service }),
    );

    const { status, body } = await postJson(app, "/api/v3/voices/design", {
      name: "My Voice",
      description: "Warm narrator",
    });
    await flushMicrotasks();

    assert.equal(status, 502);
    assert.equal(body.error, "heygen_shape_drift");
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].endpoint, "/v3/voices/design");
    assert.equal(recorded[0].userId, "user-7");
  });

  it("does not record an incident for non-validation errors", async () => {
    const service: V3ConsentServiceLike = {
      async createConsent() {
        throw new Error("network down");
      },
    };
    const app = appWithUser("user-1");
    app.post(
      "/api/v3/photo-avatars/:groupId/consent",
      createV3PhotoAvatarConsentHandler({
        storage: {
          async getPhotoAvatarGroupByHeygenIdAndUser() {
            return { id: "row-1" };
          },
          async updatePhotoAvatarGroup() {
            return { id: "row-1" };
          },
        },
        getV3Service: () => service,
      }),
    );

    const { status, body } = await postJson(
      app,
      "/api/v3/photo-avatars/grp_xyz/consent",
      { action: "approve", consentVideoUrl: "https://v/example.mp4" },
    );
    await flushMicrotasks();

    assert.equal(status, 502);
    assert.equal(body.error, "heygen_v3_consent_failed");
    assert.equal(recorded.length, 0);
  });

  it("classifyVoiceDesignError records once per shape-drift error with passed userId", async () => {
    const err = makeShapeDriftError("/v3/voices/design");
    const result = classifyVoiceDesignError(err, "user-99");
    await flushMicrotasks();

    assert.equal(result.code, "heygen_shape_drift");
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].endpoint, "/v3/voices/design");
    assert.equal(recorded[0].userId, "user-99");
  });

  it("does not throw if the recorder rejects", async () => {
    setHeygenShapeDriftIncidentRecorder(() => {
      throw new Error("db unavailable");
    });
    const err = makeShapeDriftError("/v3/voices");
    assert.doesNotThrow(() => classifyVoiceDesignError(err, "user-1"));
    await flushMicrotasks();
  });
});
