import { useEffect, useRef, useState } from "react";
import { Circle, Square } from "lucide-react";

interface RecordModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: (file: File) => void;
  /**
   * When provided, the modal offers a second "Clone my voice" mode that
   * records a 10–30s sample and hands it (plus a name) to the parent for
   * ElevenLabs Instant Voice Cloning. Absent → plain voice-note modal.
   */
  onClone?: (file: File, name: string) => void;
}

const CLONE_MIN_SECONDS = 10;
const CLONE_MAX_SECONDS = 30;

export function RecordModal({ open, onCancel, onSave, onClone }: RecordModalProps) {
  const [mode, setMode] = useState<"note" | "clone">("note");
  const [voiceName, setVoiceName] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const tickRef = useRef<number | null>(null);
  // Elapsed seconds captured when the recording stopped, so the clone-mode
  // minimum-length check applies to the finished take (not live state).
  const finalElapsedRef = useRef(0);
  const modeRef = useRef<"note" | "clone">("note");
  modeRef.current = mode;

  useEffect(() => {
    if (!open) {
      stopAll();
      setMode("note");
      setVoiceName("");
      setRecording(false);
      setElapsed(0);
      setPreviewUrl(null);
      setError(null);
      blobRef.current = null;
      finalElapsedRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => stopAll(), []);

  function stopAll() {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  if (!open) return null;

  const isClone = mode === "clone" && !!onClone;

  const start = async () => {
    setError(null);
    setPreviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    finalElapsedRef.current = 0;
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Recording is not supported in this browser.");
      }
      if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
        throw new Error("Recording is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          // Clone samples cap at 30s — ElevenLabs Instant Voice Cloning
          // only needs a short, clean sample, so auto-stop for the user.
          if (modeRef.current === "clone" && next >= CLONE_MAX_SECONDS) {
            window.setTimeout(() => stop(next), 0);
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Couldn't access the microphone.");
    }
  };

  const stop = (finalSeconds?: number) => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setElapsed((s) => {
      finalElapsedRef.current = finalSeconds ?? s;
      return finalSeconds ?? s;
    });
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
    setRecording(false);
  };

  const buildFile = (prefix: string) => {
    const blob = blobRef.current;
    if (!blob) return null;
    const ext = blob.type.includes("ogg")
      ? "ogg"
      : blob.type.includes("mp4")
        ? "m4a"
        : "webm";
    return new File([blob], `${prefix}-${Date.now()}.${ext}`, {
      type: blob.type || "audio/webm",
    });
  };

  const save = () => {
    const file = buildFile("voice-note");
    if (!file) return;
    onSave(file);
  };

  const cloneTooShort =
    isClone && !!previewUrl && finalElapsedRef.current < CLONE_MIN_SECONDS;

  const submitClone = () => {
    if (!onClone) return;
    const name = voiceName.trim();
    if (!name) {
      setError("Give your voice a name first.");
      return;
    }
    if (finalElapsedRef.current < CLONE_MIN_SECONDS) {
      setError(`Record at least ${CLONE_MIN_SECONDS} seconds so the clone sounds like you.`);
      return;
    }
    const file = buildFile("voice-clone");
    if (!file) return;
    onClone(file, name);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="modal-record"
      role="dialog"
      aria-label={isClone ? "Clone my voice" : "Record a voice note"}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-[400px] max-w-full p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
            {isClone ? "Clone my voice" : "Record a voice note"}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
            data-testid="button-record-close"
          >
            Close
          </button>
        </div>

        {onClone && (
          <div className="flex items-center gap-1 mb-3 bg-neutral-100 dark:bg-neutral-800 rounded-full p-0.5 w-fit" data-testid="group-record-mode">
            <button
              type="button"
              className={`text-[11px] px-2.5 py-0.5 rounded-full transition-colors ${
                !isClone
                  ? "bg-white text-violet-700 shadow-sm dark:bg-neutral-900 dark:text-violet-300"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
              onClick={() => {
                setMode("note");
                setError(null);
              }}
              disabled={recording}
              data-testid="button-record-mode-note"
              aria-pressed={!isClone}
            >
              Voice note
            </button>
            <button
              type="button"
              className={`text-[11px] px-2.5 py-0.5 rounded-full transition-colors ${
                isClone
                  ? "bg-white text-violet-700 shadow-sm dark:bg-neutral-900 dark:text-violet-300"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
              onClick={() => {
                setMode("clone");
                setError(null);
              }}
              disabled={recording}
              data-testid="button-record-mode-clone"
              aria-pressed={isClone}
            >
              Clone my voice
            </button>
          </div>
        )}

        {isClone && (
          <div className="mb-3">
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              maxLength={100}
              placeholder="Name this voice (e.g. My voice)"
              className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-[12px] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              data-testid="input-clone-voice-name"
            />
            <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400" data-testid="text-clone-hint">
              Read a few sentences naturally for {CLONE_MIN_SECONDS}–{CLONE_MAX_SECONDS} seconds.
              Recording stops automatically at {CLONE_MAX_SECONDS}s.
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 py-4">
          {!recording && !previewUrl && (
            <button
              type="button"
              onClick={start}
              className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow"
              data-testid="button-record-start"
              aria-label="Start recording"
            >
              <Circle className="w-6 h-6" fill="currentColor" />
            </button>
          )}
          {recording && (
            <button
              type="button"
              onClick={() => stop()}
              className="w-14 h-14 rounded-full bg-neutral-800 hover:bg-neutral-900 text-white flex items-center justify-center shadow"
              data-testid="button-record-stop"
              aria-label="Stop recording"
            >
              <Square className="w-5 h-5" fill="currentColor" />
            </button>
          )}
          <div className="text-[12px] tabular-nums text-neutral-600 dark:text-neutral-300" data-testid="text-record-elapsed">
            {formatTime(elapsed)}
            {isClone && recording && (
              <span className="text-neutral-400"> / {formatTime(CLONE_MAX_SECONDS)}</span>
            )}
          </div>
          {previewUrl && (
            <audio
              src={previewUrl}
              controls
              className="w-full"
              data-testid="audio-record-preview"
            />
          )}
          {previewUrl && (
            <button
              type="button"
              onClick={start}
              className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100 underline"
              data-testid="button-record-again"
            >
              Record again
            </button>
          )}
          {cloneTooShort && !error && (
            <div className="text-[11px] text-amber-600 text-center" data-testid="text-clone-too-short">
              That take is under {CLONE_MIN_SECONDS} seconds — record a longer sample for a better clone.
            </div>
          )}
          {error && (
            <div className="text-[11px] text-rose-600 text-center" data-testid="text-record-error">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[12px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            data-testid="button-record-cancel"
          >
            Cancel
          </button>
          {isClone ? (
            <button
              type="button"
              onClick={submitClone}
              disabled={!previewUrl || cloneTooShort || !voiceName.trim()}
              className="px-3 py-1.5 rounded-md text-[12px] bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              data-testid="button-clone-save"
            >
              Clone voice
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={!previewUrl}
              className="px-3 py-1.5 rounded-md text-[12px] bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              data-testid="button-record-save"
            >
              Add to board
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
