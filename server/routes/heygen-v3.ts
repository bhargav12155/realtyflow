/**
 * HeyGen Photo Avatar v3 routes — webhook receiver and the v3-flavoured
 * endpoints used by the modern UI. The legacy `/api/photo-avatars/*` routes
 * in `server/routes.ts` continue to work; this file only covers the new v3
 * surface so we can roll it out incrementally without touching the giant
 * routes.ts file.
 */
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { heygenWebhookEvents } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { storage } from "../storage";
import { realtimeService } from "../websocket";
import {
  HeyGenV3Service,
  verifyHeygenWebhookSignature,
  type ConsentStatus as ConsentStatusValue,
} from "../services/heygen-v3";

function getV3Service(): HeyGenV3Service {
  return new HeyGenV3Service();
}

// Map a HeyGen webhook status string into the value we store in
// photo_avatar_groups.training_status. We only update when we get one of
// the well-known transitions; unknown statuses are left untouched.
function mapWebhookStatusToTrainingStatus(
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s === "ready" || s === "completed" || s === "succeeded" || s === "success")
    return "ready";
  if (s === "failed" || s === "error") return "failed";
  if (s === "training" || s === "in_progress" || s === "processing")
    return "training";
  if (s === "pending" || s === "queued") return "pending";
  return undefined;
}

export function registerHeygenV3Routes(app: Express) {
  // -------------------------------------------------------------------
  // Create a new v3 photo-avatar group. Used by the modern Upload UI;
  // any new avatar group goes through this path so it's tagged with
  // `apiVersion: 'v3'` and starts the consent lifecycle. The legacy
  // `/api/photo-avatars/create-from-uploads` route remains for any
  // existing v2 callers.
  // -------------------------------------------------------------------
  app.post(
    "/api/v3/photo-avatars",
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) return res.status(401).json({ error: "unauthorized" });

      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const imageKey =
        typeof req.body?.imageKey === "string" ? req.body.imageKey : "";
      const imageHash =
        typeof req.body?.imageHash === "string" ? req.body.imageHash : null;
      const s3ImageUrl =
        typeof req.body?.s3ImageUrl === "string" ? req.body.s3ImageUrl : null;
      const consentAcknowledged = req.body?.consentAcknowledged === true;
      const consentVideoUrl =
        typeof req.body?.consentVideoUrl === "string" && req.body.consentVideoUrl
          ? req.body.consentVideoUrl
          : undefined;
      const consentSignature =
        typeof req.body?.consentSignature === "string" && req.body.consentSignature
          ? req.body.consentSignature
          : undefined;

      if (!name || !imageKey) {
        return res
          .status(400)
          .json({ error: "name_and_image_key_required" });
      }
      if (!consentAcknowledged) {
        return res
          .status(400)
          .json({ error: "consent_required" });
      }

      const service = getV3Service();
      let createResult: { group_id: string };
      try {
        createResult = await service.createAvatar({ name, imageKey });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return res
          .status(502)
          .json({ error: "heygen_v3_create_failed", message });
      }

      const heygenGroupId = createResult.group_id;
      let consentStatus: ConsentStatusValue = "pending";

      // If the caller supplied consent details up front, record them
      // immediately so the group starts life with the right status.
      if (consentVideoUrl || consentSignature) {
        try {
          const consent = await service.createConsent({
            groupId: heygenGroupId,
            consentVideoUrl,
            signature: consentSignature,
          });
          consentStatus = consent.status;
        } catch (err) {
          console.warn(
            "[heygen-v3] consent recording failed during create:",
            err instanceof Error ? err.message : err,
          );
        }
      }

      // Persist the group row. If this fails we must surface an error
      // to the caller — otherwise the HeyGen group is orphaned with no
      // local row tying it to the user, and the UI would falsely show
      // success while subsequent listing/lookup calls would not find
      // the group.
      try {
        await storage.createPhotoAvatarGroup({
          userId,
          heygenGroupId,
          groupName: name,
          imageHash,
          s3ImageUrl,
          heygenImageKey: imageKey,
          trainingStatus: "pending",
          apiVersion: "v3",
          consentStatus,
        });
      } catch (dbError) {
        console.error(
          "[heygen-v3] failed to persist photo_avatar_groups row, returning 500 so the UI can surface the failure (HeyGen group %s may need manual cleanup):",
          heygenGroupId,
          dbError,
        );
        return res.status(500).json({
          error: "persistence_failed",
          message:
            "Avatar was created in HeyGen but could not be saved locally. Please contact support and reference HeyGen group " +
            heygenGroupId,
          heygenGroupId,
        });
      }

      return res.json({
        success: true,
        groupId: heygenGroupId,
        apiVersion: "v3",
        consentStatus,
      });
    },
  );

  // -------------------------------------------------------------------
  // Webhook receiver. HeyGen POSTs JSON with an HMAC signature header
  // (`x-heygen-signature`). We persist every event for audit, verify the
  // signature against the bytes captured by the global json verify hook
  // in `server/index.ts` (which stashes `req.rawBody` for any
  // `/api/webhooks/*` URL), then update the related photo_avatar_groups
  // row and broadcast a websocket event so the UI reflects status
  // changes live.
  // -------------------------------------------------------------------
  app.post(
    "/api/webhooks/heygen",
    async (req: Request, res: Response) => {
      const rawBuf = (req as Request & { rawBody?: Buffer }).rawBody;
      const rawBody = rawBuf ? rawBuf.toString("utf8") : "";
      const signatureHeader =
        (req.headers["x-heygen-signature"] as string | undefined) ??
        (req.headers["x-signature"] as string | undefined);

      // The global express.json() middleware has already parsed the body
      // for us, so prefer that — but fall back to parsing rawBody in
      // case parsing was skipped (e.g. wrong content-type).
      let payload: Record<string, unknown> = {};
      if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
        payload = req.body as Record<string, unknown>;
      } else if (rawBody) {
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          console.warn("[heygen-webhook] received non-JSON body");
        }
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

      // Update the related group's training_status (if we can map the
      // event to a known group) and then broadcast to its owner.
      try {
        const groupId = eventData.group_id as string | undefined;
        const rawStatus = eventData.status as string | undefined;
        if (groupId) {
          const group = await storage.getPhotoAvatarGroupByHeygenId(groupId);
          if (group) {
            const mapped = mapWebhookStatusToTrainingStatus(rawStatus);
            if (mapped && mapped !== group.trainingStatus) {
              await storage.updatePhotoAvatarGroup(group.id, {
                trainingStatus: mapped,
              });
            }
            if (group.userId) {
              realtimeService.notifyPhotoAvatarStatus(group.userId, {
                groupId,
                lookId: eventData.look_id as string | undefined,
                status: mapped ?? rawStatus ?? "updated",
                eventType,
              });
            }
          }
        }
      } catch (err) {
        console.error("[heygen-webhook] update/broadcast failed", err);
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
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      const { groupId } = req.params;
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

      // Per-tenant ownership check: only allow listing looks for a HeyGen
      // group that belongs to the authenticated user.
      const owned = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
        groupId,
        userId,
      );
      if (!owned) {
        return res.status(404).json({ error: "group_not_found" });
      }

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
  // v3 voice picker — persist a HeyGen catalogue voice into the user's
  // custom_voices library so it shows up alongside cloned voices.
  // -------------------------------------------------------------------
  app.post(
    "/api/v3/voices/use",
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) return res.status(401).json({ error: "unauthorized" });

      const heygenVoiceId =
        typeof req.body?.heygenVoiceId === "string" ? req.body.heygenVoiceId.trim() : "";
      const name =
        typeof req.body?.name === "string" && req.body.name.trim()
          ? req.body.name.trim()
          : heygenVoiceId;
      if (!heygenVoiceId) {
        return res.status(400).json({ error: "heygenVoiceId is required" });
      }
      const language =
        typeof req.body?.language === "string" ? req.body.language : null;
      const gender =
        typeof req.body?.gender === "string" ? req.body.gender : null;
      const sampleAudioUrl =
        typeof req.body?.sampleAudioUrl === "string" ? req.body.sampleAudioUrl : null;

      try {
        const voice = await storage.createCustomVoice({
          userId,
          name,
          audioUrl: sampleAudioUrl ?? "",
          fileSize: null,
          heygenAudioAssetId: null,
          status: "ready",
          heygenVoiceId,
          language,
          gender,
          sampleAudioUrl,
        });
        return res.status(201).json(voice);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ error: "voice_save_failed", message });
      }
    },
  );

  // -------------------------------------------------------------------
  // v3 voice designer — synthesise a brand-new voice from a text prompt
  // and persist the resulting HeyGen voice id into custom_voices.
  // -------------------------------------------------------------------
  app.post(
    "/api/v3/voices/design",
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) return res.status(401).json({ error: "unauthorized" });

      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const description =
        typeof req.body?.description === "string" ? req.body.description.trim() : "";
      const language =
        typeof req.body?.language === "string" && req.body.language.trim()
          ? req.body.language.trim()
          : undefined;
      const gender =
        typeof req.body?.gender === "string" && req.body.gender.trim()
          ? req.body.gender.trim()
          : undefined;

      if (!name) return res.status(400).json({ error: "name is required" });
      if (!description)
        return res.status(400).json({ error: "description is required" });

      try {
        const designed = await getV3Service().designVoice({
          name,
          description,
          language,
          gender,
        });
        const voice = await storage.createCustomVoice({
          userId,
          name,
          audioUrl: designed.preview_url ?? "",
          fileSize: null,
          heygenAudioAssetId: null,
          status: "ready",
          heygenVoiceId: designed.voice_id,
          language: language ?? null,
          gender: gender ?? null,
          sampleAudioUrl: designed.preview_url ?? null,
        });
        return res.status(201).json(voice);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(502).json({ error: "heygen_v3_voice_design_failed", message });
      }
    },
  );

  // -------------------------------------------------------------------
  // v3 consent — record consent for a group's likeness.
  // -------------------------------------------------------------------
  app.post(
    "/api/v3/photo-avatars/:groupId/consent",
    requireAuth,
    async (req: Request, res: Response) => {
      const { groupId } = req.params;
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      const action =
        req.body?.action === "revoke" ? "revoke" : "approve";
      const consentVideoUrl =
        typeof req.body?.consentVideoUrl === "string" && req.body.consentVideoUrl
          ? req.body.consentVideoUrl
          : undefined;
      const signature =
        typeof req.body?.signature === "string" && req.body.signature
          ? req.body.signature
          : undefined;

      if (!userId) return res.status(401).json({ error: "unauthorized" });

      // Make sure the group belongs to the caller.
      const group = await storage.getPhotoAvatarGroupByHeygenIdAndUser(groupId, userId);
      if (!group) return res.status(404).json({ error: "group_not_found" });

      // Revoke is a local-only state change — HeyGen has no public revoke
      // endpoint, so we simply mark the group as revoked in our DB so the
      // UI stops treating the likeness as approved for new generations.
      if (action === "revoke") {
        await storage.updatePhotoAvatarGroup(group.id, {
          consentStatus: "revoked",
        });
        return res.json({ status: "revoked" as ConsentStatusValue });
      }

      // Approve flow requires either a consent video URL or a signature so
      // we have something to send to HeyGen's /consent endpoint.
      if (!consentVideoUrl && !signature) {
        return res
          .status(400)
          .json({ error: "consent_video_url_or_signature_required" });
      }

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
