import { useState } from "react";
import { ChevronDown, Minus, Paperclip, Mic, ArrowUp, Sparkles, Settings as SettingsIcon } from "lucide-react";
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
  onSend: (text: string) => void;
  isSending?: boolean;
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
  onSend,
  isSending,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const sel = PLATFORMS.find((p) => p.id === provider) ?? PLATFORMS[0];

  const submit = () => {
    const text = input.trim();
    if (!text || isSending) return;
    onSend(text);
    setInput("");
  };

  return (
    <aside className="w-[360px] flex-shrink-0 bg-white border-l border-neutral-200 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-1 font-medium text-[13px] text-neutral-900 truncate">
          <span className="truncate" data-testid="text-chat-board-title">{boardTitle}</span>
        </div>
        <button className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center text-neutral-500" data-testid="button-collapse-chat">
          <Minus className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-3 text-[13px]" data-testid="list-chat-messages">
        {messages.length === 0 && (
          <div className="text-[12px] text-neutral-400 italic">
            Ask a question (Brainstorm) or describe what to make (Create).
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "bg-neutral-100 rounded-2xl rounded-tr-md px-3.5 py-2.5 max-w-[280px] text-neutral-800 leading-relaxed"
                  : "text-neutral-800 leading-relaxed"
              }
              data-testid={`msg-${m.role}-${m.id}`}
            >
              {m.pending ? <span className="text-neutral-400">…</span> : m.content}
            </div>
          </div>
        ))}
      </div>

      {referencedAssetIds.length > 0 && (
        <div className="px-3 pb-2 text-[11px] text-neutral-500" data-testid="text-referenced">
          Referencing {referencedAssetIds.length} asset{referencedAssetIds.length === 1 ? "" : "s"}
        </div>
      )}

      <div className="px-3 pb-3">
        <div className="border border-neutral-200 rounded-2xl bg-white shadow-sm">
          <div className="flex items-start gap-2 px-3 pt-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-300 via-rose-300 to-violet-400 flex-shrink-0" />
            <input
              className="flex-1 bg-transparent outline-none text-[13px] text-neutral-800 placeholder:text-neutral-400 py-0.5"
              placeholder={mode === "brainstorm" ? "Ask anything…" : "What do you want to create?"}
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 text-[12px] text-neutral-700 hover:bg-neutral-100 rounded-md px-2 py-1"
                  data-testid="button-open-platform-picker"
                >
                  <Sparkles className="w-3 h-3 text-violet-500" />
                  <span>{sel.name}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
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
            <div className="flex items-center gap-2">
              <button className="text-neutral-400 hover:text-neutral-700" data-testid="button-attach"><Paperclip className="w-3.5 h-3.5" /></button>
              <button className="text-neutral-400 hover:text-neutral-700" data-testid="button-mic"><Mic className="w-3.5 h-3.5" /></button>
              <button
                onClick={submit}
                disabled={isSending || !input.trim()}
                className="w-6 h-6 rounded-full bg-neutral-200 hover:bg-neutral-300 disabled:opacity-50 flex items-center justify-center"
                data-testid="button-send-chat"
              >
                <ArrowUp className="w-3 h-3 text-neutral-700" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1 mt-2">
          <button
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              mode === "brainstorm" ? "bg-violet-100 text-violet-700" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
            onClick={() => onModeChange("brainstorm")}
            data-testid="button-mode-brainstorm"
          >
            Brainstorm
          </button>
          <button
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              mode === "create" ? "bg-violet-100 text-violet-700" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
            onClick={() => onModeChange("create")}
            data-testid="button-mode-create"
          >
            Create
          </button>
          <span className="text-[10px] text-neutral-400 ml-1">Brainstorm = plan only · Create = execute</span>
        </div>
      </div>
    </aside>
  );
}
