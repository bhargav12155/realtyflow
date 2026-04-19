import { useEffect, useRef, useState } from "react";
import { ChevronDown, Minus, Paperclip, Mic, ArrowUp, Sparkles, Wand2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PlatformPicker,
  PLATFORMS,
  type ProviderId,
  type GenerationMode,
  type SeedanceOptions,
} from "./PlatformPicker";

export type ChatMode = "brainstorm" | "create";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

interface ChatPanelProps {
  boardTitle: string;
  messages: ChatMessage[];
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  provider: ProviderId;
  onProviderChange: (p: ProviderId) => void;
  generationMode: GenerationMode;
  onGenerationModeChange: (m: GenerationMode) => void;
  seedanceOptions?: SeedanceOptions;
  onSeedanceOptionsChange?: (opts: SeedanceOptions) => void;
  referencedAssetIds: string[];
  hasReferencedImage?: boolean;
  onSend: (text: string) => void;
  isSending?: boolean;
}

/**
 * Pull a concrete suggested prompt out of an assistant message so the UI can
 * offer a one-click "Build this" handoff in Plan mode. Tries (in order):
 *   1) the first fenced code block ```...```
 *   2) the line after a "Try:", "Prompt:" or "Try this:" label
 *   3) the longest double-quoted span
 * Returns null when no clear candidate is found.
 */
export function extractSuggestedPrompt(content: string): string | null {
  if (!content) return null;
  const fenced = content.match(/```(?:[a-zA-Z]+\n)?([\s\S]+?)```/);
  if (fenced && fenced[1].trim().length > 0) {
    return fenced[1].trim().slice(0, 2000);
  }
  const labelled = content.match(/(?:^|\n)\s*(?:try(?:\s+this)?|prompt)\s*[:—-]\s*(.+?)(?:\n\n|\n\s*[A-Z]|$)/is);
  if (labelled && labelled[1].trim().length > 0) {
    return labelled[1].trim().replace(/^["“]/, "").replace(/["”]$/, "").slice(0, 2000);
  }
  const quoted = [...content.matchAll(/[“"]([^“”"\n]{12,500})[”"]/g)].map((m) => m[1]);
  if (quoted.length > 0) {
    return quoted.sort((a, b) => b.length - a.length)[0].trim();
  }
  return null;
}

export function ChatPanel({
  boardTitle,
  messages,
  mode,
  onModeChange,
  provider,
  onProviderChange,
  generationMode,
  onGenerationModeChange,
  seedanceOptions,
  onSeedanceOptionsChange,
  referencedAssetIds,
  hasReferencedImage,
  onSend,
  isSending,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sel = PLATFORMS.find((p) => p.id === provider) ?? PLATFORMS[0];
  const isPlan = mode === "brainstorm";

  // Whenever the panel enters Plan mode, force the platform picker closed —
  // it's not rendered in Plan mode, and leaving open=true would cause it to
  // re-mount in the wrong state on the next Plan→Build flip.
  useEffect(() => {
    if (isPlan) setPickerOpen(false);
  }, [isPlan]);

  const submit = () => {
    const text = input.trim();
    if (!text || isSending) return;
    onSend(text);
    setInput("");
  };

  const handleBuildThis = (suggested: string) => {
    onModeChange("create");
    setInput(suggested);
    // Focus the input on the next tick so the mode-switch render has flushed.
    // We intentionally do not auto-open the platform picker — the user can
    // tap it if they want to change provider; otherwise the existing default
    // provider is used and they can hit send immediately.
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <aside className="w-[360px] flex-shrink-0 bg-white border-l border-neutral-200 flex flex-col dark:bg-neutral-900 dark:border-neutral-800">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-1 font-medium text-[13px] text-neutral-900 truncate dark:text-neutral-100">
          <span className="truncate" data-testid="text-chat-board-title">{boardTitle}</span>
        </div>
        <button className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center text-neutral-500 dark:hover:bg-neutral-800 dark:text-neutral-400" data-testid="button-collapse-chat">
          <Minus className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-3 text-[13px]" data-testid="list-chat-messages">
        {messages.length === 0 && (
          <div className="text-[12px] text-neutral-400 italic dark:text-neutral-500">
            {isPlan
              ? "Talk through your idea. Ask anything — nothing will be generated until you switch to Build."
              : "Describe what to make. Sending will run the selected provider."}
          </div>
        )}
        {messages.map((m) => {
          const suggested = isPlan && m.role === "assistant" && !m.pending
            ? extractSuggestedPrompt(m.content)
            : null;
          return (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "bg-neutral-100 rounded-2xl rounded-tr-md px-3.5 py-2.5 max-w-[280px] text-neutral-800 leading-relaxed dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-800 leading-relaxed dark:text-neutral-200 max-w-[300px]"
                }
                data-testid={`msg-${m.role}-${m.id}`}
              >
                {m.pending ? (
                  <span className="text-neutral-400 dark:text-neutral-500">…</span>
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
              {suggested && (
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleBuildThis(suggested)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-700 text-[11px] font-medium border border-violet-200 dark:bg-violet-500/15 dark:hover:bg-violet-500/25 dark:text-violet-200 dark:border-violet-500/30"
                    data-testid={`button-build-this-${m.id}`}
                    title="Switch to Build and pre-fill this prompt"
                  >
                    <Wand2 className="w-3 h-3" />
                    Build this
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {referencedAssetIds.length > 0 && (
        <div className="px-3 pb-2 text-[11px] text-neutral-500 dark:text-neutral-400" data-testid="text-referenced">
          Referencing {referencedAssetIds.length} asset{referencedAssetIds.length === 1 ? "" : "s"}
          {!isPlan && sel.kind === "image" && hasReferencedImage && (
            <span className="ml-1 text-violet-600 dark:text-violet-300" data-testid="text-edit-referenced-image-hint">
              · will edit referenced image
            </span>
          )}
        </div>
      )}

      <div className="px-3 pb-3">
        <div className="border border-neutral-200 rounded-2xl bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex items-start gap-2 px-3 pt-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-300 via-rose-300 to-violet-400 flex-shrink-0" />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent outline-none text-[13px] text-neutral-800 placeholder:text-neutral-400 py-0.5 dark:text-neutral-100 dark:placeholder:text-neutral-500"
              placeholder={isPlan ? "Plan it out — ask a question or share an idea…" : "What do you want to build?"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              data-testid="input-chat"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            {isPlan ? (
              <span
                className="flex items-center gap-1 text-[11px] text-neutral-400 italic px-2 py-1 dark:text-neutral-500"
                data-testid="text-plan-mode-hint"
              >
                <Sparkles className="w-3 h-3 text-violet-400" />
                Planning — no generation
              </span>
            ) : (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-1 text-[12px] text-neutral-700 hover:bg-neutral-100 rounded-md px-2 py-1 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    data-testid="button-open-platform-picker"
                  >
                    <Sparkles className="w-3 h-3 text-violet-500" />
                    <span>{sel.name}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[420px] p-0">
                  <PlatformPicker
                    selectedProvider={provider}
                    onSelectProvider={onProviderChange}
                    selectedMode={generationMode}
                    onSelectMode={onGenerationModeChange}
                    seedanceOptions={seedanceOptions}
                    onSeedanceOptionsChange={onSeedanceOptionsChange}
                  />
                </PopoverContent>
              </Popover>
            )}
            <div className="flex items-center gap-2">
              <button className="text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200" data-testid="button-attach"><Paperclip className="w-3.5 h-3.5" /></button>
              <button className="text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200" data-testid="button-mic"><Mic className="w-3.5 h-3.5" /></button>
              <button
                onClick={submit}
                disabled={isSending || !input.trim()}
                className="w-6 h-6 rounded-full bg-neutral-200 hover:bg-neutral-300 disabled:opacity-50 flex items-center justify-center dark:bg-neutral-700 dark:hover:bg-neutral-600"
                data-testid="button-send-chat"
              >
                <ArrowUp className="w-3 h-3 text-neutral-700 dark:text-neutral-200" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1 mt-2">
          <button
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              isPlan
                ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
            onClick={() => onModeChange("brainstorm")}
            data-testid="button-mode-plan"
          >
            Plan
          </button>
          <button
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              !isPlan
                ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
            onClick={() => onModeChange("create")}
            data-testid="button-mode-build"
          >
            Build
          </button>
          <span className="text-[10px] text-neutral-400 ml-1 dark:text-neutral-500">Plan = talk it through · Build = generate</span>
        </div>
      </div>
    </aside>
  );
}
