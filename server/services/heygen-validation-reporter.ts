/**
 * Wires the shared HeyGen response-validation pipeline into the server's
 * structured logger and realtime admin alert channel.
 *
 * `shared/heygenPhotoAvatarSchemas.ts` exposes a pluggable reporter so it
 * can stay free of server dependencies. Here we register a reporter that:
 *   1. Emits a single structured log line tagged
 *      `event: "heygen.response.invalid"` containing the endpoint, the
 *      groupId (when known), and the first few Zod issue paths.
 *   2. Broadcasts an admin-only realtime alert so the dashboard's
 *      notification bell pages operators about a HeyGen shape drift
 *      instead of waiting for a user to file a bug report.
 */

import {
  setHeygenValidationReporter,
  type HeygenValidationFailureReport,
} from "@shared/heygenPhotoAvatarSchemas";
import { realtimeService } from "../websocket";

let registered = false;
let lastBroadcastByEndpoint: Map<string, number> = new Map();
const BROADCAST_DEDUP_MS = 5 * 60 * 1000; // 5 minutes per endpoint+groupId

export function registerHeygenValidationReporter(): void {
  if (registered) return;
  registered = true;

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

    // De-dupe identical drift alerts so a polling loop can't spam the
    // dashboard while operators are already triaging the issue.
    const dedupeKey = `${report.endpoint}::${report.groupId ?? ""}`;
    const now = Date.now();
    const last = lastBroadcastByEndpoint.get(dedupeKey) ?? 0;
    if (now - last < BROADCAST_DEDUP_MS) return;
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
  });
}

// Test-only: clear the dedup cache so each test run sees a fresh broadcast.
export function __resetHeygenValidationReporterForTests(): void {
  lastBroadcastByEndpoint = new Map();
}
