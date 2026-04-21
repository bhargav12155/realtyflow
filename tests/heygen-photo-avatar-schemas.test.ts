import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseHeygenAvatarGroupListResponse,
  parseHeygenAvatarGroupLooksResponse,
  parseHeygenTrainStatusResponse,
  parseHeygenV3LooksPageResponse,
  HeygenResponseValidationError,
  avatarTrainStatusSchema,
  consentStatusSchema,
  avatarLookProcessingStatusSchema,
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
  });
});
