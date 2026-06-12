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
  readonly groupId?: string;

  constructor(
    endpoint: string,
    issues: z.ZodIssue[],
    payload: unknown,
    groupId?: string,
  ) {
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
    this.groupId = groupId;
  }
}

/**
 * Distinct error code emitted by every server route that catches a
 * `HeygenResponseValidationError` so the dashboard can surface a specific,
 * copy-pastable "HeyGen returned an unexpected response shape" notice
 * instead of lumping the failure into a generic 502. Kept in shared/ so
 * the UI and the route handlers reference the same constant.
 */
export const HEYGEN_SHAPE_DRIFT_ERROR_CODE = "heygen_shape_drift";

export interface HeygenShapeDriftErrorPayload {
  error: typeof HEYGEN_SHAPE_DRIFT_ERROR_CODE;
  endpoint: string;
  message: string;
  /** First few `path.join('.')` strings, capped for transport size. */
  issuePaths: string[];
}

/**
 * Build the JSON body a route returns when it catches a
 * `HeygenResponseValidationError`. The included `endpoint` + `issuePaths`
 * give operators something concrete to forward to support without leaking
 * the full upstream payload.
 */
export function heygenShapeDriftErrorPayload(
  err: HeygenResponseValidationError,
): HeygenShapeDriftErrorPayload {
  const issuePaths = err.issues
    .slice(0, 5)
    .map((i) => i.path.join(".") || "(root)");
  return {
    error: HEYGEN_SHAPE_DRIFT_ERROR_CODE,
    endpoint: err.endpoint,
    message: `HeyGen returned an unexpected response shape for ${err.endpoint}. Please retry. If this keeps happening, copy this whole message to support: ${err.message}`,
    issuePaths,
  };
}

// ---------------------------------------------------------------------------
// Validation failure reporter
//
// HeyGen response shapes drift over time. To shorten the time-to-detect for
// operators we expose a pluggable reporter that receives every validation
// failure (endpoint, groupId, the first few Zod issue paths). The server
// registers a reporter at startup that emits a structured `event:
// "heygen.response.invalid"` log line and broadcasts an admin notification
// over the realtime websocket channel. Tests and the client bundle simply
// see a no-op default.
// ---------------------------------------------------------------------------

export interface HeygenValidationFailureReport {
  endpoint: string;
  groupId?: string;
  issues: z.ZodIssue[];
  /** First few `path.join('.')` strings, capped for log/transport size. */
  issuePaths: string[];
  /** Message from `HeygenResponseValidationError` (already truncated). */
  message: string;
}

export type HeygenValidationReporter = (
  report: HeygenValidationFailureReport,
) => void;

let validationReporter: HeygenValidationReporter | null = null;

export function setHeygenValidationReporter(
  reporter: HeygenValidationReporter | null,
): void {
  validationReporter = reporter;
}

function reportValidationFailure(error: HeygenResponseValidationError): void {
  if (!validationReporter) return;
  const issuePaths = error.issues
    .slice(0, 5)
    .map((i) => i.path.join(".") || "(root)");
  try {
    validationReporter({
      endpoint: error.endpoint,
      groupId: error.groupId,
      issues: error.issues,
      issuePaths,
      message: error.message,
    });
  } catch {
    // Never let a misbehaving reporter break the request flow.
  }
}

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  endpoint: string,
  payload: unknown,
  groupId?: string,
): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const error = new HeygenResponseValidationError(
      endpoint,
      result.error.issues,
      payload,
      groupId,
    );
    reportValidationFailure(error);
    throw error;
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
    groupId,
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
    groupId,
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
    groupId,
  );
}

// ---------------------------------------------------------------------------
// HeyGen v3 — `/v3/consent` response
// ---------------------------------------------------------------------------

export const heygenConsentResponseSchema = z
  .object({
    consent_id: z.string(),
    status: consentStatusSchema,
  })
  .passthrough();

export type HeygenConsentResponse = z.infer<typeof heygenConsentResponseSchema>;

export function parseHeygenConsentResponse(
  payload: unknown,
): HeygenConsentResponse {
  return parseOrThrow(heygenConsentResponseSchema, "/v3/consent", payload);
}

// ---------------------------------------------------------------------------
// HeyGen v3 — `/v3/voices` (voice list) response
// ---------------------------------------------------------------------------

export const heygenV3VoiceSchema = z
  .object({
    voice_id: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    language: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    preview_url: z.string().nullable().optional(),
    preview_audio_url: z.string().nullable().optional(),
  })
  .passthrough();

export const heygenV3VoicesPageResponseSchema = z
  .object({
    items: z.array(heygenV3VoiceSchema).optional(),
    next_cursor: z.string().nullable().optional(),
  })
  .passthrough();

export type HeygenV3Voice = z.infer<typeof heygenV3VoiceSchema>;
export type HeygenV3VoicesPageResponse = z.infer<
  typeof heygenV3VoicesPageResponseSchema
>;

export function parseHeygenV3VoicesPageResponse(
  payload: unknown,
): HeygenV3VoicesPageResponse {
  return parseOrThrow(heygenV3VoicesPageResponseSchema, "/v3/voices", payload);
}

// ---------------------------------------------------------------------------
// HeyGen v3 — `/v3/voices/design` response
// ---------------------------------------------------------------------------

export const heygenV3DesignVoiceResponseSchema = z
  .object({
    voice_id: z.string(),
    preview_url: z.string().optional(),
  })
  .passthrough();

export type HeygenV3DesignVoiceResponse = z.infer<
  typeof heygenV3DesignVoiceResponseSchema
>;

export function parseHeygenV3DesignVoiceResponse(
  payload: unknown,
): HeygenV3DesignVoiceResponse {
  return parseOrThrow(
    heygenV3DesignVoiceResponseSchema,
    "/v3/voices/design",
    payload,
  );
}

// ---------------------------------------------------------------------------
// HeyGen — webhook event payload
//
// HeyGen webhooks deliver a JSON envelope with at least an `event_type` and
// a `data` object. The set of fields inside `data` varies by event (avatar
// training, video generation, etc.), so we keep the inner schema permissive
// (passthrough) but require the few fields the webhook handler actually
// reads to be of the right type when present.
// ---------------------------------------------------------------------------

export const heygenWebhookEventDataSchema = z
  .object({
    group_id: z.string().optional(),
    avatar_id: z.string().optional(),
    video_id: z.string().optional(),
    look_id: z.string().optional(),
    id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const heygenWebhookEventSchema = z
  .object({
    event_type: z.string().optional(),
    type: z.string().optional(),
    data: heygenWebhookEventDataSchema.optional(),
  })
  .passthrough();

export type HeygenWebhookEventData = z.infer<typeof heygenWebhookEventDataSchema>;
export type HeygenWebhookEvent = z.infer<typeof heygenWebhookEventSchema>;

export function parseHeygenWebhookEvent(payload: unknown): HeygenWebhookEvent {
  return parseOrThrow(heygenWebhookEventSchema, "webhook:/api/webhooks/heygen", payload);
}

// ---------------------------------------------------------------------------
// HeyGen v1 — `/v1/video_status.get` response
//
// The v1 status endpoint wraps its payload in a HeyGen envelope:
//   { code, message, data: { video_id, status, video_url?, thumbnail_url?, error? } }
// We validate the inner `data` object since that's what callers consume.
// ---------------------------------------------------------------------------

// HeyGen returns a wide set of status strings for video generation
// (pending/processing/waiting/completed/failed plus aliases like
// success/complete/draft). Rather than risk enum-mismatch breakage on a
// new alias we accept any string here — the boundary check we care about
// is that `status` is a string, not whatever shape HeyGen sends.
export const heygenVideoStatusDataSchema = z
  .object({
    video_id: z.string().optional(),
    status: z.string().optional(),
    video_url: z.string().nullable().optional(),
    thumbnail_url: z.string().nullable().optional(),
    error: z
      .union([z.string(), z.record(z.unknown())])
      .nullable()
      .optional(),
  })
  .passthrough();

export const heygenVideoStatusEnvelopeSchema = z
  .object({
    code: z.number().optional(),
    message: z.string().optional(),
    // Required: HeyGen always wraps status payloads in `data`. If it's
    // missing the response is malformed and downstream code that reads
    // `data.status` would silently treat the video as still pending.
    data: heygenVideoStatusDataSchema,
  })
  .passthrough();

export type HeygenVideoStatusData = z.infer<typeof heygenVideoStatusDataSchema>;
export type HeygenVideoStatusEnvelope = z.infer<
  typeof heygenVideoStatusEnvelopeSchema
>;

export function parseHeygenVideoStatusResponse(
  payload: unknown,
  videoId?: string,
): HeygenVideoStatusEnvelope {
  return parseOrThrow(
    heygenVideoStatusEnvelopeSchema,
    `/v1/video_status.get?video_id=${videoId ?? ":videoId"}`,
    payload,
  );
}

// ---------------------------------------------------------------------------
// HeyGen v2 — `/v2/video/generate` (submit) response
// ---------------------------------------------------------------------------

export const heygenVideoGenerateDataSchema = z
  .object({
    video_id: z.string(),
    status: z.string().optional(),
  })
  .passthrough();

export const heygenVideoGenerateResponseSchema = z
  .object({
    code: z.number().optional(),
    message: z.string().optional(),
    // Required: a successful submit must come back with a video_id we
    // can poll. Missing `data` would mean the caller silently has
    // nothing to track, so treat that as boundary failure.
    data: heygenVideoGenerateDataSchema,
  })
  .passthrough();

export type HeygenVideoGenerateResponse = z.infer<
  typeof heygenVideoGenerateResponseSchema
>;

export function parseHeygenVideoGenerateResponse(
  payload: unknown,
): HeygenVideoGenerateResponse {
  return parseOrThrow(
    heygenVideoGenerateResponseSchema,
    "/v2/video/generate",
    payload,
  );
}
