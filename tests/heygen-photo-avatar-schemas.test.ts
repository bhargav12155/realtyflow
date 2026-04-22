import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseHeygenAvatarGroupListResponse,
  parseHeygenAvatarGroupLooksResponse,
  parseHeygenTrainStatusResponse,
  parseHeygenV3LooksPageResponse,
  parseHeygenConsentResponse,
  parseHeygenV3VoicesPageResponse,
  parseHeygenV3DesignVoiceResponse,
  parseHeygenWebhookEvent,
  parseHeygenVideoStatusResponse,
  parseHeygenVideoGenerateResponse,
  HeygenResponseValidationError,
  avatarTrainStatusSchema,
  consentStatusSchema,
  avatarLookProcessingStatusSchema,
  setHeygenValidationReporter,
  type HeygenValidationFailureReport,
} from "../shared/heygenPhotoAvatarSchemas";

describe("HeyGen response Zod schemas", () => {
  describe("union enums (single source of truth)", () => {
    it("avatarTrainStatusSchema accepts the documented values", () => {
      for (const v of ["empty", "processing", "ready", "completed", "failed"]) {
        assert.equal(avatarTrainStatusSchema.parse(v), v);
      }
    });

    it("avatarTrainStatusSchema rejects unknown HeyGen statuses", () => {
      assert.throws(() => avatarTrainStatusSchema.parse("training"));
      assert.throws(() => avatarTrainStatusSchema.parse("queued"));
    });

    it("consentStatusSchema accepts pending/approved/revoked only", () => {
      for (const v of ["pending", "approved", "revoked"]) {
        assert.equal(consentStatusSchema.parse(v), v);
      }
      assert.throws(() => consentStatusSchema.parse("granted"));
    });

    it("avatarLookProcessingStatusSchema accepts the documented values", () => {
      for (const v of ["pending", "processing", "completed", "failed"]) {
        assert.equal(avatarLookProcessingStatusSchema.parse(v), v);
      }
      assert.throws(() => avatarLookProcessingStatusSchema.parse("done"));
    });
  });

  describe("parseHeygenAvatarGroupListResponse", () => {
    it("parses a minimal valid response and preserves passthrough fields", () => {
      const parsed = parseHeygenAvatarGroupListResponse({
        avatar_group_list: [
          {
            id: "grp_1",
            name: "Mike",
            train_status: "ready",
            preview_image: "https://x/y.jpg",
            extra_field: 42,
          },
        ],
      });
      assert.equal(parsed.avatar_group_list.length, 1);
      assert.equal(parsed.avatar_group_list[0].id, "grp_1");
      // passthrough must keep unknown fields so callers don't lose data
      assert.equal(
        (parsed.avatar_group_list[0] as Record<string, unknown>).extra_field,
        42,
      );
    });

    it("throws HeygenResponseValidationError when avatar_group_list is missing", () => {
      assert.throws(
        () => parseHeygenAvatarGroupListResponse({}),
        HeygenResponseValidationError,
      );
    });

    it("throws when train_status is an unknown string (shape drift)", () => {
      try {
        parseHeygenAvatarGroupListResponse({
          avatar_group_list: [
            { id: "grp_1", name: "Mike", train_status: "totally-new-status" },
          ],
        });
        assert.fail("expected validation to throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.message, /train_status/);
        assert.match(err.endpoint, /avatar_group\.list/);
      }
    });
  });

  describe("parseHeygenAvatarGroupLooksResponse", () => {
    it("parses a typical response with mixed status values", () => {
      const parsed = parseHeygenAvatarGroupLooksResponse(
        {
          avatar_list: [
            {
              id: "av_1",
              name: "Look 1",
              business_type: "executive",
              status: "completed",
              image_url: "https://x/1.jpg",
            },
            { id: "av_2", status: "pending", image_url: null },
          ],
        },
        "grp_1",
      );
      assert.equal(parsed.avatar_list.length, 2);
      assert.equal(parsed.avatar_list[0].status, "completed");
    });

    it("rejects unknown look status (shape drift)", () => {
      try {
        parseHeygenAvatarGroupLooksResponse(
          { avatar_list: [{ id: "av_1", status: "queued" }] },
          "grp_1",
        );
        assert.fail("expected validation to throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /grp_1\/avatars/);
      }
    });

    it("rejects an avatar entry without an id", () => {
      assert.throws(
        () =>
          parseHeygenAvatarGroupLooksResponse(
            { avatar_list: [{ name: "no-id" }] },
            "grp_1",
          ),
        HeygenResponseValidationError,
      );
    });

    it("rejects when avatar_list is not an array", () => {
      assert.throws(
        () =>
          parseHeygenAvatarGroupLooksResponse(
            { avatar_list: "nope" },
            "grp_1",
          ),
        HeygenResponseValidationError,
      );
    });
  });

  describe("parseHeygenTrainStatusResponse", () => {
    it("accepts the documented status values", () => {
      const parsed = parseHeygenTrainStatusResponse(
        { status: "processing", progress: 42 },
        "grp_1",
      );
      assert.equal(parsed.status, "processing");
    });

    it("throws on an unknown status value", () => {
      try {
        parseHeygenTrainStatusResponse({ status: "in_progress" }, "grp_1");
        assert.fail("expected validation to throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /train\/status\/grp_1/);
      }
    });

    it("throws when status is missing", () => {
      assert.throws(
        () => parseHeygenTrainStatusResponse({}, "grp_1"),
        HeygenResponseValidationError,
      );
    });
  });

  describe("parseHeygenV3LooksPageResponse", () => {
    it("parses an empty page", () => {
      const parsed = parseHeygenV3LooksPageResponse(
        { items: [], next_cursor: null },
        "grp_1",
      );
      assert.deepEqual(parsed.items, []);
      assert.equal(parsed.next_cursor, null);
    });

    it("parses a page with cursor and look entries", () => {
      const parsed = parseHeygenV3LooksPageResponse(
        {
          items: [
            { id: "look_1", name: "Look 1", image_url: "https://x/1.jpg" },
            { look_id: "look_2", preview_image_url: "https://x/2.jpg" },
          ],
          next_cursor: "abc",
        },
        "grp_1",
      );
      assert.equal(parsed.items?.length, 2);
      assert.equal(parsed.next_cursor, "abc");
    });

    it("rejects when items is not an array", () => {
      assert.throws(
        () =>
          parseHeygenV3LooksPageResponse(
            { items: "nope", next_cursor: null },
            "grp_1",
          ),
        HeygenResponseValidationError,
      );
    });

    it("rejects a look entry where image_url is the wrong type", () => {
      try {
        parseHeygenV3LooksPageResponse(
          { items: [{ id: "look_1", image_url: 42 }] },
          "grp_1",
        );
        assert.fail("expected validation to throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /grp_1\/looks/);
      }
    });
  });

  describe("parseHeygenConsentResponse", () => {
    it("parses the documented happy-path response", () => {
      const parsed = parseHeygenConsentResponse({
        consent_id: "c_123",
        status: "approved",
      });
      assert.equal(parsed.consent_id, "c_123");
      assert.equal(parsed.status, "approved");
    });

    it("rejects an unknown status value (shape drift)", () => {
      try {
        parseHeygenConsentResponse({ consent_id: "c_1", status: "granted" });
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /\/v3\/consent/);
        assert.match(err.message, /status/);
      }
    });

    it("rejects when consent_id is missing", () => {
      assert.throws(
        () => parseHeygenConsentResponse({ status: "approved" }),
        HeygenResponseValidationError,
      );
    });
  });

  describe("parseHeygenV3VoicesPageResponse", () => {
    it("parses an empty page", () => {
      const parsed = parseHeygenV3VoicesPageResponse({
        items: [],
        next_cursor: null,
      });
      assert.deepEqual(parsed.items, []);
      assert.equal(parsed.next_cursor, null);
    });

    it("parses voice entries with mixed optional fields", () => {
      const parsed = parseHeygenV3VoicesPageResponse({
        items: [
          {
            voice_id: "v_1",
            name: "Friendly",
            language: "English",
            gender: "Female",
            preview_url: "https://x/p1.mp3",
          },
          { id: "v_2", name: "Bare" },
        ],
        next_cursor: "cur",
      });
      assert.equal(parsed.items?.length, 2);
      assert.equal(parsed.next_cursor, "cur");
    });

    it("rejects when items is not an array (shape drift)", () => {
      try {
        parseHeygenV3VoicesPageResponse({ items: "nope" });
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /\/v3\/voices/);
      }
    });

    it("rejects when a voice's preview_url is the wrong type", () => {
      assert.throws(
        () =>
          parseHeygenV3VoicesPageResponse({
            items: [{ voice_id: "v_1", preview_url: 42 }],
          }),
        HeygenResponseValidationError,
      );
    });
  });

  describe("parseHeygenV3DesignVoiceResponse", () => {
    it("parses a voice id + preview url", () => {
      const parsed = parseHeygenV3DesignVoiceResponse({
        voice_id: "v_designed",
        preview_url: "https://x/preview.mp3",
      });
      assert.equal(parsed.voice_id, "v_designed");
      assert.equal(parsed.preview_url, "https://x/preview.mp3");
    });

    it("accepts the response without an optional preview_url", () => {
      const parsed = parseHeygenV3DesignVoiceResponse({ voice_id: "v_designed" });
      assert.equal(parsed.voice_id, "v_designed");
      assert.equal(parsed.preview_url, undefined);
    });

    it("throws when voice_id is missing (shape drift)", () => {
      try {
        parseHeygenV3DesignVoiceResponse({ preview_url: "https://x.mp3" });
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /\/v3\/voices\/design/);
      }
    });
  });

  describe("parseHeygenWebhookEvent", () => {
    it("parses a typical training-status webhook envelope", () => {
      const parsed = parseHeygenWebhookEvent({
        event_type: "avatar_group.training.completed",
        data: {
          group_id: "grp_xyz",
          status: "ready",
          extra: 1,
        },
      });
      assert.equal(parsed.event_type, "avatar_group.training.completed");
      assert.equal(parsed.data?.group_id, "grp_xyz");
      assert.equal(parsed.data?.status, "ready");
    });

    it("accepts a payload with no `data` field at all", () => {
      const parsed = parseHeygenWebhookEvent({ event_type: "ping" });
      assert.equal(parsed.event_type, "ping");
      assert.equal(parsed.data, undefined);
    });

    it("rejects when data.group_id is the wrong type (shape drift)", () => {
      try {
        parseHeygenWebhookEvent({
          event_type: "x",
          data: { group_id: 42 },
        });
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /webhook/);
      }
    });
  });

  describe("parseHeygenVideoStatusResponse", () => {
    it("parses the documented v1 envelope happy path", () => {
      const parsed = parseHeygenVideoStatusResponse(
        {
          code: 100,
          message: "Success",
          data: {
            video_id: "vid_1",
            status: "completed",
            video_url: "https://cdn/v.mp4",
            thumbnail_url: "https://cdn/t.jpg",
          },
        },
        "vid_1",
      );
      assert.equal(parsed.data?.video_id, "vid_1");
      assert.equal(parsed.data?.status, "completed");
    });

    it("accepts a structured `error` field as an object", () => {
      const parsed = parseHeygenVideoStatusResponse(
        {
          data: {
            video_id: "vid_2",
            status: "failed",
            error: { code: 400, detail: "bad" },
          },
        },
        "vid_2",
      );
      assert.equal(parsed.data?.status, "failed");
      assert.deepEqual(parsed.data?.error, { code: 400, detail: "bad" });
    });

    it("rejects when the `data` envelope is missing entirely (shape drift)", () => {
      try {
        parseHeygenVideoStatusResponse(
          { code: 100, message: "Success" },
          "vid_4",
        );
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /video_status\.get/);
      }
    });

    it("rejects when data.video_url is the wrong type (shape drift)", () => {
      try {
        parseHeygenVideoStatusResponse(
          { data: { video_id: "vid_3", video_url: 42 } },
          "vid_3",
        );
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /video_status\.get/);
      }
    });
  });

  describe("parseHeygenVideoGenerateResponse", () => {
    it("parses the documented happy-path envelope", () => {
      const parsed = parseHeygenVideoGenerateResponse({
        code: 100,
        message: "Success",
        data: { video_id: "vid_new", status: "pending" },
      });
      assert.equal(parsed.data?.video_id, "vid_new");
      assert.equal(parsed.data?.status, "pending");
    });

    it("rejects when data.video_id is missing (shape drift)", () => {
      try {
        parseHeygenVideoGenerateResponse({
          code: 100,
          data: { status: "pending" },
        });
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /\/v2\/video\/generate/);
      }
    });

    it("rejects when the `data` envelope is missing entirely (shape drift)", () => {
      try {
        parseHeygenVideoGenerateResponse({ code: 100, message: "ok" });
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.endpoint, /\/v2\/video\/generate/);
      }
    });
  });

  describe("HeygenResponseValidationError", () => {
    it("includes the endpoint and a compact issue summary in message", () => {
      try {
        parseHeygenAvatarGroupListResponse({ avatar_group_list: "nope" });
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.match(err.message, /avatar_group\.list/);
        assert.match(err.message, /avatar_group_list/);
        assert.ok(err.issues.length > 0);
      }
    });

    it("captures groupId on the error when the helper knows it", () => {
      try {
        parseHeygenTrainStatusResponse({ status: "in_progress" }, "grp_42");
        assert.fail("expected throw");
      } catch (err) {
        assert.ok(err instanceof HeygenResponseValidationError);
        assert.equal(err.groupId, "grp_42");
      }
    });
  });

  describe("validation failure reporter", () => {
    it("invokes the registered reporter with endpoint, groupId, and issue paths", () => {
      const calls: HeygenValidationFailureReport[] = [];
      setHeygenValidationReporter((r) => calls.push(r));
      try {
        try {
          parseHeygenAvatarGroupLooksResponse(
            { avatar_list: [{ id: "av_1", status: "queued" }] },
            "grp_99",
          );
        } catch {
          // expected
        }
        assert.equal(calls.length, 1);
        assert.match(calls[0].endpoint, /grp_99\/avatars/);
        assert.equal(calls[0].groupId, "grp_99");
        assert.ok(calls[0].issuePaths.length > 0);
        assert.match(calls[0].message, /grp_99/);
      } finally {
        setHeygenValidationReporter(null);
      }
    });

    it("swallows reporter errors so they don't break the request flow", () => {
      setHeygenValidationReporter(() => {
        throw new Error("reporter blew up");
      });
      try {
        // The original validation error must still surface to the caller.
        assert.throws(
          () => parseHeygenTrainStatusResponse({}, "grp_1"),
          HeygenResponseValidationError,
        );
      } finally {
        setHeygenValidationReporter(null);
      }
    });

    it("does not invoke the reporter on a successful parse", () => {
      let called = 0;
      setHeygenValidationReporter(() => {
        called += 1;
      });
      try {
        parseHeygenTrainStatusResponse({ status: "ready" }, "grp_1");
        assert.equal(called, 0);
      } finally {
        setHeygenValidationReporter(null);
      }
    });
  });
});
