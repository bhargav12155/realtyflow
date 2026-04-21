import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  createV3PhotoAvatarsHandler,
  type V3CreateAvatarServiceLike,
  type V3CreateAvatarStorageLike,
} from "../server/routes/heygen-v3";

interface CreatedGroupRow {
  userId: string;
  heygenGroupId: string;
  groupName: string;
  imageHash: string | null;
  s3ImageUrl: string | null;
  heygenImageKey: string;
  trainingStatus: string;
  apiVersion: string;
  consentStatus: "pending" | "approved" | "revoked";
}

class FakeStorage implements V3CreateAvatarStorageLike {
  created: CreatedGroupRow[] = [];
  failNext = false;

  async createPhotoAvatarGroup(group: CreatedGroupRow): Promise<unknown> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("db down");
    }
    this.created.push(group);
    return { id: `row-${this.created.length}`, ...group };
  }
}

interface FakeServiceCalls {
  createAvatar: Array<{ name: string; imageKey: string }>;
  createConsent: Array<{
    groupId: string;
    consentVideoUrl?: string;
    signature?: string;
  }>;
}

function makeService(opts: {
  groupId?: string;
  consentStatus?: "pending" | "approved" | "revoked";
  createAvatarFails?: boolean;
  createConsentFails?: boolean;
}): { service: V3CreateAvatarServiceLike; calls: FakeServiceCalls } {
  const calls: FakeServiceCalls = { createAvatar: [], createConsent: [] };
  const service: V3CreateAvatarServiceLike = {
    async createAvatar(input) {
      calls.createAvatar.push(input);
      if (opts.createAvatarFails) throw new Error("heygen down");
      return { group_id: opts.groupId ?? "grp_123" };
    },
    async createConsent(input) {
      calls.createConsent.push(input);
      if (opts.createConsentFails) throw new Error("consent failed");
      return {
        consent_id: "consent_1",
        status: opts.consentStatus ?? "approved",
      };
    },
  };
  return { service, calls };
}

interface BuildAppOpts {
  storage: FakeStorage;
  service: V3CreateAvatarServiceLike;
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
    "/api/v3/photo-avatars",
    createV3PhotoAvatarsHandler({
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
        const r = await fetch(`http://127.0.0.1:${port}/api/v3/photo-avatars`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const respBody = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        resolve({ status: r.status, body: respBody });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe("POST /api/v3/photo-avatars", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("returns 400 with consent_required when consentAcknowledged is missing", async () => {
    const { service, calls } = makeService({});
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Mike",
      imageKey: "img_abc",
    });
    assert.equal(status, 400);
    assert.equal(body.error, "consent_required");
    assert.equal(
      calls.createAvatar.length,
      0,
      "must not create the HeyGen avatar when consent is missing",
    );
    assert.equal(storage.created.length, 0, "must not persist any group row");
  });

  it("returns 400 with consent_required when consentAcknowledged is explicitly false", async () => {
    const { service, calls } = makeService({});
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Mike",
      imageKey: "img_abc",
      consentAcknowledged: false,
    });
    assert.equal(status, 400);
    assert.equal(body.error, "consent_required");
    assert.equal(calls.createAvatar.length, 0);
  });

  it("returns 400 when name or imageKey is missing", async () => {
    const { service } = makeService({});
    const app = buildApp({ storage, service });
    const r1 = await call(app, { imageKey: "img_abc", consentAcknowledged: true });
    assert.equal(r1.status, 400);
    assert.equal(r1.body.error, "name_and_image_key_required");
    const r2 = await call(app, { name: "Mike", consentAcknowledged: true });
    assert.equal(r2.status, 400);
    assert.equal(r2.body.error, "name_and_image_key_required");
  });

  it("happy path: persists the group with apiVersion='v3' and consentStatus='pending' when no consent video is supplied", async () => {
    const { service, calls } = makeService({ groupId: "grp_xyz" });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "  Mike  ",
      imageKey: "img_abc",
      imageHash: "hash_1",
      s3ImageUrl: "https://s3/bucket/img_abc.jpg",
      consentAcknowledged: true,
    });

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.groupId, "grp_xyz");
    assert.equal(body.apiVersion, "v3");
    assert.equal(body.consentStatus, "pending");

    assert.deepEqual(calls.createAvatar, [
      { name: "Mike", imageKey: "img_abc" },
    ]);
    // No consent video URL → must NOT call createConsent at create time.
    assert.equal(calls.createConsent.length, 0);

    assert.equal(storage.created.length, 1);
    const row = storage.created[0];
    assert.equal(row.userId, "user-1");
    assert.equal(row.heygenGroupId, "grp_xyz");
    assert.equal(row.groupName, "Mike", "name must be trimmed before persisting");
    assert.equal(row.imageHash, "hash_1");
    assert.equal(row.s3ImageUrl, "https://s3/bucket/img_abc.jpg");
    assert.equal(row.heygenImageKey, "img_abc");
    assert.equal(row.trainingStatus, "pending");
    assert.equal(row.apiVersion, "v3");
    assert.equal(row.consentStatus, "pending");
  });

  it("flips consentStatus to 'approved' when a consent video URL is supplied and the service approves it", async () => {
    const { service, calls } = makeService({
      groupId: "grp_xyz",
      consentStatus: "approved",
    });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Mike",
      imageKey: "img_abc",
      consentAcknowledged: true,
      consentVideoUrl: "https://videos/example.mp4",
    });

    assert.equal(status, 200);
    assert.equal(body.consentStatus, "approved");
    assert.equal(calls.createConsent.length, 1);
    assert.deepEqual(calls.createConsent[0], {
      groupId: "grp_xyz",
      consentVideoUrl: "https://videos/example.mp4",
      signature: undefined,
    });
    assert.equal(storage.created[0].consentStatus, "approved");
  });

  it("falls back to consentStatus='pending' when consent recording throws (group still persisted)", async () => {
    const { service, calls } = makeService({
      createConsentFails: true,
      groupId: "grp_xyz",
    });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Mike",
      imageKey: "img_abc",
      consentAcknowledged: true,
      consentVideoUrl: "https://videos/example.mp4",
    });
    assert.equal(status, 200);
    assert.equal(body.consentStatus, "pending");
    assert.equal(calls.createConsent.length, 1);
    assert.equal(storage.created[0].consentStatus, "pending");
  });

  it("returns 502 when HeyGen createAvatar fails (no row persisted)", async () => {
    const { service } = makeService({ createAvatarFails: true });
    const app = buildApp({ storage, service });
    const { status, body } = await call(app, {
      name: "Mike",
      imageKey: "img_abc",
      consentAcknowledged: true,
    });
    assert.equal(status, 502);
    assert.equal(body.error, "heygen_v3_create_failed");
    assert.equal(storage.created.length, 0);
  });

  it("returns 401 when there is no authenticated user", async () => {
    const { service, calls } = makeService({});
    const app = buildApp({ storage, service, userId: null });
    const { status, body } = await call(app, {
      name: "Mike",
      imageKey: "img_abc",
      consentAcknowledged: true,
    });
    assert.equal(status, 401);
    assert.equal(body.error, "unauthorized");
    assert.equal(calls.createAvatar.length, 0);
  });
});
