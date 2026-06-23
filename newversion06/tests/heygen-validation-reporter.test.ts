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

/** Wait one macrotask so fire-and-forget Slack POSTs settle. */
function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setImmediate(r));
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
    "HEYGEN_DEGRADED_UPDATE_MS",
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
    // Restore any fake timers a test may have enabled before tearing
    // down the reporter (otherwise the reset's clearTimeout calls will
    // run against the mocked clock).
    try {
      mock.timers.reset();
    } catch {
      // mock.timers.reset() throws if no timers were enabled — fine.
    }
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

  it("does not re-page the on-call while the endpoint is already degraded", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";

    // Trip the burst...
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    // ...and keep failing well past the original BURST_THRESHOLD.
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD * 4; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await flushMicrotasks();

    // Only the rising-edge admin broadcast should have fired.
    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(
      burstBroadcasts.length,
      1,
      "rising-edge burst should only fire once per degraded period",
    );

    // And only the rising-edge Slack page should have been POSTed —
    // periodic "still degraded" updates are throttled to
    // DEGRADED_UPDATE_MS (30m), so a tight loop of failures must not
    // re-page the channel.
    assert.equal(
      fetchSpy.mock.calls.length,
      1,
      "Slack should be paged once on the rising edge, not on every subsequent failure",
    );
    const firstBody = JSON.parse(
      fetchSpy.mock.calls[0].arguments[1].body as string,
    ) as { text: string };
    assert.match(firstBody.text, /shape drift burst/i);
    assert.doesNotMatch(firstBody.text, /still degraded/i);
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
    await flushMicrotasks();

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
    await flushMicrotasks();
    assert.equal(fetchSpy.mock.calls.length, 0);
  });

  it("does not POST to Slack when below the burst threshold", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";
    triggerFailureForAvatarGroupList();
    await flushMicrotasks();
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
    await flushMicrotasks();
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
    assert.equal(active.DEGRADED_UPDATE_MS, DEFAULTS.DEGRADED_UPDATE_MS);
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

  it("honors HEYGEN_BURST_WINDOW_MS and HEYGEN_DEGRADED_UPDATE_MS overrides", () => {
    __resetHeygenValidationReporterForTests();
    process.env.HEYGEN_BURST_WINDOW_MS = "60000";
    process.env.HEYGEN_DEGRADED_UPDATE_MS = "120000";
    registerHeygenValidationReporter();

    const active = __getActiveHeygenValidationReporterTunables();
    assert.equal(active.BURST_WINDOW_MS, 60000);
    assert.equal(active.DEGRADED_UPDATE_MS, 120000);

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

  it("posts a periodic 'still degraded' Slack update once DEGRADED_UPDATE_MS has elapsed", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";
    mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });

    // Trip the burst (rising edge fires the initial Slack page).
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await flushMicrotasks();
    assert.equal(fetchSpy.mock.calls.length, 1);

    // Advance just under the periodic update interval but keep
    // failing — no new Slack POST should fire yet. Each tick advances
    // by less than BURST_WINDOW_MS so the recovery timer keeps getting
    // refreshed instead of firing.
    const stepMs = Math.floor(TUNABLES.BURST_WINDOW_MS / 2);
    let elapsed = 0;
    while (elapsed + stepMs < TUNABLES.DEGRADED_UPDATE_MS) {
      mock.timers.tick(stepMs);
      elapsed += stepMs;
      triggerFailureForAvatarGroupList();
      await flushMicrotasks();
    }
    assert.equal(
      fetchSpy.mock.calls.length,
      1,
      "no extra Slack POST before DEGRADED_UPDATE_MS elapses",
    );

    // Push past the periodic update interval and trigger one more
    // failure — this should fire exactly one "still degraded" update.
    mock.timers.tick(TUNABLES.DEGRADED_UPDATE_MS - elapsed + 1);
    triggerFailureForAvatarGroupList();
    await flushMicrotasks();

    assert.equal(
      fetchSpy.mock.calls.length,
      2,
      "expected one 'still degraded' Slack update after the heartbeat interval",
    );
    const updateBody = JSON.parse(
      fetchSpy.mock.calls[1].arguments[1].body as string,
    ) as { text: string };
    assert.match(updateBody.text, /still degraded/i);
    assert.match(updateBody.text, /\/v2\/avatar_group\.list/);
  });

  it("posts a single recovery message after a full window without failures", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";
    mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });

    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await flushMicrotasks();
    assert.equal(fetchSpy.mock.calls.length, 1, "rising-edge page");

    // Advance one full window with zero failures — the recovery timer
    // should fire and post a recovery message.
    mock.timers.tick(TUNABLES.BURST_WINDOW_MS + 1);
    await flushMicrotasks();

    assert.equal(
      fetchSpy.mock.calls.length,
      2,
      "expected a recovery Slack POST after one quiet window",
    );
    const recoveryBody = JSON.parse(
      fetchSpy.mock.calls[1].arguments[1].body as string,
    ) as { text: string };
    assert.match(recoveryBody.text, /recovered/i);
    assert.match(recoveryBody.text, /\/v2\/avatar_group\.list/);

    // The dashboard should also see an info-severity recovery alert.
    const recoveryBroadcasts = broadcastSpy.mock.calls.filter((c) => {
      const a = c.arguments[0] as { severity: string; title: string };
      return a.severity === "info" && /recovered/i.test(a.title);
    });
    assert.equal(recoveryBroadcasts.length, 1);

    // And a structured recovery log line should be emitted.
    const warnLines = warnSpy.mock.calls
      .map((c) => c.arguments[0])
      .filter((a): a is string => typeof a === "string");
    assert.ok(
      warnLines.some((l) => l.includes("heygen.response.invalid.recovered")),
      "expected a structured recovered log line",
    );
  });

  it("does not post recovery while failures keep refreshing the recovery timer", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";
    mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });

    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await flushMicrotasks();
    assert.equal(fetchSpy.mock.calls.length, 1);

    // Tick under the recovery window, fail, repeat — a few times.
    const stepMs = Math.floor(TUNABLES.BURST_WINDOW_MS / 2);
    for (let i = 0; i < 4; i += 1) {
      mock.timers.tick(stepMs);
      triggerFailureForAvatarGroupList();
      await flushMicrotasks();
    }

    // No recovery should have been posted yet.
    const recoveryBroadcasts = broadcastSpy.mock.calls.filter((c) => {
      const a = c.arguments[0] as { severity: string; title: string };
      return a.severity === "info" && /recovered/i.test(a.title);
    });
    assert.equal(recoveryBroadcasts.length, 0);
  });

  it("re-pages on a fresh rising edge after a full recovery", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL =
      "https://hooks.slack.example/services/T/B/X";
    mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });

    // First burst -> page.
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await flushMicrotasks();
    // Recovery fires after one quiet window.
    mock.timers.tick(TUNABLES.BURST_WINDOW_MS + 1);
    await flushMicrotasks();
    assert.equal(fetchSpy.mock.calls.length, 2, "alert + recovery");

    // A new burst after recovery should page again as a rising edge.
    for (let i = 0; i < TUNABLES.BURST_THRESHOLD; i += 1) {
      triggerFailureForAvatarGroupList();
    }
    await flushMicrotasks();

    assert.equal(
      fetchSpy.mock.calls.length,
      3,
      "expected a fresh rising-edge page after recovery",
    );
    const body = JSON.parse(
      fetchSpy.mock.calls[2].arguments[1].body as string,
    ) as { text: string };
    assert.match(body.text, /shape drift burst/i);

    const burstBroadcasts = broadcastSpy.mock.calls.filter((c) =>
      /burst/i.test((c.arguments[0] as { title: string }).title),
    );
    assert.equal(burstBroadcasts.length, 2);
  });
});
