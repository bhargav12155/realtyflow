import type { Request, Response } from "express";
import type { IStorage } from "../storage";
import type { HeyGenService } from "../services/heygen";
import type { CustomVoice } from "@shared/schema";

export interface RetryCloneDeps {
  storage: Pick<IStorage, "getCustomVoiceByIdAndUser" | "updateCustomVoice">;
  heygenServiceFactory: () => Pick<HeyGenService, "cloneVoice">;
}

export interface RenameVoiceDeps {
  storage: Pick<IStorage, "getCustomVoiceByIdAndUser" | "updateCustomVoice">;
}

export function createRenameVoiceHandler(deps: RenameVoiceDeps) {
  return async function renameVoiceHandler(req: Request, res: Response) {
    try {
      const user = (req as Request & { user: { id: string } }).user;
      const { id } = req.params;
      const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      if (!rawName) {
        return res.status(400).json({ error: "Voice name is required" });
      }
      if (rawName.length > 100) {
        return res.status(400).json({ error: "Voice name is too long (max 100 characters)" });
      }
      const existing = await deps.storage.getCustomVoiceByIdAndUser(id, user.id);
      if (!existing) {
        return res.status(404).json({ error: "Voice not found" });
      }
      const updated = await deps.storage.updateCustomVoice(id, user.id, { name: rawName });
      return res.json(updated);
    } catch (error) {
      console.error("Failed to rename custom voice:", error);
      res.status(500).json({ error: "Failed to rename custom voice" });
    }
  };
}

export interface CreateVoiceWithCloneInput {
  userId: string;
  name: string;
  audioBuffer: Buffer;
  audioMimeType: string;
  audioUrl: string;
  fileSize: number;
  language?: string;
  gender?: string;
}

export interface CreateVoiceWithCloneDeps {
  storage: Pick<IStorage, "createCustomVoice" | "updateCustomVoice">;
  heygenServiceFactory: () => Pick<HeyGenService, "uploadAudio" | "cloneVoice">;
}

/**
 * Persists a new custom voice in the explicit "cloning → ready|failed"
 * lifecycle so the UI can reflect each transition.
 *
 * 1. Creates the row with status="cloning" and the S3 audio URL.
 * 2. Uploads the audio to HeyGen, then clones into a reusable voice_id.
 * 3. Updates the row to status="ready" + heygenVoiceId on success,
 *    or status="failed" with a friendly error message on failure.
 */
export async function createVoiceWithClone(
  input: CreateVoiceWithCloneInput,
  deps: CreateVoiceWithCloneDeps
): Promise<{ voice: CustomVoice; cloneError?: string }> {
  let voice = await deps.storage.createCustomVoice({
    userId: input.userId,
    name: input.name,
    audioUrl: input.audioUrl,
    fileSize: input.fileSize,
    language: input.language,
    gender: input.gender,
    status: "cloning",
  });

  let cloneError: string | undefined;
  let heygenAudioAssetId: string | undefined;
  let heygenVoiceId: string | undefined;
  let sampleAudioUrl: string | undefined;
  let nextStatus: "ready" | "failed" = "failed";

  try {
    const heygenService = deps.heygenServiceFactory();
    heygenAudioAssetId = await heygenService.uploadAudio(
      input.audioBuffer,
      input.audioMimeType
    );

    try {
      const cloned = await heygenService.cloneVoice({
        audioAssetId: heygenAudioAssetId,
        name: input.name,
        language: input.language,
        gender: input.gender,
      });
      heygenVoiceId = cloned.voiceId;
      sampleAudioUrl = cloned.previewAudioUrl;
      nextStatus = "ready";
    } catch (cloneErr) {
      cloneError = cloneErr instanceof Error ? cloneErr.message : "Voice cloning failed";
    }
  } catch (uploadErr) {
    cloneError = uploadErr instanceof Error ? uploadErr.message : "Upload to HeyGen failed";
  }

  const updated = await deps.storage.updateCustomVoice(voice.id, input.userId, {
    status: nextStatus,
    heygenAudioAssetId: heygenAudioAssetId ?? null,
    heygenVoiceId: heygenVoiceId ?? null,
    sampleAudioUrl: sampleAudioUrl ?? null,
  });

  return { voice: updated ?? voice, cloneError };
}

export function createRetryCloneHandler(deps: RetryCloneDeps) {
  return async function retryCloneHandler(req: Request, res: Response) {
    try {
      const user = (req as Request & { user: { id: string } }).user;
      const { id } = req.params;

      const voice = await deps.storage.getCustomVoiceByIdAndUser(id, user.id);
      if (!voice) {
        return res.status(404).json({ error: "Voice not found" });
      }
      if (!voice.heygenAudioAssetId) {
        return res.status(400).json({
          error: "No audio sample on file for this voice. Please re-upload to clone.",
        });
      }
      if (voice.status === "cloning") {
        return res.status(409).json({
          error: "A clone is already in progress for this voice. Please wait for it to finish.",
        });
      }

      await deps.storage.updateCustomVoice(id, user.id, { status: "cloning" });

      try {
        const heygenService = deps.heygenServiceFactory();
        const cloned = await heygenService.cloneVoice({
          audioAssetId: voice.heygenAudioAssetId,
          name: voice.name,
          language: voice.language || undefined,
          gender: voice.gender || undefined,
        });
        const updated = await deps.storage.updateCustomVoice(id, user.id, {
          status: "ready",
          heygenVoiceId: cloned.voiceId,
          sampleAudioUrl: cloned.previewAudioUrl ?? voice.sampleAudioUrl ?? null,
        });
        return res.json(updated);
      } catch (cloneErr) {
        const message = cloneErr instanceof Error ? cloneErr.message : "Voice cloning failed";
        await deps.storage.updateCustomVoice(id, user.id, { status: "failed" });
        return res.status(502).json({ error: message });
      }
    } catch (error) {
      console.error("Failed to retry voice clone:", error);
      res.status(500).json({ error: "Failed to retry voice clone" });
    }
  };
}
