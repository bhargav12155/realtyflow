import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  HeygenResponseValidationError,
  parseHeygenAvatarGroupListResponse,
  parseHeygenV3LooksPageResponse,
  parseHeygenV3VoicesPageResponse,
} from "../shared/heygenPhotoAvatarSchemas";
import {
  __HEYGEN_VALIDATION_REPORTER_DEFAULTS as DEFAULTS,
  __HEYGEN_VALIDATION_REPORTER_TUNABLES as TUNABLES,
  __getActiveHeygenValidationReporterTunables,
  __resetHeygenValidationReporterForTests,
  normalizeEndpointForBurst,
  registerHeygenValidationReporter,
  setHeygenAlertsSettingsProvider,
} from "../server/services/heygen-validation-reporter";
import { realtimeService } from "../server/websocket";

/**
 * Trigger one HeyGen schema-validation failure by feeding a deliberately
 * bad payload through one of the parser helpers. The helpers throw a
 * HeygenResponseValidationError but also fire the reporter pipeline as a
 * side effect — that pipeline is what these tests assert on.
 */
function triggerFailureForAvatarGroupList(): void {
  try {
    parseHeygenAvatarGroupListResponse({});
  } catch (err) {
    if (!(err instanceof HeygenResponseValidationError)) throw err;
  }
}

function triggerFailureForVoices(): void {
  try {
    // Pass an obviously-wrong shape (an array where an object is expected)
    // so a different endpoint fires the reporter.
    parseHeygenV3VoicesPageResponse([]);
  } catch (err) {
    if (!(err instanceof HeygenResponseValidationError)) throw err;
  }
}

describe("heygen-validation-reporter", () => {
  let warnSpy: ReturnType<typeof mock.method>;
  let errorSpy: ReturnType<typeof mock.method>;
  let broadcastSpy: ReturnType<typeof mock.method>;
  let fetchSpy: ReturnType<typeof mock.method>;
  const TUNABLE_ENV_KEYS = [
    "HEYGEN_BURST_SLACK_WEBHOOK_URL",
    "HEYGEN_BROADCAST_DEDUP_MS",
    "HEYGEN_BURST_WINDOW_MS",
    "HEYGEN_BURST_THRESHOLD",
    "HEYGEN_BURST_DEDUP_MS",
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    __resetHeygenValidationReporterForTests();
    warnSpy = mock.method(console, "warn", () => {});
    errorSpy = mock.method(console, "error", () => {});
    broadcastSpy = mock.method(realtimeService, "broadcastAdminAlert", () => {});
    fetchSpy = mock.method(globalThis, "fetch", async () =>
      new Response("ok", { status: 200 }),
    );
    for (const k of TUNABLE_ENV_KEYS) {
      originalEnv[k] = process.env[k];
      delete process.env[k];
    }
    registerHeygenValidationReporter();
  });

  afterEach(() => {
    warnSpy.mock.restore();
    errorSpy.mock.restore();
    broadcastSpy.mock.restore();
    fetchSpy.mock.restore();
    for (const k of TUNABLE_ENV_KEYS) {
      const v = originalEnv[k];
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
    __resetHeygenValidationReporterForTests();
  });

  it("emits a structured 'heygen.response.invalid' log line per failure", () => {
    triggerFailureForAvatarGroupList();

    const lines = warnSpy.mock.calls
      .map((c) => c.arguments[0])
      .filter((a): a is string => typeof a === "string");
    const matching = lines.find((l) => l.includes("heygen.response.invalid"));
    assert.ok(matching, "expected a structured warn log line");
    const parsed = JSON.parse(matching!);
    assert.equal(parsed.event, "heygen.response.invalid");
    assert.equal(parsed.endpoint, "/v2/avatar_group.list");
    assert.ok(Array.isArray(parsed.issuePaths));
    assert.equal(typeof parsed.message, "string");
  });

  it("broadcasts an admin alert (severity=error) tagged with the endpoint", () => {
    triggerFailureForAvatarGroupList();

    const perEventBroadcasts = broadcastSpy.mock.calls.filter((c) => {
      const a = c.arguments[0] as { severity: string; title: string };
      return a.severity === "error" && !/burst/i.test(a.title);
    });
    assert.equal(perEventBroadcasts.length, 1);
    const arg = perEventBroadcasts[0].arguments[0] as {
      source: string;
      title: string;
      context: { endpoint: string };
    };
    assert.equal(arg.source, "heygen");
    assert.match(arg.title, /HeyGen/);
    assert.equal(arg.context.endpoint, "/v2/avatar_group.list");
  });

  it("dedupes the per-endpoint admin alert within the dedup window", () => {
    triggerFailureForAvatarGroupList();
    triggerFailureForAvatarGroupList();
    const perEventBroadcasts = broadcastSpy.mock.calls.filter((c) => {
      const a = c.arguments[0] as { severity: string; title: string };
      return a.severity === "error" && !/burst/i.test(a.title);
    });
    assert.equal(perEventBroadcasts.length, 1);
  });

  it("emits a 'burst' alert + log line once the threshold is crossed", () => {
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }

    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 1, "expected one burst broadcast");
    const arg = burstBroadcasts[0].arguments[0] as {
      title: string;
      message: string;
      context: { endpoint: string; count: number; threshold: number };
    };
    assert.match(arg.title, /burst/i);
    assert.equal(arg.context.endpoint, "/v2/avatar_group.list");
    assert.ok(arg.context.count >= TUNABLES.BURST_THRESHOLD);
    assert.equal(arg.context.threshold, TUNABLES.BURST_THRESHOLD);
    assert.match(arg.message, /runbook/i);

    const errorLines = errorSpy.mock.calls
      .map((c) => c.arguments[0])
      .filter((a): a is string => typeof a === "string");
    const burstLogLine = errorLines.find((l) =>
      l.includes("heygen.response.invalid.burst"),
    );
    assert.ok(burstLogLine, "expected a structured error log line for the burst");
    const parsed = JSON.parse(burstLogLine!);
    assert.equal(parsed.event, "heygen.response.invalid.burst");
    assert.equal(parsed.endpoint, "/v2/avatar_group.list");
    assert.equal(parsed.threshold, TUNABLES.BURST_THRESHOLD);
  });

  it("does not emit a burst alert when below the threshold", () => {
    triggerFailureForAvatarGroupList();
    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 0);
  });

  it("dedupes repeated burst alerts for the same endpoint", () => {
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD + 5; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(
      burstBroadcasts.length,
      1,
      "burst alert should only fire once per endpoint within dedup window",
    );
  });

  it("counts failures per endpoint independently", () => {
    // Two failures for the avatar_group.list endpoint and two for the
    // voices endpoint — both below threshold individually, neither
    // should trip the burst alarm even though the combined count is at
    // the threshold.
    triggerFailureForAvatarGroupList();
    triggerFailureForAvatarGroupList();
    triggerFailureForVoices();
    triggerFailureForVoices();

    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 0);
  });

  it("normalizes endpoint labels so per-resource ids fold into one bucket", () => {
    assert.equal(
      normalizeEndpointForBurst("/v3/photo_avatars/abc123/looks"),
      "/v3/photo_avatars/:groupId/looks",
    );
    assert.equal(
      normalizeEndpointForBurst("/v2/avatar_group/zzz/avatars"),
      "/v2/avatar_group/:groupId/avatars",
    );
    assert.equal(
      normalizeEndpointForBurst("/v2/photo_avatar/train/status/grp_999"),
      "/v2/photo_avatar/train/status/:groupId",
    );
    assert.equal(
      normalizeEndpointForBurst("/v1/video_status.get?video_id=vid_42"),
      "/v1/video_status.get?video_id=:videoId",
    );
    // Endpoints without a known id pattern pass through unchanged.
    assert.equal(
      normalizeEndpointForBurst("/v3/voices"),
      "/v3/voices",
    );
  });

  it("trips the burst alarm when failures share a route but differ by resource id", () => {
    // Three failures for /v3/photo_avatars/<groupId>/looks with three
    // distinct group ids — without endpoint normalization the burst
    // counter would see one failure per bucket and never fire.
    for (const id of ["grp_a", "grp_b", "grp_c"]) {
      try {
        parseHeygenV3LooksPageResponse({ items: "not-an-array" }, id);
      } catch (err) {
        if (!(err instanceof HeygenResponseValidationError)) throw err;
      }
    }

    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 1);
    const ctx = (burstBroadcasts[0].arguments[0] as {
      context: { endpoint: string };
    }).context;
    assert.equal(ctx.endpoint, "/v3/photo_avatars/:groupId/looks");
  });

  it("POSTs the burst payload to the configured Slack webhook", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";

    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }

    // Wait a tick for the fire-and-forget Slack POST.
    await new Promise((r) => setImmediate(r));

    const calls = fetchSpy.mock.calls;
    assert.equal(calls.length, 1, "expected one Slack webhook POST");
    const [url, init] = calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://hooks.slack.example/services/T/B/X");
    assert.equal(init.method, "POST");
    assert.match(
      (init.headers as Record<string, string>)["Content-Type"],
      /application\/json/,
    );
    const body = JSON.parse(init.body as string) as {
      text: string;
      attachments: Array<{ fields: Array<{ title: string; value: string }> }>;
    };
    assert.match(body.text, /HeyGen shape drift burst/);
    assert.match(body.text, /\/v2\/avatar_group\.list/);
    assert.match(body.text, /runbook/i);
    const fieldTitles = body.attachments[0].fields.map((f) => f.title);
    assert.ok(fieldTitles.includes("Endpoint"));
    assert.ok(fieldTitles.includes("Runbook"));
  });

  it("skips the Slack POST when no webhook URL is configured", async () => {
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await new Promise((r) => setImmediate(r));
    assert.equal(fetchSpy.mock.calls.length, 0);
  });

  it("does not POST to Slack when below the burst threshold", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";
    triggerFailureForAvatarGroupList();
    await new Promise((r) => setImmediate(r));
    assert.equal(fetchSpy.mock.calls.length, 0);
  });

  it("survives a Slack webhook outage without crashing the request path", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";
    fetchSpy.mock.restore();
    fetchSpy = mock.method(globalThis, "fetch", async () => {
      throw new Error("network down");
    });

    assert.doesNotThrow(() => {
      for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
        triggerFailureForAvatarGroupList();
      }
    });
    await new Promise((r) => setImmediate(r));
    assert.equal(fetchSpy.mock.calls.length, 1);
  });

  it("prefers the admin-configured webhook over the env var", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/from-env";
    setHeygenAlertsSettingsProvider(() => ({
      enabled: true,
      webhookUrl: "https://hooks.slack.example/from-admin",
    }));

    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await new Promise((r) => setImmediate(r));

    const calls = fetchSpy.mock.calls;
    assert.equal(calls.length, 1);
    assert.equal(
      (calls[0].arguments as [string, RequestInit])[0],
      "https://hooks.slack.example/from-admin",
    );
  });

  it("skips the Slack POST when admin settings disable alerts (even with env set)", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/from-env";
    setHeygenAlertsSettingsProvider(() => ({
      enabled: false,
      webhookUrl: "https://hooks.slack.example/from-admin",
    }));

    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await new Promise((r) => setImmediate(r));

    assert.equal(fetchSpy.mock.calls.length, 0);
  });

  it("falls back to the env var when admin provider returns null", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/from-env";
    setHeygenAlertsSettingsProvider(() => null);

    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await new Promise((r) => setImmediate(r));

    assert.equal(fetchSpy.mock.calls.length, 1);
    assert.equal(
      (fetchSpy.mock.calls[0].arguments as [string, RequestInit])[0],
      "https://hooks.slack.example/from-env",
    );
  });

  it("does not crash when the websocket broadcaster throws", () => {
    broadcastSpy.mock.restore();
    broadcastSpy = mock.method(realtimeService, "broadcastAdminAlert", () => {
      throw new Error("ws not initialized");
    });

    assert.doesNotThrow(() => triggerFailureForAvatarGroupList());
  });

  it("uses default tunables when no env overrides are set", () => {
    const active = __getActiveHeygenValidationReporterTunables();
    assert.equal(active.BURST_THRESHOLD, DEFAULTS.BURST_THRESHOLD);
    assert.equal(active.BURST_WINDOW_MS, DEFAULTS.BURST_WINDOW_MS);
    assert.equal(active.BURST_DEDUP_MS, DEFAULTS.BURST_DEDUP_MS);
    assert.equal(active.BROADCAST_DEDUP_MS, DEFAULTS.BROADCAST_DEDUP_MS);
  });

  it("honors HEYGEN_BURST_THRESHOLD when re-registered", () => {
    __resetHeygenValidationReporterForTests();
    process.env.HEYGEN_BURST_THRESHOLD = "5";
    registerHeygenValidationReporter();

    assert.equal(
      __getActiveHeygenValidationReporterTunables().BURST_THRESHOLD,
      5,
    );
    assert.equal(TUNABLES.BURST_THRESHOLD, 5);

    // Below the override threshold (5): no burst should fire.
    for (let i = 0; i < 4; i += 1) triggerFailureForAvatarGroupList();
    let burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 0);

    // One more failure crosses the configured threshold.
    triggerFailureForAvatarGroupList();
    burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 1);
    const ctx = (burstBroadcasts[0].arguments[0] as {
      context: { threshold: number; count: number };
    }).context;
    assert.equal(ctx.threshold, 5);
    assert.ok(ctx.count >= 5);
  });

  it("honors HEYGEN_BURST_WINDOW_MS and HEYGEN_BURST_DEDUP_MS overrides", () => {
    __resetHeygenValidationReporterForTests();
    process.env.HEYGEN_BURST_WINDOW_MS = "60000";
    process.env.HEYGEN_BURST_DEDUP_MS = "120000";
    registerHeygenValidationReporter();

    const active = __getActiveHeygenValidationReporterTunables();
    assert.equal(active.BURST_WINDOW_MS, 60000);
    assert.equal(active.BURST_DEDUP_MS, 120000);

    for (let i = 0; i < active.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 1);
    const ctx = (burstBroadcasts[0].arguments[0] as {
      context: { windowMs: number };
    }).context;
    assert.equal(ctx.windowMs, 60000);
  });

  it("falls back to defaults and warns when an env override is invalid", () => {
    __resetHeygenValidationReporterForTests();
    process.env.HEYGEN_BURST_THRESHOLD = "not-a-number";
    process.env.HEYGEN_BURST_WINDOW_MS = "-1";
    registerHeygenValidationReporter();

    const active = __getActiveHeygenValidationReporterTunables();
    assert.equal(active.BURST_THRESHOLD, DEFAULTS.BURST_THRESHOLD);
    assert.equal(active.BURST_WINDOW_MS, DEFAULTS.BURST_WINDOW_MS);

    const warnLines = warnSpy.mock.calls
      .map((c) => c.arguments[0])
      .filter((a): a is string => typeof a === "string");
    assert.ok(
      warnLines.some((l) => l.includes("HEYGEN_BURST_THRESHOLD")),
      "expected a warn line about the invalid threshold",
    );
    assert.ok(
      warnLines.some((l) => l.includes("HEYGEN_BURST_WINDOW_MS")),
      "expected a warn line about the invalid window",
    );
  });
});
