# HeyGen shape-drift alert runbook

This runbook tells the on-call engineer what to do when the HeyGen
shape-drift alarm fires. It pairs with the alerting wired up in
`server/services/heygen-validation-reporter.ts`.

## What the alert means

Every server route that talks to HeyGen pipes the response through a Zod
schema in `shared/heygenPhotoAvatarSchemas.ts`. When HeyGen returns a
shape we did not expect, the parser throws
`HeygenResponseValidationError`. The reporter wired up at server start
turns each failure into:

1. A structured warn log line per failure:

   ```json
   {"event":"heygen.response.invalid","endpoint":"/v3/voices","groupId":null,"issuePaths":["items.0.voice_id"],"issueCount":1,"message":"..."}
   ```

2. An admin-only realtime alert (the dashboard notification bell), tagged
   `source: "heygen"`, `severity: "error"`. Deduped per
   `endpoint+groupId` for 5 minutes so a polling loop cannot spam the
   bell.

   The realtime channel only models `info | warning | error` severities.
   The burst alert (item 3) reuses `severity: "error"` and is
   distinguished by its title (`HeyGen shape drift burst detected`)
   and the `count` / `threshold` / `windowMs` fields in `context`.

3. When the rate of failures for one endpoint crosses
   **3 failures in 5 minutes**, a structured log line + admin alert:

   ```json
   {"event":"heygen.response.invalid.burst","endpoint":"/v3/photo_avatars/:groupId/looks","windowMs":300000,"threshold":3,"count":3, ...}
   ```

   The endpoint label is normalized so failures across different
   group / video ids count together (e.g.
   `/v3/photo_avatars/abc123/looks` and
   `/v3/photo_avatars/def456/looks` both bucket under
   `/v3/photo_avatars/:groupId/looks`).

   The burst alert only fires on the **rising edge** — once an
   endpoint has tripped the alarm it is considered "degraded" and
   does not re-page until it has fully recovered (see step 5 below),
   so a sustained outage does not wake the on-call repeatedly.

4. **A direct Slack webhook POST** to the on-call channel, in addition
   to the log line and the dashboard alert. The reporter posts to the
   incoming-webhook URL configured via the
   `HEYGEN_BURST_SLACK_WEBHOOK_URL` secret. The Slack message includes
   the normalized endpoint, the failure count + window, the first
   sample issue paths, and a link to this runbook (override the link
   via the `HEYGEN_RUNBOOK_URL` env var if your team mirrors these
   docs internally).

   If the webhook secret is unset, the burst alert still lights up the
   dashboard bell and the structured logs — only the Slack POST is
   skipped (with a single warn line). Configure the secret in the
   Replit Secrets panel as `HEYGEN_BURST_SLACK_WEBHOOK_URL` to wire the
   page-the-team channel.

   Webhook delivery is fire-and-forget: a Slack outage will not break
   the user request that tripped the burst. A non-2xx response from
   Slack is logged at warn level so it is visible in the structured
   logs without re-paging.

5. **Sustained-outage heartbeats and recovery messages.** While an
   endpoint stays degraded the reporter does not re-page. Instead it:

   - Posts a single ":warning: HeyGen shape drift still degraded"
     update to the same Slack channel at most once per
     `DEGRADED_UPDATE_MS` (default 30 minutes) so the on-call channel
     gets a heartbeat without being woken up again.
   - Tracks the last failure timestamp; once the endpoint has gone a
     full `BURST_WINDOW_MS` (default 5 minutes) without another
     failure, posts a single
     ":white_check_mark: HeyGen shape drift recovered" message,
     emits a `heygen.response.invalid.recovered` log line, and fires
     an `info`-severity admin alert. After recovery the next burst
     starts a fresh rising edge and pages again.

## When the alert fires

1. **Acknowledge** in the on-call channel so the rest of the team
   knows you are looking.
2. **Find the endpoint** — the alert message and the
   `heygen.response.invalid.burst` log line both include the HeyGen
   path (e.g. `/v3/voices`, `/v2/avatar_group.list`, `/v3/photo_avatars/:id/looks`).
3. **Pull a sample raw response.** Search the logs for the matching
   `heygen.response.invalid` lines from the same window — they include
   the failing `issuePaths` so you know which fields drifted.
4. **Check HeyGen status.** If the affected endpoint is broken across
   the board, check <https://status.heygen.com>. If HeyGen has declared
   an incident, escalate to the customer-comms owner and stand by — no
   code change needed.
5. **If the field really did change shape**, update the matching Zod
   schema in `shared/heygenPhotoAvatarSchemas.ts`:
   - For an added optional field: extend the schema with the new field
     so we capture it.
   - For a renamed/removed field: update the schema and the consumers
     that read the old field name. The schemas are passthrough, so old
     fields don't break parsing — only required fields do.
   - Add a regression test under `tests/heygen-photo-avatar-schemas.test.ts`
     covering the new shape.
6. **Ship the fix** — the burst alarm will auto-resolve once the rate
   drops below the threshold for one full window. There is no manual
   "resolve" button.

## Tunables

The thresholds live in `server/services/heygen-validation-reporter.ts`.
Defaults are in code, but each value is overridable per deploy via an
env var so operators can tighten or loosen the alarm without a code
change. Invalid / non-positive overrides fall back to the default and
log a warn line at server startup.

| Setting              | Env var                       | Default     | Meaning                                                                              |
| -------------------- | ----------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `BURST_THRESHOLD`    | `HEYGEN_BURST_THRESHOLD`      | `3`         | Failures within the window before the burst fires.                                   |
| `BURST_WINDOW_MS`    | `HEYGEN_BURST_WINDOW_MS`      | `300000`    | Sliding window length (ms). Also the quiet period after which an endpoint recovers. |
| `DEGRADED_UPDATE_MS` | `HEYGEN_DEGRADED_UPDATE_MS`   | `1800000`   | Minimum gap between "still degraded" Slack heartbeats while degraded (ms).           |
| `BROADCAST_DEDUP_MS` | `HEYGEN_BROADCAST_DEDUP_MS`   | `300000`    | Gap between per-event admin alerts for the same endpoint+groupId (ms).               |

Example: to match the policy "page when more than 5 incidents land in
10 minutes for a single endpoint", set
`HEYGEN_BURST_THRESHOLD=6` and `HEYGEN_BURST_WINDOW_MS=600000` in the
deploy environment.

If we start getting paged for one-off blips, raise `HEYGEN_BURST_THRESHOLD`.
If real outages are slipping past the alarm, lower it. Keep the change
small and add a note to this runbook with the date.

## Related code & tests

- Reporter implementation: `server/services/heygen-validation-reporter.ts`
- Reporter tests: `tests/heygen-validation-reporter.test.ts`
- Schema definitions and the `setHeygenValidationReporter` hook:
  `shared/heygenPhotoAvatarSchemas.ts`
- The `heygen_shape_drift` error code returned to the dashboard from
  the routes lives in `server/routes/heygen-v3.ts`
  (`maybeShapeDriftPayload`).
