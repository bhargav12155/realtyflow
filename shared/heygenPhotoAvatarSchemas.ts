/**
 * Shared Zod schemas + types for HeyGen photo-avatar API responses.
 *
 * The client-side types in
 * `client/src/components/dashboard/photo-avatars/types.ts` re-export the
 * union types from this file so the front-end and back-end agree on the
 * legal values for `train_status`, `consent_status`, and the per-look
 * `processingStatus`.
 *
 * Server endpoints that forward HeyGen's JSON to the UI should pipe the
 * response through these schemas first (see `parseHeygen*` helpers below)
 * so a HeyGen shape drift is caught at the boundary instead of producing
 * a silently-broken UI.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared union values (single source of truth shared with the client types)
// ---------------------------------------------------------------------------

export const avatarGroupStatusSchema = z.enum([
  "pending",
  "processing",
  "ready",
  "failed",
  "completed",
]);
export type AvatarGroupStatus = z.infer<typeof avatarGroupStatusSchema>;

export const avatarTrainStatusSchema = z.enum([
  "empty",
  "processing",
  "ready",
  "completed",
  "failed",
]);
export type AvatarTrainStatus = z.infer<typeof avatarTrainStatusSchema>;

export const consentStatusSchema = z.enum(["pending", "approved", "revoked"]);
export type ConsentStatus = z.infer<typeof consentStatusSchema>;

export const avatarLookProcessingStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);
export type AvatarLookProcessingStatus = z.infer<
  typeof avatarLookProcessingStatusSchema
>;

// ---------------------------------------------------------------------------
// HeyGen v2 — `/v2/avatar_group.list` response
// ---------------------------------------------------------------------------

export const heygenAvatarGroupItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    group_type: z.string().optional(),
    train_status: avatarTrainStatusSchema.optional(),
    preview_image: z.string().nullable().optional(),
    created_at: z.union([z.string(), z.number()]).optional(),
    default_voice_id: z.string().nullable().optional(),
  })
  .passthrough();

export const heygenAvatarGroupListResponseSchema = z
  .object({
    avatar_group_list: z.array(heygenAvatarGroupItemSchema),
  })
  .passthrough();

export type HeygenAvatarGroupItem = z.infer<typeof heygenAvatarGroupItemSchema>;
export type HeygenAvatarGroupListResponse = z.infer<
  typeof heygenAvatarGroupListResponseSchema
>;

// ---------------------------------------------------------------------------
// HeyGen v2 — `/v2/avatar_group/{id}/avatars` (group photos / looks) response
// ---------------------------------------------------------------------------

export const heygenAvatarLookSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    business_type: z.string().nullable().optional(),
    status: avatarLookProcessingStatusSchema.optional(),
    image_url: z.string().nullable().optional(),
  })
  .passthrough();

export const heygenAvatarGroupLooksResponseSchema = z
  .object({
    avatar_list: z.array(heygenAvatarLookSchema),
  })
  .passthrough();

export type HeygenAvatarLook = z.infer<typeof heygenAvatarLookSchema>;
export type HeygenAvatarGroupLooksResponse = z.infer<
  typeof heygenAvatarGroupLooksResponseSchema
>;

// ---------------------------------------------------------------------------
// HeyGen v2 — `/v2/photo_avatar/train/status/{groupId}` response
// ---------------------------------------------------------------------------

export const heygenTrainStatusResponseSchema = z
  .object({
    status: avatarTrainStatusSchema,
  })
  .passthrough();

export type HeygenTrainStatusResponse = z.infer<
  typeof heygenTrainStatusResponseSchema
>;

// ---------------------------------------------------------------------------
// HeyGen v3 — `/v3/photo_avatars/{id}/looks` response
// ---------------------------------------------------------------------------

export const heygenV3LookSchema = z
  .object({
    id: z.string().optional(),
    look_id: z.string().optional(),
    name: z.string().optional(),
    business_type: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    preview_image_url: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    photo_url: z.string().nullable().optional(),
  })
  .passthrough();

export const heygenV3LooksPageResponseSchema = z
  .object({
    items: z.array(heygenV3LookSchema).optional(),
    next_cursor: z.string().nullable().optional(),
  })
  .passthrough();

export type HeygenV3Look = z.infer<typeof heygenV3LookSchema>;
export type HeygenV3LooksPageResponse = z.infer<
  typeof heygenV3LooksPageResponseSchema
>;

// ---------------------------------------------------------------------------
// Parse helpers
//
// Each helper validates `payload` against the matching schema and throws a
// `HeygenResponseValidationError` (with the endpoint name and a compact list
// of validation issues) when the shape doesn't match. Callers should let the
// error bubble up so the route can return a 502 instead of forwarding garbage
// to the UI.
// ---------------------------------------------------------------------------

export class HeygenResponseValidationError extends Error {
  readonly endpoint: string;
  readonly issues: z.ZodIssue[];
  readonly payload: unknown;

  constructor(endpoint: string, issues: z.ZodIssue[], payload: unknown) {
    const summary = issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    super(
      `HeyGen response for ${endpoint} did not match expected schema: ${summary}`,
    );
    this.name = "HeygenResponseValidationError";
    this.endpoint = endpoint;
    this.issues = issues;
    this.payload = payload;
  }
}

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  endpoint: string,
  payload: unknown,
): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new HeygenResponseValidationError(
      endpoint,
      result.error.issues,
      payload,
    );
  }
  return result.data;
}

export function parseHeygenAvatarGroupListResponse(
  payload: unknown,
): HeygenAvatarGroupListResponse {
  return parseOrThrow(
    heygenAvatarGroupListResponseSchema,
    "/v2/avatar_group.list",
    payload,
  );
}

export function parseHeygenAvatarGroupLooksResponse(
  payload: unknown,
  groupId?: string,
): HeygenAvatarGroupLooksResponse {
  return parseOrThrow(
    heygenAvatarGroupLooksResponseSchema,
    `/v2/avatar_group/${groupId ?? ":groupId"}/avatars`,
    payload,
  );
}

export function parseHeygenTrainStatusResponse(
  payload: unknown,
  groupId?: string,
): HeygenTrainStatusResponse {
  return parseOrThrow(
    heygenTrainStatusResponseSchema,
    `/v2/photo_avatar/train/status/${groupId ?? ":groupId"}`,
    payload,
  );
}

export function parseHeygenV3LooksPageResponse(
  payload: unknown,
  groupId?: string,
): HeygenV3LooksPageResponse {
  return parseOrThrow(
    heygenV3LooksPageResponseSchema,
    `/v3/photo_avatars/${groupId ?? ":groupId"}/looks`,
    payload,
  );
}
