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
 *      rate crosses a small threshold inside a short window, transitions
 *      the endpoint into a "degraded" state. Entering that state emits a
 *      separate `event: "heygen.response.invalid.burst"` log line plus a
 *      critical-severity admin alert AND POSTs that burst payload to the
 *      Slack incoming webhook configured via
 *      `HEYGEN_BURST_SLACK_WEBHOOK_URL` so the team's on-call channel is
 *      paged directly.
 *
 *      Once an endpoint is degraded we do **not** keep re-paging on every
 *      additional burst. Instead the reporter:
 *        - posts a periodic "still degraded" update to the same Slack
 *          channel at most once every `DEGRADED_UPDATE_MS` (so the
 *          on-call channel gets a heartbeat without re-paging), and
 *        - schedules a recovery check that fires after
 *          `BURST_WINDOW_MS` of zero failures and posts a single
 *          recovery message before clearing the state.
 *
 *      See `docs/heygen-shape-drift-runbook.md` for the response
 *      procedure.
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
  // While an endpoint is in the "degraded" state we suppress re-pages
  // and instead post a single "still degraded" update at most once per
  // this interval, so a sustained outage gets a periodic heartbeat
  // without waking the on-call repeatedly.
  DEGRADED_UPDATE_MS: 30 * 60 * 1000,
} as const;

const ENV_KEYS = {
  BROADCAST_DEDUP_MS: "HEYGEN_BROADCAST_DEDUP_MS",
  BURST_WINDOW_MS: "HEYGEN_BURST_WINDOW_MS",
  BURST_THRESHOLD: "HEYGEN_BURST_THRESHOLD",
  DEGRADED_UPDATE_MS: "HEYGEN_DEGRADED_UPDATE_MS",
} as const;

type TunableKey = keyof typeof DEFAULTS;

interface Tunables {
  BROADCAST_DEDUP_MS: number;
  BURST_WINDOW_MS: number;
  BURST_THRESHOLD: number;
  DEGRADED_UPDATE_MS: number;
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

/**
 * Admin-configurable settings for HeyGen Slack alerts. When a provider is
 * registered (see `setHeygenAlertsSettingsProvider`), it takes precedence
 * over the `HEYGEN_BURST_SLACK_WEBHOOK_URL` env var so an operator can
 * change the destination channel (or disable the integration entirely)
 * from the admin dashboard without touching Replit secrets.
 */
export interface HeygenAlertsSettings {
  enabled: boolean;
  webhookUrl: string | null;
}

export type HeygenAlertsSettingsProvider = () =>
  | HeygenAlertsSettings
  | null
  | Promise<HeygenAlertsSettings | null>;

let alertsSettingsProvider: HeygenAlertsSettingsProvider | null = null;

export function setHeygenAlertsSettingsProvider(
  provider: HeygenAlertsSettingsProvider | null,
): void {
  alertsSettingsProvider = provider;
}

async function resolveAlertsSettings(): Promise<HeygenAlertsSettings> {
  if (alertsSettingsProvider) {
    try {
      const settings = await alertsSettingsProvider();
      if (settings) return settings;
    } catch (err) {
      console.warn(
        "[heygen-validation-reporter] alerts settings provider failed; falling back to env",
        err,
      );
    }
  }
  return {
    enabled: true,
    webhookUrl: process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL ?? null,
  };
}

type EndpointBurstState = {
  degradedSince: number;
  lastSlackUpdateAt: number;
  recoveryTimer: ReturnType<typeof setTimeout> | null;
};

let registered = false;
let activeTunables: Tunables = { ...DEFAULTS };
let lastBroadcastByEndpoint: Map<string, number> = new Map();
let recentFailureTimestamps: Map<string, number[]> = new Map();
let degradedEndpoints: Map<string, EndpointBurstState> = new Map();

type SlackBurstKind = "alert" | "update" | "recovery";

/**
 * POST a Slack-formatted burst notification to the incoming webhook
 * configured in `HEYGEN_BURST_SLACK_WEBHOOK_URL`. No-op (with a single
 * warn line) if the env var is unset, so local dev / test environments
 * don't need a webhook configured. Failures are swallowed so a Slack
 * outage cannot break the request path that triggered the burst.
 *
 * `kind` controls the message framing:
 *   - "alert"    — first page on the rising edge of a burst
 *   - "update"   — periodic "still degraded" heartbeat
 *   - "recovery" — single message when the endpoint has been quiet for
 *                  a full window
 */
async function postBurstToSlack(payload: {
  kind: SlackBurstKind;
  endpoint: string;
  count: number;
  windowMs: number;
  threshold: number;
  sampleIssuePaths: string[];
  sampleMessage: string;
  degradedSince?: number;
  degradedDurationMs?: number;
}): Promise<void> {
  const settings = await resolveAlertsSettings();
  if (!settings.enabled) {
    console.warn(
      "[heygen-validation-reporter] HeyGen Slack alerts disabled by admin settings; skipping burst notification",
    );
    return;
  }
  const webhookUrl = settings.webhookUrl;
  if (!webhookUrl) {
    console.warn(
      "[heygen-validation-reporter] no Slack webhook configured (admin settings or HEYGEN_BURST_SLACK_WEBHOOK_URL); skipping burst notification",
    );
    return;
  }

  const runbookUrl = process.env.HEYGEN_RUNBOOK_URL ?? DEFAULT_RUNBOOK_URL;
  const windowMinutes = Math.round(payload.windowMs / 60000);

  let text: string;
  let color: string;
  const fields: Array<{ title: string; value: string; short: boolean }> = [
    { title: "Endpoint", value: payload.endpoint, short: true },
  ];

  if (payload.kind === "alert") {
    text =
      `:rotating_light: *HeyGen shape drift burst* — ${payload.count} invalid responses ` +
      `for \`${payload.endpoint}\` in the last ${windowMinutes}m ` +
      `(threshold ${payload.threshold}). Runbook: ${runbookUrl}`;
    color = "danger";
    fields.push(
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
    );
  } else if (payload.kind === "update") {
    const ageMinutes = payload.degradedDurationMs
      ? Math.max(1, Math.round(payload.degradedDurationMs / 60000))
      : 0;
    text =
      `:warning: *HeyGen shape drift still degraded* — \`${payload.endpoint}\` ` +
      `is still failing (${payload.count} in the last ${windowMinutes}m, ` +
      `${ageMinutes}m since first alert). Runbook: ${runbookUrl}`;
    color = "warning";
    fields.push(
      {
        title: "Failures / Window",
        value: `${payload.count} in ${windowMinutes}m`,
        short: true,
      },
      {
        title: "Degraded for",
        value: `${ageMinutes}m`,
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
      { title: "Runbook", value: runbookUrl, short: false },
    );
  } else {
    const ageMinutes = payload.degradedDurationMs
      ? Math.max(1, Math.round(payload.degradedDurationMs / 60000))
      : 0;
    text =
      `:white_check_mark: *HeyGen shape drift recovered* — \`${payload.endpoint}\` ` +
      `has been healthy for ${windowMinutes}m. Total degraded duration: ${ageMinutes}m.`;
    color = "good";
    fields.push(
      {
        title: "Quiet window",
        value: `${windowMinutes}m`,
        short: true,
      },
      {
        title: "Degraded for",
        value: `${ageMinutes}m`,
        short: true,
      },
      { title: "Runbook", value: runbookUrl, short: false },
    );
  }

  const body = {
    text,
    attachments: [{ color, fields }],
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

function scheduleRecovery(endpoint: string): void {
  const state = degradedEndpoints.get(endpoint);
  if (!state) return;
  if (state.recoveryTimer) clearTimeout(state.recoveryTimer);
  const timer = setTimeout(() => {
    handleRecovery(endpoint);
  }, activeTunables.BURST_WINDOW_MS);
  // Don't keep the event loop alive on the recovery timer alone — server
  // shutdown should not block waiting for it to fire.
  if (typeof (timer as unknown as { unref?: () => void }).unref === "function") {
    (timer as unknown as { unref: () => void }).unref();
  }
  state.recoveryTimer = timer;
}

function handleRecovery(endpoint: string): void {
  const state = degradedEndpoints.get(endpoint);
  if (!state) return;
  degradedEndpoints.delete(endpoint);
  // Also forget the sliding-window timestamps so the next future burst
  // is a clean rising edge.
  recentFailureTimestamps.delete(endpoint);

  const now = Date.now();
  const degradedDurationMs = now - state.degradedSince;

  const logLine = {
    event: "heygen.response.invalid.recovered",
    endpoint,
    windowMs: activeTunables.BURST_WINDOW_MS,
    degradedDurationMs,
  };
  console.warn(JSON.stringify(logLine));

  try {
    realtimeService.broadcastAdminAlert({
      source: "heygen",
      severity: "info",
      title: "HeyGen shape drift recovered",
      message: `${endpoint} has been healthy for ${Math.round(
        activeTunables.BURST_WINDOW_MS / 60000,
      )} minutes. Total degraded duration: ${Math.max(
        1,
        Math.round(degradedDurationMs / 60000),
      )}m.`,
      context: {
        endpoint,
        recovered: true,
        windowMs: activeTunables.BURST_WINDOW_MS,
        degradedDurationMs,
      },
    });
  } catch (err) {
    console.warn(
      "[heygen-validation-reporter] failed to broadcast recovery admin alert",
      err,
    );
  }

  void postBurstToSlack({
    kind: "recovery",
    endpoint,
    count: 0,
    windowMs: activeTunables.BURST_WINDOW_MS,
    threshold: activeTunables.BURST_THRESHOLD,
    sampleIssuePaths: [],
    sampleMessage: "",
    degradedSince: state.degradedSince,
    degradedDurationMs,
  });
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
    // group".
    //
    // The reporter uses a small per-endpoint state machine:
    //   * "healthy"  — failures accumulate. When count >= BURST_THRESHOLD
    //                  the endpoint transitions to "degraded" and we
    //                  fire the rising-edge alert (log + admin alert +
    //                  Slack page).
    //   * "degraded" — every additional failure refreshes the recovery
    //                  timer. We do NOT re-page on each burst; instead
    //                  we post a periodic "still degraded" Slack update
    //                  at most once per DEGRADED_UPDATE_MS so the
    //                  on-call channel gets a heartbeat without being
    //                  woken up. After BURST_WINDOW_MS of zero failures
    //                  the recovery timer fires, we transition back to
    //                  "healthy", and we post a single recovery message.
    const burstEndpoint = normalizeEndpointForBurst(report.endpoint);
    const count = recordFailureForBurst(burstEndpoint, now);
    const existing = degradedEndpoints.get(burstEndpoint);

    if (existing) {
      // Already degraded — refresh recovery timer and possibly post a
      // throttled "still degraded" Slack update.
      scheduleRecovery(burstEndpoint);
      if (now - existing.lastSlackUpdateAt >= activeTunables.DEGRADED_UPDATE_MS) {
        existing.lastSlackUpdateAt = now;
        void postBurstToSlack({
          kind: "update",
          endpoint: burstEndpoint,
          count,
          windowMs: activeTunables.BURST_WINDOW_MS,
          threshold: activeTunables.BURST_THRESHOLD,
          sampleIssuePaths: report.issuePaths,
          sampleMessage: report.message,
          degradedSince: existing.degradedSince,
          degradedDurationMs: now - existing.degradedSince,
        });
      }
      return;
    }

    if (count < activeTunables.BURST_THRESHOLD) return;

    // Rising edge: enter "degraded" and fire the page.
    const state: EndpointBurstState = {
      degradedSince: now,
      lastSlackUpdateAt: now,
      recoveryTimer: null,
    };
    degradedEndpoints.set(burstEndpoint, state);
    scheduleRecovery(burstEndpoint);

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
        // `count`/`threshold`/`windowMs` context fields the dashboard
        // reads to surface it more prominently.
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
      kind: "alert",
      endpoint: burstEndpoint,
      count,
      windowMs: activeTunables.BURST_WINDOW_MS,
      threshold: activeTunables.BURST_THRESHOLD,
      sampleIssuePaths: report.issuePaths,
      sampleMessage: report.message,
    });
  });
}

// Test-only: clear the dedup + sliding-window caches and the
// `registered` guard so each test run can re-register a fresh reporter.
export function __resetHeygenValidationReporterForTests(): void {
  registered = false;
  activeTunables = { ...DEFAULTS };
  lastBroadcastByEndpoint = new Map();
  recentFailureTimestamps = new Map();
  alertsSettingsProvider = null;
  degradedEndpoints.forEach((state) => {
    if (state.recoveryTimer) clearTimeout(state.recoveryTimer);
  });
  degradedEndpoints = new Map();
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
