/**
 * Admin routes for managing HeyGen Slack alert settings.
 *
 * GET  /api/admin/heygen-alerts/settings — current settings (or defaults)
 * PUT  /api/admin/heygen-alerts/settings — validate + persist new settings.
 *   When `enabled === true` and a `webhookUrl` is supplied, we POST a
 *   small synthetic message to the webhook first; if that probe fails
 *   we return 400 without persisting so a typo can't silently break
 *   the on-call channel. Pass `skipTest: true` to bypass the probe (for
 *   internal-network webhooks that reject test traffic, etc.).
 */

import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import {
  loadHeygenAlertsSettings,
  probeHeygenAlertsWebhook,
  saveHeygenAlertsSettings,
  heygenAlertsSettingsSchema,
} from "../services/heygen-alerts-settings";
import type { HeygenAlertsSettings } from "../services/heygen-validation-reporter";

const updateSchema = heygenAlertsSettingsSchema
  .extend({
    skipTest: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enabled && !data.webhookUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["webhookUrl"],
        message: "webhookUrl is required when enabled is true",
      });
    }
  });

export interface AdminHeygenAlertsDeps {
  requireAdmin: RequestHandler;
  /**
   * Optional override of the webhook probe — primarily for tests so they
   * don't have to mock global fetch.
   */
  probeWebhook?: typeof probeHeygenAlertsWebhook;
  loadSettings?: typeof loadHeygenAlertsSettings;
  saveSettings?: typeof saveHeygenAlertsSettings;
}

export function registerAdminHeygenAlertsRoutes(
  app: Express,
  deps: AdminHeygenAlertsDeps,
): void {
  const probe = deps.probeWebhook ?? probeHeygenAlertsWebhook;
  const load = deps.loadSettings ?? loadHeygenAlertsSettings;
  const save = deps.saveSettings ?? saveHeygenAlertsSettings;

  app.get(
    "/api/admin/heygen-alerts/settings",
    deps.requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const settings = await load();
        const envFallbackConfigured = Boolean(
          process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL,
        );
        if (!settings) {
          return res.json({
            settings: {
              enabled: envFallbackConfigured,
              webhookUrl: null,
            },
            source: envFallbackConfigured ? "env" : "default",
            envFallbackConfigured,
          });
        }
        return res.json({
          settings,
          source: "admin",
          envFallbackConfigured,
        });
      } catch (err) {
        console.error("[admin-heygen-alerts] GET failed", err);
        return res.status(500).json({ error: "Failed to load settings" });
      }
    },
  );

  app.put(
    "/api/admin/heygen-alerts/settings",
    deps.requireAdmin,
    async (req: Request & { user?: { id?: string | number } }, res: Response) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid settings",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }
      const { skipTest, ...settings } = parsed.data;
      const next: HeygenAlertsSettings = {
        enabled: settings.enabled,
        webhookUrl: settings.webhookUrl,
      };

      if (next.enabled && next.webhookUrl && !skipTest) {
        const probeResult = await probe(next.webhookUrl);
        if (!probeResult.ok) {
          return res.status(400).json({
            error: "Webhook test failed",
            detail: probeResult.detail,
            status: "status" in probeResult ? probeResult.status : undefined,
          });
        }
      }

      const updatedBy = String(req.user?.id ?? "admin");
      try {
        const saved = await save(next, updatedBy);
        return res.json({ settings: saved, tested: next.enabled && !skipTest });
      } catch (err) {
        console.error("[admin-heygen-alerts] PUT failed", err);
        return res.status(500).json({ error: "Failed to save settings" });
      }
    },
  );
}
