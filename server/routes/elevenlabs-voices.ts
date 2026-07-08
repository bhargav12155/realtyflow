import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import type { IStorage } from "../storage";
import type { CustomVoice, BoardAsset } from "@shared/schema";
import type { CloneVoiceResult, TextToSpeechResult } from "../services/elevenlabs";
import { z } from "zod";

// ---------------------------------------------------------------------------
// ElevenLabs Instant Voice Cloning (board "Clone my voice" flow)
// ---------------------------------------------------------------------------

export interface ElevenLabsCloneDeps {
  storage: Pick<IStorage, "createCustomVoice" | "updateCustomVoice">;
  /** Uploads the raw sample to durable storage and returns its URL. */
  uploadSampleAudio: (
    userId: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ) => Promise<string>;
  cloneFn: (input: {
    name: string;
    audioBuffer: Buffer;
    mimeType?: string;
  }) => Promise<CloneVoiceResult>;
  isConfigured: () => boolean;
  onCloneComplete?: (params: { userId: string; voice: CustomVoice }) => void;
  onCloneFailed?: (params: {
    userId: string;
    voiceId: string;
    voiceName: string;
    error: string;
  }) => void;
}

/**
 * POST /api/elevenlabs/voice-clone — multipart {audio, name}.
 *
 * Mirrors the HeyGen custom-voice lifecycle: persist the row as
 * status="cloning" + provider="elevenlabs", respond 202 immediately, run the
 * ElevenLabs Instant Voice Clone in the background, then flip the row to
 * "ready" (with elevenlabsVoiceId) or "failed" and notify over WebSocket.
 */
export function createElevenLabsCloneHandler(deps: ElevenLabsCloneDeps) {
  return async function elevenLabsCloneHandler(req: Request, res: Response) {
    try {
      const user = (req as Request & { user: { id: string } }).user;
      const file = (req as Request & { file?: Express.Multer.File }).file;
      const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";

      if (!deps.isConfigured()) {
        return res.status(400).json({
          error:
            "Voice cloning isn't available right now — ElevenLabs isn't configured.",
        });
      }
      if (!file || !file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      if (!rawName) {
        return res.status(400).json({ error: "Voice name is required" });
      }
      if (rawName.length > 100) {
        return res
          .status(400)
          .json({ error: "Voice name is too long (max 100 characters)" });
      }

      const mimeType = file.mimetype || "audio/webm";
      const ext = mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mp4") || mimeType.includes("m4a")
          ? "m4a"
          : mimeType.includes("wav")
            ? "wav"
            : mimeType.includes("mpeg") || mimeType.includes("mp3")
              ? "mp3"
              : "webm";

      let audioUrl = "";
      try {
        audioUrl = await deps.uploadSampleAudio(
          String(user.id),
          file.buffer,
          `voice-library/elevenlabs-${randomUUID()}.${ext}`,
          mimeType,
        );
      } catch (uploadErr) {
        console.error("Failed to store voice sample:", uploadErr);
        return res
          .status(500)
          .json({ error: "Failed to store your voice sample. Please try again." });
      }

      const voice = await deps.storage.createCustomVoice({
        userId: user.id,
        name: rawName,
        audioUrl,
        fileSize: file.buffer.length,
        provider: "elevenlabs",
        status: "cloning",
      });

      res.status(202).json(voice);

      void (async () => {
        try {
          const result = await deps.cloneFn({
            name: rawName,
            audioBuffer: file.buffer,
            mimeType,
          });
          if (result.success && result.voiceId) {
            const updated = await deps.storage.updateCustomVoice(voice.id, user.id, {
              status: "ready",
              elevenlabsVoiceId: result.voiceId,
            });
            deps.onCloneComplete?.({
              userId: String(user.id),
              voice: updated ?? {
                ...voice,
                status: "ready",
                elevenlabsVoiceId: result.voiceId,
              },
            });
          } else {
            const message = result.error || "Voice cloning failed";
            await deps.storage.updateCustomVoice(voice.id, user.id, {
              status: "failed",
            });
            deps.onCloneFailed?.({
              userId: String(user.id),
              voiceId: voice.id,
              voiceName: voice.name,
              error: message,
            });
          }
        } catch (cloneErr) {
          const message =
            cloneErr instanceof Error ? cloneErr.message : "Voice cloning failed";
          try {
            await deps.storage.updateCustomVoice(voice.id, user.id, {
              status: "failed",
            });
          } catch {}
          deps.onCloneFailed?.({
            userId: String(user.id),
            voiceId: voice.id,
            voiceName: voice.name,
            error: message,
          });
        }
      })();
    } catch (error) {
      console.error("Failed to clone ElevenLabs voice:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to clone voice" });
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Board voice-over generation (POST /api/boards/:id/speak)
// ---------------------------------------------------------------------------

export const boardSpeakSchema = z.object({
  text: z.string().trim().min(1).max(2500),
  // Either a custom voice row id (elevenlabs clone) or a stock ElevenLabs
  // voice id. The handler resolves custom rows first, then falls back to
  // treating the id as a stock voice.
  voiceId: z.string().trim().min(1).max(200),
  voiceName: z.string().trim().max(100).optional(),
});

export interface BoardSpeakDeps {
  storage: Pick<
    IStorage,
    | "getAccessibleBoardForUser"
    | "getCustomVoiceByIdAndUser"
    | "createBoardAssetForUser"
    | "updateBoardAssetForUser"
  >;
  generateSpeechFn: (
    text: string,
    voiceId: string,
    options?: { uploadToS3?: boolean },
  ) => Promise<TextToSpeechResult>;
  isConfigured: () => boolean;
  resolveRecipients: (boardId: string, actorUserId: string) => Promise<string[]>;
  pushStatus: (
    recipients: string[],
    boardId: string,
    asset: BoardAsset,
    extra?: Record<string, unknown>,
  ) => void;
}

export function createBoardSpeakHandler(deps: BoardSpeakDeps) {
  return async function boardSpeakHandler(req: Request, res: Response) {
    try {
      const user = (req as Request & { user: { id: string } }).user;
      const boardId = req.params.id;

      if (!deps.isConfigured()) {
        return res.status(400).json({
          error:
            "Voice-over isn't available right now — ElevenLabs isn't configured.",
        });
      }

      const parsed = boardSpeakSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Please provide the text to speak and a voice.",
        });
      }
      const { text, voiceId } = parsed.data;

      const board = await deps.storage.getAccessibleBoardForUser(boardId, user.id);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }

      // Resolve the voice: a custom clone row id takes priority; anything
      // else is treated as a stock ElevenLabs voice id.
      let resolvedVoiceId = voiceId;
      let voiceLabel = parsed.data.voiceName ?? null;
      const customVoice = await deps.storage.getCustomVoiceByIdAndUser(
        voiceId,
        user.id,
      );
      if (customVoice) {
        if (
          customVoice.provider !== "elevenlabs" ||
          customVoice.status !== "ready" ||
          !customVoice.elevenlabsVoiceId
        ) {
          return res.status(400).json({
            error:
              customVoice.status === "cloning"
                ? "That voice is still cloning — try again in a moment."
                : "That voice isn't ready for voice-overs. Pick another voice.",
          });
        }
        resolvedVoiceId = customVoice.elevenlabsVoiceId;
        voiceLabel = voiceLabel ?? customVoice.name;
      }

      const batchId = randomUUID();
      const recipients = await deps.resolveRecipients(boardId, user.id);
      const asset = await deps.storage.createBoardAssetForUser(boardId, user.id, {
        batchId,
        batchLabel: voiceLabel ? `Voice-over (${voiceLabel})` : "Voice-over",
        kind: "audio",
        provider: "elevenlabs",
        status: "generating",
        modelLabel: voiceLabel,
        content: text,
        positionX: 0,
        positionY: 0,
        width: 240,
        height: 80,
        assetUrl: null,
        thumbnailUrl: null,
        durationSeconds: null,
        rejectionReason: null,
      });
      if (!asset) {
        return res.status(404).json({ error: "Board not found" });
      }
      deps.pushStatus(recipients, boardId, asset);

      res.status(202).json({ asset });

      void (async () => {
        try {
          const result = await deps.generateSpeechFn(text, resolvedVoiceId, {
            uploadToS3: true,
          });
          if (result.success && result.audioUrl) {
            const updated = await deps.storage.updateBoardAssetForUser(
              boardId,
              asset.id,
              user.id,
              { status: "ready", assetUrl: result.audioUrl },
            );
            deps.pushStatus(recipients, boardId, updated ?? {
              ...asset,
              status: "ready",
              assetUrl: result.audioUrl,
            });
          } else {
            const message = result.error || "Voice-over generation failed";
            const updated = await deps.storage.updateBoardAssetForUser(
              boardId,
              asset.id,
              user.id,
              { status: "failed", rejectionReason: message },
            );
            deps.pushStatus(recipients, boardId, updated ?? {
              ...asset,
              status: "failed",
              rejectionReason: message,
            });
          }
        } catch (genErr) {
          const message =
            genErr instanceof Error ? genErr.message : "Voice-over generation failed";
          try {
            const updated = await deps.storage.updateBoardAssetForUser(
              boardId,
              asset.id,
              user.id,
              { status: "failed", rejectionReason: message },
            );
            deps.pushStatus(recipients, boardId, updated ?? {
              ...asset,
              status: "failed",
              rejectionReason: message,
            });
          } catch (updateErr) {
            console.error("Failed to mark voice-over asset failed:", updateErr);
          }
        }
      })();
    } catch (error) {
      console.error("Failed to generate board voice-over:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate voice-over" });
      }
    }
  };
}
