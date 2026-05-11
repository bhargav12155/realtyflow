import { useEffect, useRef, useState } from "react";
import { Circle, Square } from "lucide-react";

interface RecordModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: (file: File) => void;
}

export function RecordModal({ open, onCancel, onSave }: RecordModalProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      stopAll();
      setRecording(false);
      setElapsed(0);
      setPreviewUrl(null);
      setError(null);
      blobRef.current = null;
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

  const start = async () => {
    setError(null);
    setPreviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
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
      tickRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Couldn't access the microphone.");
    }
  };

  const stop = () => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
    setRecording(false);
  };

  const save = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const ext = blob.type.includes("ogg")
      ? "ogg"
      : blob.type.includes("mp4")
        ? "m4a"
        : "webm";
    const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
      type: blob.type || "audio/webm",
    });
    onSave(file);
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
      aria-label="Record a voice note"
    >
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-[400px] max-w-full p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
            Record a voice note
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
              onClick={stop}
              className="w-14 h-14 rounded-full bg-neutral-800 hover:bg-neutral-900 text-white flex items-center justify-center shadow"
              data-testid="button-record-stop"
              aria-label="Stop recording"
            >
              <Square className="w-5 h-5" fill="currentColor" />
            </button>
          )}
          <div className="text-[12px] tabular-nums text-neutral-600 dark:text-neutral-300" data-testid="text-record-elapsed">
            {formatTime(elapsed)}
          </div>
          {previewUrl && (
            <audio
              src={previewUrl}
              controls
              className="w-full"
              data-testid="audio-record-preview"
            />
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
          <button
            type="button"
            onClick={save}
            disabled={!previewUrl}
            className="px-3 py-1.5 rounded-md text-[12px] bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            data-testid="button-record-save"
          >
            Add to board
          </button>
        </div>
      </div>
    </div>
  );
}
