import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Sparkles } from "lucide-react";
import type { CustomVoice } from "@shared/schema";

interface StockVoice {
  id: string;
  name: string;
  category?: string;
}

interface SpeakModalProps {
  open: boolean;
  defaultText: string;
  onCancel: () => void;
  onSubmit: (params: { text: string; voiceId: string; voiceName: string }) => void;
  isSubmitting?: boolean;
}

/**
 * Board voice-over dialog: pick one of the user's cloned voices (ElevenLabs,
 * status "ready") or a stock ElevenLabs voice, type/adjust the narration
 * text, and generate. The parent fires POST /api/boards/:id/speak.
 */
export function SpeakModal({
  open,
  defaultText,
  onCancel,
  onSubmit,
  isSubmitting,
}: SpeakModalProps) {
  const [text, setText] = useState(defaultText);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(defaultText);
    } else {
      setVoiceId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: stockData, isLoading: stockLoading } = useQuery<{
    configured: boolean;
    voices: StockVoice[];
  }>({
    queryKey: ["/api/elevenlabs/voices"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: customVoices, isLoading: customLoading } = useQuery<CustomVoice[]>({
    queryKey: ["/api/custom-voices"],
    enabled: open,
  });

  if (!open) return null;

  const clonedVoices = (customVoices ?? []).filter(
    (v) => v.provider === "elevenlabs" && v.status === "ready" && v.elevenlabsVoiceId,
  );
  const stockVoices = stockData?.voices ?? [];
  const loading = stockLoading || customLoading;

  const allVoices: { id: string; name: string; cloned: boolean }[] = [
    ...clonedVoices.map((v) => ({ id: v.id, name: v.name, cloned: true })),
    ...stockVoices.map((v) => ({ id: v.id, name: v.name, cloned: false })),
  ];
  const effectiveVoiceId = voiceId ?? allVoices[0]?.id ?? null;
  const selected = allVoices.find((v) => v.id === effectiveVoiceId) ?? null;

  const canSubmit = !!text.trim() && !!selected && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="modal-speak"
      role="dialog"
      aria-label="Generate a voice-over"
    >
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-[440px] max-w-full p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
            <Volume2 className="w-4 h-4 text-violet-500" />
            Generate a voice-over
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
            data-testid="button-speak-close"
          >
            Close
          </button>
        </div>

        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
          What should it say?
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2500}
          rows={4}
          placeholder="Type the narration text…"
          className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 text-[12px] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
          data-testid="input-speak-text"
        />

        <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-3 mb-1">
          Voice
        </label>
        {loading ? (
          <div className="text-[12px] text-neutral-500 dark:text-neutral-400 py-2" data-testid="text-speak-voices-loading">
            Loading voices…
          </div>
        ) : allVoices.length === 0 ? (
          <div className="text-[12px] text-neutral-500 dark:text-neutral-400 py-2" data-testid="text-speak-no-voices">
            No voices available yet.
          </div>
        ) : (
          <div className="max-h-[180px] overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800" data-testid="picker-speak-voice">
            {clonedVoices.length > 0 && (
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-neutral-400 bg-neutral-50 dark:bg-neutral-800/60">
                My voices
              </div>
            )}
            {clonedVoices.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoiceId(v.id)}
                className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 text-[12px] ${
                  effectiveVoiceId === v.id
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
                    : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
                data-testid={`button-speak-voice-${v.id}`}
                aria-pressed={effectiveVoiceId === v.id}
              >
                <span className="truncate">{v.name}</span>
                <Sparkles className="w-3 h-3 shrink-0 text-violet-500" />
              </button>
            ))}
            {stockVoices.length > 0 && (
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-neutral-400 bg-neutral-50 dark:bg-neutral-800/60">
                Stock voices
              </div>
            )}
            {stockVoices.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoiceId(v.id)}
                className={`w-full text-left px-2.5 py-1.5 text-[12px] truncate ${
                  effectiveVoiceId === v.id
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
                    : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
                data-testid={`button-speak-voice-${v.id}`}
                aria-pressed={effectiveVoiceId === v.id}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[12px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            data-testid="button-speak-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              selected &&
              onSubmit({
                text: text.trim(),
                voiceId: selected.id,
                voiceName: selected.name,
              })
            }
            disabled={!canSubmit}
            className="px-3 py-1.5 rounded-md text-[12px] bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            data-testid="button-speak-generate"
          >
            {isSubmitting ? "Generating…" : "Generate voice-over"}
          </button>
        </div>
      </div>
    </div>
  );
}
