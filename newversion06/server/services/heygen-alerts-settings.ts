/**
 * Admin-configurable HeyGen Slack alert settings.
 *
 * Reads/writes a single row in the `platform_settings` table under the
 * key `heygen_alerts`. The shape is `{enabled, webhookUrl}`. The
 * heygen-validation-reporter consults this provider before falling back
 * to the `HEYGEN_BURST_SLACK_WEBHOOK_URL` env var so an operator can
 * change the destination channel from the admin dashboard without
 * touching Replit secrets.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import type { HeygenAlertsSettings } from "./heygen-validation-reporter";

export const HEYGEN_ALERTS_SETTINGS_KEY = "heygen_alerts";

export const heygenAlertsSettingsSchema = z.object({
  enabled: z.boolean(),
  // Allow null/empty to disable while keeping a record. When enabled is
  // true callers must supply a non-empty https URL.
  webhookUrl: z
    .string()
    .trim()
    .url({ message: "webhookUrl must be a valid URL" })
    .nullable(),
});

let cached: HeygenAlertsSettings | null = null;
let cacheLoaded = false;

export async function loadHeygenAlertsSettings(): Promise<HeygenAlertsSettings | null> {
  if (cacheLoaded) return cached;
  try {
    const result = await db.execute<{ value: unknown }>(
      sql`SELECT value FROM platform_settings WHERE key = ${HEYGEN_ALERTS_SETTINGS_KEY}`,
    );
    const row = result.rows[0];
    if (!row || !row.value) {
      cached = null;
    } else {
      const parsed = heygenAlertsSettingsSchema.safeParse(row.value);
      cached = parsed.success ? parsed.data : null;
    }
  } catch (err) {
    console.warn("[heygen-alerts-settings] failed to load settings", err);
    cached = null;
  }
  cacheLoaded = true;
  return cached;
}

export async function saveHeygenAlertsSettings(
  settings: HeygenAlertsSettings,
  updatedBy: string,
): Promise<HeygenAlertsSettings> {
  const value = JSON.stringify(settings);
  await db.execute(sql`
    INSERT INTO platform_settings (key, value, updated_at, updated_by)
    VALUES (${HEYGEN_ALERTS_SETTINGS_KEY}, ${value}::jsonb, NOW(), ${updatedBy})
    ON CONFLICT (key) DO UPDATE SET
      value = ${value}::jsonb,
      updated_at = NOW(),
      updated_by = ${updatedBy}
  `);
  cached = settings;
  cacheLoaded = true;
  return settings;
}

export function getCachedHeygenAlertsSettings(): HeygenAlertsSettings | null {
  return cached;
}

export function __resetHeygenAlertsSettingsCacheForTests(): void {
  cached = null;
  cacheLoaded = false;
}

/**
 * POST a small synthetic payload to the given webhook URL so we can
 * confirm the URL is reachable + accepts Slack-formatted messages
 * before persisting it. Returns `{ok: true}` on a 2xx response,
 * otherwise `{ok: false, status, detail}` with details suitable for
 * surfacing back to the admin UI.
 */
export async function probeHeygenAlertsWebhook(
  webhookUrl: string,
): Promise<{ ok: true } | { ok: false; status?: number; detail: string }> {
  const body = {
    text:
      ":wave: HeyGen alerts test message from iMakePage admin settings " +
      "(no incident — this confirms the webhook is reachable).",
  };
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = `Slack webhook returned HTTP ${res.status}`;
      try {
        const text = await res.text();
        if (text) detail += `: ${text.slice(0, 200)}`;
      } catch {
        // ignore body read errors — status alone is enough.
      }
      return { ok: false, status: res.status, detail };
    }
    return { ok: true };
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : "Unknown network error";
    return { ok: false, detail };
  }
}
