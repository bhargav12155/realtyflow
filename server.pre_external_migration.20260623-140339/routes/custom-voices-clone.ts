import type { Request, Response } from "express";
import type { IStorage } from "../storage";
import type { HeyGenService } from "../services/heygen";
import type { CustomVoice } from "@shared/schema";

export interface RetryCloneDeps {
  storage: Pick<IStorage, "getCustomVoiceByIdAndUser" | "updateCustomVoice">;
  heygenServiceFactory: () => Pick<HeyGenService, "cloneVoice">;
  onCloneComplete?: (params: {
    userId: string;
    voice: CustomVoice;
  }) => void;
  onCloneFailed?: (params: {
    userId: string;
    voiceId: string;
    voiceName: string;
    error: string;
  }) => void;
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
  const voice = await deps.storage.createCustomVoice({
    userId: input.userId,
    name: input.name,
    audioUrl: input.audioUrl,
    fileSize: input.fileSize,
    language: input.language,
    gender: input.gender,
    status: "cloning",
  });

  const result = await runHeyGenCloneTask({
    voiceId: voice.id,
    userId: input.userId,
    name: input.name,
    audioBuffer: input.audioBuffer,
    audioMimeType: input.audioMimeType,
    language: input.language,
    gender: input.gender,
    storage: deps.storage,
    heygenService: deps.heygenServiceFactory(),
  });

  return { voice: result.voice ?? voice, cloneError: result.cloneError };
}

/**
 * Starts a new voice clone in the "cloning" state and returns immediately
 * with the freshly persisted row plus a promise that resolves when the
 * background HeyGen upload+clone work has finished. Callers are expected
 * to respond to the client right away and then await the promise to
 * broadcast a real-time progress update over WebSocket.
 */
export async function startVoiceClone(
  input: CreateVoiceWithCloneInput,
  deps: CreateVoiceWithCloneDeps,
): Promise<{
  voice: CustomVoice;
  donePromise: Promise<{ voice: CustomVoice; cloneError?: string }>;
}> {
  const voice = await deps.storage.createCustomVoice({
    userId: input.userId,
    name: input.name,
    audioUrl: input.audioUrl,
    fileSize: input.fileSize,
    language: input.language,
    gender: input.gender,
    status: "cloning",
  });

  const donePromise = runHeyGenCloneTask({
    voiceId: voice.id,
    userId: input.userId,
    name: input.name,
    audioBuffer: input.audioBuffer,
    audioMimeType: input.audioMimeType,
    language: input.language,
    gender: input.gender,
    storage: deps.storage,
    heygenService: deps.heygenServiceFactory(),
  }).then((result) => ({
    voice: result.voice ?? voice,
    cloneError: result.cloneError,
  }));

  return { voice, donePromise };
}

interface RunCloneTaskArgs {
  voiceId: string;
  userId: string;
  name: string;
  audioBuffer: Buffer;
  audioMimeType: string;
  language?: string;
  gender?: string;
  storage: Pick<IStorage, "updateCustomVoice">;
  heygenService: Pick<HeyGenService, "uploadAudio" | "cloneVoice">;
}

async function runHeyGenCloneTask(
  args: RunCloneTaskArgs,
): Promise<{ voice: CustomVoice | undefined; cloneError?: string }> {
  let cloneError: string | undefined;
  let heygenAudioAssetId: string | undefined;
  let heygenVoiceId: string | undefined;
  let sampleAudioUrl: string | undefined;
  let nextStatus: "ready" | "failed" = "failed";

  try {
    heygenAudioAssetId = await args.heygenService.uploadAudio(
      args.audioBuffer,
      args.audioMimeType,
    );
    try {
      const cloned = await args.heygenService.cloneVoice({
        audioAssetId: heygenAudioAssetId,
        name: args.name,
        language: args.language,
        gender: args.gender,
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

  const updated = await args.storage.updateCustomVoice(args.voiceId, args.userId, {
    status: nextStatus,
    heygenAudioAssetId: heygenAudioAssetId ?? null,
    heygenVoiceId: heygenVoiceId ?? null,
    sampleAudioUrl: sampleAudioUrl ?? null,
  });

  return { voice: updated, cloneError };
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

      const cloningRow =
        (await deps.storage.updateCustomVoice(id, user.id, { status: "cloning" })) ?? {
          ...voice,
          status: "cloning",
        };

      // Respond immediately with the "cloning" row so the UI can flip its
      // badge right away. Run the HeyGen clone in the background and
      // notify when finished so the UI can flip to "Cloned" / "Clone Failed"
      // without a manual refresh.
      res.status(202).json(cloningRow);

      void (async () => {
        try {
          const heygenService = deps.heygenServiceFactory();
          const cloned = await heygenService.cloneVoice({
            audioAssetId: voice.heygenAudioAssetId!,
            name: voice.name,
            language: voice.language || undefined,
            gender: voice.gender || undefined,
          });
          const updated = await deps.storage.updateCustomVoice(id, user.id, {
            status: "ready",
            heygenVoiceId: cloned.voiceId,
            sampleAudioUrl: cloned.previewAudioUrl ?? voice.sampleAudioUrl ?? null,
          });
          deps.onCloneComplete?.({
            userId: user.id,
            voice: updated ?? { ...cloningRow, status: "ready", heygenVoiceId: cloned.voiceId },
          });
        } catch (cloneErr) {
          const message = cloneErr instanceof Error ? cloneErr.message : "Voice cloning failed";
          await deps.storage.updateCustomVoice(id, user.id, { status: "failed" });
          deps.onCloneFailed?.({
            userId: user.id,
            voiceId: id,
            voiceName: voice.name,
            error: message,
          });
        }
      })();
    } catch (error) {
      console.error("Failed to retry voice clone:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to retry voice clone" });
      }
    }
  };
}
