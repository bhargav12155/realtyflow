/**
 * Wires the shared HeyGen response-validation pipeline into the server's
 * structured logger and realtime admin alert channel.
 *
 * `shared/heygenPhotoAvatarSchemas.ts` exposes a pluggable reporter so it
 * can stay free of server dependencies. Here we register a reporter that:
 *   1. Emits a single structured log line tagged
 *      `event: "heygen.response.invalid"` containing the endpoint, the
 *      groupId (when known), and the first few Zod issue paths. Log
 *      aggregators can build alerts on either the per-event line or the
 *      higher-severity burst line described below.
 *   2. Broadcasts an admin-only realtime alert (deduped per
 *      endpoint+groupId) so the dashboard's notification bell pages
 *      operators about a HeyGen shape drift instead of waiting for a user
 *      to file a bug report.
 *   3. Tracks a sliding-window failure counter per endpoint and, when the
 *      rate crosses a small threshold inside a short window, emits a
 *      separate `event: "heygen.response.invalid.burst"` log line plus a
 *      critical-severity admin alert, AND POSTs that burst payload to the
 *      Slack incoming webhook configured via
 *      `HEYGEN_BURST_SLACK_WEBHOOK_URL` so the team's on-call channel is
 *      paged directly (no log-based alerting rule required). See
 *      `docs/heygen-shape-drift-runbook.md` for the response procedure.
 *
 * The burst thresholds are configurable per deploy via env vars (see
 * `resolveTunables` below) so operators can tighten or relax the alarm
 * without a code change.
 */

import {
  setHeygenValidationReporter,
  type HeygenValidationFailureReport,
} from "@shared/heygenPhotoAvatarSchemas";
import { realtimeService } from "../websocket";

// ---------------------------------------------------------------------------
// Tunable thresholds
//
// Defaults are intentionally conservative so a brief HeyGen hiccup does
// not page anyone. Each value can be overridden per deploy via an env
// var; invalid / non-positive values fall back to the default and a
// single warn line is logged at registration time so the misconfig is
// visible.
// ---------------------------------------------------------------------------
const DEFAULTS = {
  BROADCAST_DEDUP_MS: 5 * 60 * 1000, // dedupe per endpoint+groupId
  BURST_WINDOW_MS: 5 * 60 * 1000, // sliding window for rate alarm
  BURST_THRESHOLD: 3, // failures within window that trip the alarm
  BURST_DEDUP_MS: 15 * 60 * 1000, // suppress repeat burst alerts per endpoint
} as const;

const ENV_KEYS = {
  BROADCAST_DEDUP_MS: "HEYGEN_BROADCAST_DEDUP_MS",
  BURST_WINDOW_MS: "HEYGEN_BURST_WINDOW_MS",
  BURST_THRESHOLD: "HEYGEN_BURST_THRESHOLD",
  BURST_DEDUP_MS: "HEYGEN_BURST_DEDUP_MS",
} as const;

type TunableKey = keyof typeof DEFAULTS;

interface Tunables {
  BROADCAST_DEDUP_MS: number;
  BURST_WINDOW_MS: number;
  BURST_THRESHOLD: number;
  BURST_DEDUP_MS: number;
}

function readPositiveIntEnv(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    console.warn(
      `[heygen-validation-reporter] ${envKey}=${JSON.stringify(
        raw,
      )} is not a positive integer; falling back to default ${fallback}`,
    );
    return fallback;
  }
  return parsed;
}

function resolveTunables(): Tunables {
  const out = {} as Tunables;
  for (const key of Object.keys(DEFAULTS) as TunableKey[]) {
    out[key] = readPositiveIntEnv(ENV_KEYS[key], DEFAULTS[key]);
  }
  return out;
}

// Default runbook URL surfaced in the Slack message. Overridable via env so
// the link can point at the team's internal docs mirror without a code
// change.
const DEFAULT_RUNBOOK_URL =
  "https://github.com/replit/agent/blob/main/docs/heygen-shape-drift-runbook.md";

let registered = false;
let activeTunables: Tunables = { ...DEFAULTS };
let lastBroadcastByEndpoint: Map<string, number> = new Map();
let recentFailureTimestamps: Map<string, number[]> = new Map();
let lastBurstAlertByEndpoint: Map<string, number> = new Map();

/**
 * POST a Slack-formatted burst alert to the incoming webhook configured
 * in `HEYGEN_BURST_SLACK_WEBHOOK_URL`. No-op (with a single warn line) if
 * the env var is unset, so local dev / test environments don't need a
 * webhook configured. Failures are swallowed so a Slack outage cannot
 * break the request path that triggered the burst.
 */
async function postBurstToSlack(payload: {
  endpoint: string;
  count: number;
  windowMs: number;
  threshold: number;
  sampleIssuePaths: string[];
  sampleMessage: string;
}): Promise<void> {
  const webhookUrl = process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      "[heygen-validation-reporter] HEYGEN_BURST_SLACK_WEBHOOK_URL not set; skipping Slack burst notification",
    );
    return;
  }

  const runbookUrl = process.env.HEYGEN_RUNBOOK_URL ?? DEFAULT_RUNBOOK_URL;
  const windowMinutes = Math.round(payload.windowMs / 60000);
  const text =
    `:rotating_light: *HeyGen shape drift burst* — ${payload.count} invalid responses ` +
    `for \`${payload.endpoint}\` in the last ${windowMinutes}m ` +
    `(threshold ${payload.threshold}). Runbook: ${runbookUrl}`;

  const body = {
    text,
    attachments: [
      {
        color: "danger",
        fields: [
          { title: "Endpoint", value: payload.endpoint, short: true },
          {
            title: "Failures / Window",
            value: `${payload.count} in ${windowMinutes}m`,
            short: true,
          },
          {
            title: "Sample issue paths",
            value:
              payload.sampleIssuePaths.length > 0
                ? payload.sampleIssuePaths.join(", ")
                : "(none)",
            short: false,
          },
          {
            title: "Sample message",
            value: payload.sampleMessage,
            short: false,
          },
          { title: "Runbook", value: runbookUrl, short: false },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(
        `[heygen-validation-reporter] Slack webhook returned ${res.status}`,
      );
    }
  } catch (err) {
    console.warn(
      "[heygen-validation-reporter] failed to POST burst alert to Slack",
      err,
    );
  }
}

/**
 * Normalize an endpoint label so burst counting groups all failures for
 * the same HeyGen route together, regardless of the resource id baked
 * into the path. Without this, e.g. `/v3/photo_avatars/abc123/looks`
 * and `/v3/photo_avatars/def456/looks` would count separately and a
 * real route-wide drift could stay below the per-id threshold.
 *
 * Replaces:
 *   - URL path segments after `:` placeholders (left as-is — the
 *     parsers already insert `:groupId`/`:videoId` when the id is
 *     unknown).
 *   - Plain alphanumeric ids in known position patterns.
 *   - `?video_id=...` query values.
 */
export function normalizeEndpointForBurst(endpoint: string): string {
  return endpoint
    .replace(
      /\/v3\/photo_avatars\/[^/]+\/looks/,
      "/v3/photo_avatars/:groupId/looks",
    )
    .replace(
      /\/v2\/avatar_group\/[^/]+\/avatars/,
      "/v2/avatar_group/:groupId/avatars",
    )
    .replace(
      /\/v2\/photo_avatar\/train\/status\/[^?#]+/,
      "/v2/photo_avatar/train/status/:groupId",
    )
    .replace(/video_id=[^&#]+/, "video_id=:videoId");
}

function recordFailureForBurst(endpoint: string, now: number): number {
  const arr = recentFailureTimestamps.get(endpoint) ?? [];
  // Drop timestamps older than the window before counting.
  const cutoff = now - activeTunables.BURST_WINDOW_MS;
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i += 1;
  const trimmed = i > 0 ? arr.slice(i) : arr;
  trimmed.push(now);
  recentFailureTimestamps.set(endpoint, trimmed);
  return trimmed.length;
}

export function registerHeygenValidationReporter(): void {
  if (registered) return;
  registered = true;
  activeTunables = resolveTunables();

  setHeygenValidationReporter((report: HeygenValidationFailureReport) => {
    const logLine = {
      event: "heygen.response.invalid",
      endpoint: report.endpoint,
      groupId: report.groupId ?? null,
      issuePaths: report.issuePaths,
      issueCount: report.issues.length,
      message: report.message,
    };
    // One JSON line so log-aggregation tooling can index/search on it.
    console.warn(JSON.stringify(logLine));

    const now = Date.now();

    // De-dupe identical drift alerts so a polling loop can't spam the
    // dashboard while operators are already triaging the issue.
    const dedupeKey = `${report.endpoint}::${report.groupId ?? ""}`;
    const last = lastBroadcastByEndpoint.get(dedupeKey) ?? 0;
    if (now - last >= activeTunables.BROADCAST_DEDUP_MS) {
      lastBroadcastByEndpoint.set(dedupeKey, now);
      try {
        realtimeService.broadcastAdminAlert({
          source: "heygen",
          severity: "error",
          title: "HeyGen response failed schema validation",
          message: report.message,
          context: {
            endpoint: report.endpoint,
            groupId: report.groupId ?? null,
            issuePaths: report.issuePaths,
          },
        });
      } catch (err) {
        // The websocket layer may not be initialized yet (e.g. during very
        // early startup). Failing to broadcast must not break the request.
        console.warn(
          "[heygen-validation-reporter] failed to broadcast admin alert",
          err,
        );
      }
    }

    // Sliding-window burst detection. We track timestamps per endpoint
    // (not per groupId) so the alarm trips on "HeyGen broke this
    // endpoint", not "this one user keeps hitting the same broken
    // group". When the count crosses the threshold we emit a distinct
    // structured log line + a critical admin alert AND POST the burst
    // payload directly to Slack via `postBurstToSlack` below. The
    // direct webhook is what pages the on-call channel; log-based
    // alerting on `heygen.response.invalid.burst` is still available
    // as a backup signal for teams that prefer it.
    const burstEndpoint = normalizeEndpointForBurst(report.endpoint);
    const count = recordFailureForBurst(burstEndpoint, now);
    if (count >= activeTunables.BURST_THRESHOLD) {
      const lastBurst = lastBurstAlertByEndpoint.get(burstEndpoint) ?? 0;
      if (now - lastBurst >= activeTunables.BURST_DEDUP_MS) {
        lastBurstAlertByEndpoint.set(burstEndpoint, now);
        const burstLine = {
          event: "heygen.response.invalid.burst",
          endpoint: burstEndpoint,
          windowMs: activeTunables.BURST_WINDOW_MS,
          threshold: activeTunables.BURST_THRESHOLD,
          count,
          sampleIssuePaths: report.issuePaths,
          sampleMessage: report.message,
        };
        // `console.error` so the line is visible to error-only log
        // pipelines and treated as a higher-priority signal than the
        // per-event warn line above.
        console.error(JSON.stringify(burstLine));

        try {
          realtimeService.broadcastAdminAlert({
            source: "heygen",
            // The realtime channel only models info/warning/error; the
            // burst signal is communicated via the title + the
            // `burst: true` context flag the dashboard reads to
            // surface it more prominently.
            severity: "error",
            title: "HeyGen shape drift burst detected",
            message: `HeyGen returned ${count} invalid responses for ${burstEndpoint} in the last ${Math.round(
              activeTunables.BURST_WINDOW_MS / 60000,
            )} minutes. See docs/heygen-shape-drift-runbook.md.`,
            context: {
              endpoint: burstEndpoint,
              count,
              windowMs: activeTunables.BURST_WINDOW_MS,
              threshold: activeTunables.BURST_THRESHOLD,
              sampleIssuePaths: report.issuePaths,
            },
          });
        } catch (err) {
          console.warn(
            "[heygen-validation-reporter] failed to broadcast burst admin alert",
            err,
          );
        }

        // Page the on-call channel via Slack. Fire-and-forget — the
        // helper swallows its own errors so a Slack outage cannot break
        // the request that triggered the burst.
        void postBurstToSlack({
          endpoint: burstEndpoint,
          count,
          windowMs: activeTunables.BURST_WINDOW_MS,
          threshold: activeTunables.BURST_THRESHOLD,
          sampleIssuePaths: report.issuePaths,
          sampleMessage: report.message,
        });
      }
    }
  });
}

// Test-only: clear the dedup + sliding-window caches and the
// `registered` guard so each test run can re-register a fresh reporter.
export function __resetHeygenValidationReporterForTests(): void {
  registered = false;
  activeTunables = { ...DEFAULTS };
  lastBroadcastByEndpoint = new Map();
  recentFailureTimestamps = new Map();
  lastBurstAlertByEndpoint = new Map();
  setHeygenValidationReporter(null);
}

// Test-only: expose the resolved (env-aware) tunables so tests can assert
// against them without hard-coding the same magic numbers, and the
// defaults so tests can verify env overrides take effect.
export const __HEYGEN_VALIDATION_REPORTER_DEFAULTS = DEFAULTS;
export function __getActiveHeygenValidationReporterTunables(): Tunables {
  return { ...activeTunables };
}
// Backwards-compatible alias for existing tests that import the static
// tunables. Returns the *active* (post-register) values.
export const __HEYGEN_VALIDATION_REPORTER_TUNABLES = new Proxy(
  {} as Tunables,
  {
    get(_t, prop: string) {
      return activeTunables[prop as TunableKey];
    },
  },
);
