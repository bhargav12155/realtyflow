/**
 * HeyGen Photo Avatar v3 routes — webhook receiver and the v3-flavoured
 * endpoints used by the modern UI. The legacy `/api/photo-avatars/*` routes
 * in `server/routes.ts` continue to work; this file only covers the new v3
 * surface so we can roll it out incrementally without touching the giant
 * routes.ts file.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { db } from "../db";
import { heygenWebhookEvents } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { storage } from "../storage";
import { realtimeService } from "../websocket";
import { HeyGenV3Service, verifyHeygenWebhookSignature } from "../services/heygen-v3";

function getV3Service(): HeyGenV3Service {
  return new HeyGenV3Service();
}

export function registerHeygenV3Routes(app: Express) {
  // -------------------------------------------------------------------
  // Webhook receiver. HeyGen POSTs JSON with an HMAC signature header
  // (`x-heygen-signature`). We persist every event for audit, then if it
  // verifies we broadcast a websocket update so the UI reflects status
  // changes live.
  //
  // We mount express.raw() locally so the global JSON parser doesn't
  // consume the body before we can re-hash it.
  // -------------------------------------------------------------------
  app.post(
    "/api/webhooks/heygen",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req: Request, res: Response) => {
      const rawBody = (req.body as Buffer | undefined)?.toString("utf8") ?? "";
      const signatureHeader =
        (req.headers["x-heygen-signature"] as string | undefined) ??
        (req.headers["x-signature"] as string | undefined);

      let payload: Record<string, unknown> = {};
      try {
        payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
      } catch (err) {
        console.warn("[heygen-webhook] received non-JSON body");
      }

      const verified = verifyHeygenWebhookSignature(rawBody, signatureHeader);
      const eventType =
        (payload.event_type as string | undefined) ??
        (payload.type as string | undefined) ??
        "unknown";
      const eventData = (payload.data as Record<string, unknown> | undefined) ?? {};
      const resourceId =
        (eventData.group_id as string | undefined) ??
        (eventData.avatar_id as string | undefined) ??
        (eventData.video_id as string | undefined) ??
        (eventData.id as string | undefined) ??
        null;

      // Always persist — even unverified events are useful for debugging.
      try {
        await db.insert(heygenWebhookEvents).values({
          eventType,
          resourceId,
          payload: payload as unknown,
          signature: signatureHeader ?? null,
          verified,
        });
      } catch (err) {
        console.error("[heygen-webhook] failed to persist event", err);
      }

      // In dev / when no secret is configured, we accept the event but log
      // loudly so the operator notices. In production with a configured
      // secret, an invalid signature is rejected.
      if (!verified) {
        if (process.env.HEYGEN_WEBHOOK_SECRET) {
          return res.status(401).json({ error: "invalid signature" });
        }
        console.warn(
          "[heygen-webhook] HEYGEN_WEBHOOK_SECRET not set — accepting unverified event in dev",
        );
      }

      // Broadcast to the owning user, if we can map the resource back to
      // one. For groups we look up the photo_avatar_groups row.
      try {
        const groupId = eventData.group_id as string | undefined;
        if (groupId) {
          const group = await storage.getPhotoAvatarGroupByHeygenId(groupId);
          if (group?.userId) {
            realtimeService.notifyPhotoAvatarStatus(group.userId, {
              groupId,
              lookId: eventData.look_id as string | undefined,
              status: (eventData.status as string | undefined) ?? "updated",
              eventType,
            });
          }
        }
      } catch (err) {
        console.error("[heygen-webhook] broadcast failed", err);
      }

      return res.status(200).json({ ok: true, verified });
    },
  );

  // -------------------------------------------------------------------
  // v3 looks browser — list available looks for a group via the v3 API.
  // The legacy v2 implementation lives in routes.ts and stays as the
  // default until the UI switches over. This endpoint is opt-in.
  // -------------------------------------------------------------------
  app.get(
    "/api/v3/photo-avatars/:groupId/looks",
    requireAuth,
    async (req: Request, res: Response) => {
      const { groupId } = req.params;
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      try {
        const page = await getV3Service().listLooks(groupId, cursor);
        return res.json(page);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(502).json({ error: "heygen_v3_looks_failed", message });
      }
    },
  );

  // -------------------------------------------------------------------
  // v3 voice browser — searchable list of HeyGen voices.
  // -------------------------------------------------------------------
  app.get("/api/v3/voices", requireAuth, async (req: Request, res: Response) => {
    const query = {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      language: typeof req.query.language === "string" ? req.query.language : undefined,
      gender: typeof req.query.gender === "string" ? req.query.gender : undefined,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
    };
    try {
      const page = await getV3Service().listVoices(query);
      return res.json(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return res.status(502).json({ error: "heygen_v3_voices_failed", message });
    }
  });

  // -------------------------------------------------------------------
  // v3 consent — record consent for a group's likeness.
  // -------------------------------------------------------------------
  app.post(
    "/api/v3/photo-avatars/:groupId/consent",
    requireAuth,
    async (req: Request, res: Response) => {
      const { groupId } = req.params;
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      const consentVideoUrl = typeof req.body?.consentVideoUrl === "string" ? req.body.consentVideoUrl : undefined;
      const signature = typeof req.body?.signature === "string" ? req.body.signature : undefined;

      if (!userId) return res.status(401).json({ error: "unauthorized" });

      // Make sure the group belongs to the caller.
      const group = await storage.getPhotoAvatarGroupByHeygenIdAndUser(groupId, userId);
      if (!group) return res.status(404).json({ error: "group_not_found" });

      try {
        const result = await getV3Service().createConsent({
          groupId,
          consentVideoUrl,
          signature,
        });
        await storage.updatePhotoAvatarGroup(group.id, {
          consentStatus: result.status,
        });
        return res.json(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(502).json({ error: "heygen_v3_consent_failed", message });
      }
    },
  );
}
