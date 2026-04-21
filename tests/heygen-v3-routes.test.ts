import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  createV3PhotoAvatarsHandler,
  createV3PhotoAvatarConsentHandler,
  createUseV3VoiceHandler,
  type V3CreateAvatarServiceLike,
  type V3CreateAvatarStorageLike,
  type V3ConsentServiceLike,
  type V3ConsentStorageLike,
  type V3UseVoiceStorageLike,
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

// -------------------------------------------------------------------
// POST /api/v3/photo-avatars/:groupId/consent
// -------------------------------------------------------------------

interface ConsentUpdate {
  id: string;
  updates: { consentStatus?: "pending" | "approved" | "revoked" };
}

class FakeConsentStorage implements V3ConsentStorageLike {
  groups: Array<{ id: string; heygenGroupId: string; userId: string }> = [];
  updates: ConsentUpdate[] = [];

  async getPhotoAvatarGroupByHeygenIdAndUser(
    heygenGroupId: string,
    userId: string,
  ): Promise<{ id: string } | undefined> {
    return this.groups.find(
      (g) => g.heygenGroupId === heygenGroupId && g.userId === userId,
    );
  }

  async updatePhotoAvatarGroup(
    id: string,
    updates: { consentStatus?: "pending" | "approved" | "revoked" },
  ): Promise<unknown> {
    this.updates.push({ id, updates });
    return { id, ...updates };
  }
}

interface ConsentServiceCalls {
  createConsent: Array<{
    groupId: string;
    consentVideoUrl?: string;
    signature?: string;
  }>;
}

function makeConsentService(opts: {
  status?: "pending" | "approved" | "revoked";
  fails?: boolean;
}): { service: V3ConsentServiceLike; calls: ConsentServiceCalls } {
  const calls: ConsentServiceCalls = { createConsent: [] };
  const service: V3ConsentServiceLike = {
    async createConsent(input) {
      calls.createConsent.push(input);
      if (opts.fails) throw new Error("heygen consent failed");
      return {
        consent_id: "c_1",
        status: opts.status ?? "approved",
      };
    },
  };
  return { service, calls };
}

interface BuildConsentAppOpts {
  storage: FakeConsentStorage;
  service: V3ConsentServiceLike;
  userId?: string | null;
}

function buildConsentApp({
  storage,
  service,
  userId = "user-1",
}: BuildConsentAppOpts) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId)
      (req as Request & { user: { id: string } }).user = { id: userId };
    next();
  });
  app.post(
    "/api/v3/photo-avatars/:groupId/consent",
    createV3PhotoAvatarConsentHandler({
      storage,
      getV3Service: () => service,
    }),
  );
  return app;
}

async function callConsent(
  app: express.Express,
  groupId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(
          `http://127.0.0.1:${port}/api/v3/photo-avatars/${encodeURIComponent(
            groupId,
          )}/consent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
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

// -------------------------------------------------------------------
// POST /api/v3/voices/use
// -------------------------------------------------------------------

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

class FakeVoiceStorage implements V3UseVoiceStorageLike {
  created: CreatedVoiceRow[] = [];
  failNext = false;

  async createCustomVoice(voice: CreatedVoiceRow): Promise<unknown> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("db unreachable");
    }
    this.created.push(voice);
    return { id: `voice-${this.created.length}`, ...voice };
  }
}

function buildUseVoiceApp(opts: {
  storage: FakeVoiceStorage;
  userId?: string | null;
}) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (opts.userId !== null && opts.userId !== undefined)
      (req as Request & { user: { id: string } }).user = { id: opts.userId };
    else if (opts.userId === undefined)
      (req as Request & { user: { id: string } }).user = { id: "user-1" };
    next();
  });
  app.post("/api/v3/voices/use", createUseV3VoiceHandler({ storage: opts.storage }));
  return app;
}

async function callUseVoice(app: express.Express, body: Record<string, unknown>) {
  return await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(`http://127.0.0.1:${port}/api/v3/voices/use`, {
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

describe("POST /api/v3/photo-avatars/:groupId/consent", () => {
  let storage: FakeConsentStorage;
  beforeEach(() => {
    storage = new FakeConsentStorage();
    storage.groups.push({
      id: "row_1",
      heygenGroupId: "grp_xyz",
      userId: "user-1",
    });
  });

  it("returns 401 when there is no authenticated user", async () => {
    const { service, calls } = makeConsentService({});
    const app = buildConsentApp({ storage, service, userId: null });
    const { status, body } = await callConsent(app, "grp_xyz", {});
    assert.equal(status, 401);
    assert.equal(body.error, "unauthorized");
    assert.equal(calls.createConsent.length, 0);
    assert.equal(storage.updates.length, 0);
  });

  it("returns 404 when the group is not owned by the caller (non-owner cannot approve or revoke)", async () => {
    const { service, calls } = makeConsentService({});
    const app = buildConsentApp({ storage, service, userId: "intruder" });
    const { status, body } = await callConsent(app, "grp_xyz", {
      action: "approve",
      consentVideoUrl: "https://videos/c.mp4",
    });
    assert.equal(status, 404);
    assert.equal(body.error, "group_not_found");
    assert.equal(calls.createConsent.length, 0);
    assert.equal(storage.updates.length, 0);
  });

  it("returns 404 for the revoke action when the group does not exist for the caller", async () => {
    const { service, calls } = makeConsentService({});
    const app = buildConsentApp({ storage, service });
    const { status, body } = await callConsent(app, "grp_unknown", {
      action: "revoke",
    });
    assert.equal(status, 404);
    assert.equal(body.error, "group_not_found");
    assert.equal(calls.createConsent.length, 0);
    assert.equal(storage.updates.length, 0);
  });

  it("approve path requires at least a consent video URL or signature", async () => {
    const { service, calls } = makeConsentService({});
    const app = buildConsentApp({ storage, service });
    const { status, body } = await callConsent(app, "grp_xyz", {
      action: "approve",
    });
    assert.equal(status, 400);
    assert.equal(body.error, "consent_video_url_or_signature_required");
    assert.equal(
      calls.createConsent.length,
      0,
      "must not call HeyGen when neither field is supplied",
    );
    assert.equal(
      storage.updates.length,
      0,
      "must not flip the DB status without proof of consent",
    );
  });

  it("approve path defaults action when omitted and forwards consent video URL to HeyGen", async () => {
    const { service, calls } = makeConsentService({ status: "approved" });
    const app = buildConsentApp({ storage, service });
    const { status, body } = await callConsent(app, "grp_xyz", {
      consentVideoUrl: "https://videos/consent.mp4",
    });
    assert.equal(status, 200);
    assert.equal(body.status, "approved");
    assert.equal(calls.createConsent.length, 1);
    assert.deepEqual(calls.createConsent[0], {
      groupId: "grp_xyz",
      consentVideoUrl: "https://videos/consent.mp4",
      signature: undefined,
    });
    assert.equal(storage.updates.length, 1);
    assert.deepEqual(storage.updates[0], {
      id: "row_1",
      updates: { consentStatus: "approved" },
    });
  });

  it("approve path accepts a signature alone (no video URL needed)", async () => {
    const { service, calls } = makeConsentService({ status: "approved" });
    const app = buildConsentApp({ storage, service });
    const { status, body } = await callConsent(app, "grp_xyz", {
      action: "approve",
      signature: "Jane Doe",
    });
    assert.equal(status, 200);
    assert.equal(body.status, "approved");
    assert.equal(calls.createConsent.length, 1);
    assert.equal(calls.createConsent[0].signature, "Jane Doe");
  });

  it("returns 502 when HeyGen createConsent fails (DB status is not flipped)", async () => {
    const { service, calls } = makeConsentService({ fails: true });
    const app = buildConsentApp({ storage, service });
    const { status, body } = await callConsent(app, "grp_xyz", {
      action: "approve",
      consentVideoUrl: "https://videos/consent.mp4",
    });
    assert.equal(status, 502);
    assert.equal(body.error, "heygen_v3_consent_failed");
    assert.equal(calls.createConsent.length, 1);
    assert.equal(
      storage.updates.length,
      0,
      "must not flip the DB status when the upstream call failed",
    );
  });

  it("revoke path skips the HeyGen call and flips the DB status to 'revoked'", async () => {
    const { service, calls } = makeConsentService({});
    const app = buildConsentApp({ storage, service });
    const { status, body } = await callConsent(app, "grp_xyz", {
      action: "revoke",
    });
    assert.equal(status, 200);
    assert.equal(body.status, "revoked");
    assert.equal(
      calls.createConsent.length,
      0,
      "revoke must not hit HeyGen — there is no public revoke endpoint",
    );
    assert.equal(storage.updates.length, 1);
    assert.deepEqual(storage.updates[0], {
      id: "row_1",
      updates: { consentStatus: "revoked" },
    });
  });

  it("revoke path ignores an extra consentVideoUrl in the payload (still local-only)", async () => {
    const { service, calls } = makeConsentService({});
    const app = buildConsentApp({ storage, service });
    const { status, body } = await callConsent(app, "grp_xyz", {
      action: "revoke",
      consentVideoUrl: "https://videos/should-not-be-used.mp4",
    });
    assert.equal(status, 200);
    assert.equal(body.status, "revoked");
    assert.equal(calls.createConsent.length, 0);
    assert.equal(storage.updates[0].updates.consentStatus, "revoked");
  });
});

describe("POST /api/v3/voices/use", () => {
  let storage: FakeVoiceStorage;
  beforeEach(() => {
    storage = new FakeVoiceStorage();
  });

  it("persists a HeyGen catalogue voice into the user's library and returns 201", async () => {
    const app = buildUseVoiceApp({ storage });
    const { status, body } = await callUseVoice(app, {
      heygenVoiceId: "voice_catalogue_123",
      name: "  Friendly Narrator  ",
      language: "English",
      gender: "Female",
      sampleAudioUrl: "https://heygen/preview.mp3",
    });

    assert.equal(status, 201);
    assert.equal(body.heygenVoiceId, "voice_catalogue_123");
    assert.equal(body.name, "Friendly Narrator", "name is trimmed");
    assert.equal(body.status, "ready");
    assert.equal(body.audioUrl, "https://heygen/preview.mp3");
    assert.equal(body.sampleAudioUrl, "https://heygen/preview.mp3");
    assert.equal(body.heygenAudioAssetId, null);
    assert.equal(body.fileSize, null);

    assert.equal(storage.created.length, 1);
    const row = storage.created[0];
    assert.equal(row.userId, "user-1");
    assert.equal(row.heygenVoiceId, "voice_catalogue_123");
    assert.equal(row.name, "Friendly Narrator");
    assert.equal(row.language, "English");
    assert.equal(row.gender, "Female");
  });

  it("falls back to the heygenVoiceId when no name is supplied", async () => {
    const app = buildUseVoiceApp({ storage });
    const { status, body } = await callUseVoice(app, {
      heygenVoiceId: "voice_xyz",
    });
    assert.equal(status, 201);
    assert.equal(body.name, "voice_xyz");
    assert.equal(storage.created[0].name, "voice_xyz");
  });

  it("returns 400 when heygenVoiceId is missing or blank", async () => {
    const app = buildUseVoiceApp({ storage });
    const r1 = await callUseVoice(app, { name: "Whatever" });
    assert.equal(r1.status, 400);
    assert.match(String(r1.body.error), /heygenVoiceId is required/);
    const r2 = await callUseVoice(app, { heygenVoiceId: "   " });
    assert.equal(r2.status, 400);
    assert.equal(storage.created.length, 0);
  });

  it("returns 401 when there is no authenticated user", async () => {
    const app = buildUseVoiceApp({ storage, userId: null });
    const { status, body } = await callUseVoice(app, {
      heygenVoiceId: "voice_xyz",
    });
    assert.equal(status, 401);
    assert.equal(body.error, "unauthorized");
    assert.equal(storage.created.length, 0);
  });

  it("returns 500 with voice_save_failed when the storage layer throws", async () => {
    storage.failNext = true;
    const app = buildUseVoiceApp({ storage });
    const { status, body } = await callUseVoice(app, {
      heygenVoiceId: "voice_xyz",
      name: "Casey",
    });
    assert.equal(status, 500);
    assert.equal(body.error, "voice_save_failed");
    assert.match(String(body.message), /db unreachable/);
  });
});
