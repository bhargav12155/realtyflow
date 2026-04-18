import type { Request, Response } from "express";
import type { IStorage } from "../storage";
import type { HeyGenService } from "../services/heygen";

export interface RetryCloneDeps {
  storage: Pick<IStorage, "getCustomVoiceByIdAndUser" | "updateCustomVoice">;
  heygenServiceFactory: () => Pick<HeyGenService, "cloneVoice">;
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
