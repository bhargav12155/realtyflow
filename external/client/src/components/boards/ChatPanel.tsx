import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, Minus, Paperclip, Mic, ArrowUp, Sparkles, Trash2, Wand2, X, Eye, Film, Square, Settings as SettingsIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PlatformPicker,
  PLATFORMS,
  type ProviderId,
  type GenerationMode,
  type SeedanceOptions,
} from "./PlatformPicker";

export type ChatMode = "brainstorm" | "create";

export type ChatModelId = "claude" | "gemini" | "openai";

export const THINK_MODELS: { id: ChatModelId; name: string }[] = [
  { id: "claude", name: "Claude" },
  { id: "gemini", name: "Gemini" },
  { id: "openai", name: "ChatGPT" },
];

export interface ChatMessageCta {
  label: string;
  href: string;
  testId?: string;
}

export interface ChatMessageAuthor {
  /** Pre-formatted display label (e.g. "Alex" or "alex@example.com"). */
  name: string;
  /** True when this turn was authored by the currently signed-in user. The
   *  panel uses this to skip the "from <name>" tag on the user's own
   *  bubbles and to align them on the right. */
  isSelf: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  cta?: ChatMessageCta;
  /** Only meaningful on shared boards. When omitted (or when the panel
   *  hasn't been told the board has collaborators) no author tag renders,
   *  which preserves the existing single-user look on private boards. */
  author?: ChatMessageAuthor;
}

/**
 * A thumbnail chip rendered above the chat input. The previewUrl should be a
 * still image (image asset URL or video thumbnail) so the chip is always
 * visually meaningful even for video assets.
 */
export interface ReferencedAssetChip {
  id: string;
  kind: "image" | "video" | "audio" | string;
  previewUrl: string | null | undefined;
}

/** Cap how many chips we render inline before collapsing into a "+N" badge. */
const MAX_CHIPS_VISIBLE = 3;

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
  chatModel?: ChatModelId;
  onChatModelChange?: (m: ChatModelId) => void;
  referencedAssetIds: string[];
  hasReferencedImage?: boolean;
  /** Per-asset detail used to render thumbnail chips. Optional for callers that
   *  haven't migrated yet — falls back to the legacy "Referencing N" text. */
  referencedAssets?: ReferencedAssetChip[];
  /** Detach a single referenced asset (× on a chip). */
  onRemoveReferencedAsset?: (id: string) => void;
  onSend: (text: string) => void;
  isSending?: boolean;
  /** When provided and isSending is true, a Stop button appears next to the
   *  thinking indicator. Invoking it should abort the in-flight request. */
  onStop?: () => void;
  pendingInput?: string | null;
  onPendingInputApplied?: () => void;
  /** Owner-only: when provided, shows a "Clear chat" trash button in the
   *  panel header that wipes the persisted history after confirmation. */
  onClearChat?: () => void;
  /** Disables the Clear button while the wipe is in flight. */
  isClearingChat?: boolean;
  /** Owner-only: current per-board cap on persisted chat messages. When
   *  defined alongside `onChangeChatHistoryCap`, a settings button appears in
   *  the panel header that lets the owner tune the cap. */
  chatHistoryCap?: number;
  /** Persist a new per-board chat history cap. Disabled while in flight. */
  onChangeChatHistoryCap?: (n: number) => void;
  /** Bounds for the cap input (keep in sync with the server-side schema). */
  chatHistoryCapMin?: number;
  chatHistoryCapMax?: number;
  /** Disables the cap input while a save is in flight. */
  isSavingChatHistoryCap?: boolean;
  /** Display names of other collaborators currently typing. Empty when no one
   *  is typing or when the board has no other viewers. */
  typingUserNames?: string[];
  /** Called as the user types into the chat input so the parent can fan out
   *  a typing beacon over the websocket. The panel debounces internally —
   *  callers should still throttle if they relay every event verbatim. */
  onTypingChange?: (isTyping: boolean) => void;
  /** Called when the user picks or drops files from their device to attach as references. */
  onAttachFiles?: (files: File[]) => void;
  /** Collapse/hide the chat panel from the board layout. */
  onCollapse?: () => void;
}

export const CHAT_HISTORY_CAP_MIN = 10;
export const CHAT_HISTORY_CAP_MAX = 2000;
export const CHAT_HISTORY_CAP_DEFAULT = 200;

const I2V_PROVIDER_CHOICES: Array<{ id: ProviderId; label: string }> = [
  { id: "luma", label: "Luma" },
  { id: "veo", label: "Google VEO" },
];

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
  chatModel = "claude",
  onChatModelChange,
  referencedAssetIds,
  hasReferencedImage,
  referencedAssets,
  onRemoveReferencedAsset,
  onSend,
  isSending,
  onStop,
  pendingInput,
  onPendingInputApplied,
  onClearChat,
  isClearingChat,
  chatHistoryCap,
  onChangeChatHistoryCap,
  chatHistoryCapMin = CHAT_HISTORY_CAP_MIN,
  chatHistoryCapMax = CHAT_HISTORY_CAP_MAX,
  isSavingChatHistoryCap,
  typingUserNames,
  onTypingChange,
  onAttachFiles,
  onCollapse,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const initialCap = chatHistoryCap ?? CHAT_HISTORY_CAP_DEFAULT;
  const [capDraft, setCapDraft] = useState<string>(String(initialCap));
  // Re-sync the draft whenever the persisted value changes (e.g. after a
  // successful save or when navigating between boards) so the input always
  // reflects the source of truth on next open.
  useEffect(() => {
    setCapDraft(String(chatHistoryCap ?? CHAT_HISTORY_CAP_DEFAULT));
  }, [chatHistoryCap]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  // Cap the composer at roughly 7 lines before it starts scrolling internally.
  const CHAT_INPUT_MAX_HEIGHT = 160;
  // Recalculate the textarea height on every value change so it grows with
  // content and shrinks back when the field is cleared (e.g. after send).
  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, CHAT_INPUT_MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY =
      el.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? "auto" : "hidden";
  };
  const sel = PLATFORMS.find((p) => p.id === provider) ?? PLATFORMS[0];
  const isPlan = mode === "brainstorm";
  const isBuild = mode === "create";
  const showI2VProviderToggle = isBuild;
  const selectedThinkModel =
    THINK_MODELS.find((m) => m.id === chatModel) ?? THINK_MODELS[0];
  const thinkingLabel = isPlan
    ? `${selectedThinkModel.name} is thinking…`
    : "Generating…";

  // Track how long the current request has been pending so we can show a
  // gentle reassurance after ~20 s and a stronger "try again" hint at ~60 s.
  // Stages: 0 = normal, 1 = still thinking, 2 = unusually slow.
  const [waitStage, setWaitStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (!isSending) {
      setWaitStage(0);
      return;
    }
    setWaitStage(0);
    const t1 = setTimeout(() => setWaitStage(1), 20000);
    const t2 = setTimeout(() => setWaitStage(2), 60000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSending]);

  // Keep the latest message (and the thinking row, when shown) in view.
  useEffect(() => {
    const el = messagesEndRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "end" });
    }
  }, [messages.length, isSending, waitStage]);

  // Resize the composer whenever its value changes — covers both user typing
  // and programmatic updates (pre-fill, build-this, send-then-clear).
  useEffect(() => {
    resizeInput();
  }, [input]);

  // Apply a parent-provided pre-fill (e.g. the typed idea from the Boards
  // home in Plan mode) once, then clear it so we don't clobber the user's
  // own edits on subsequent renders.
  useEffect(() => {
    if (pendingInput && pendingInput.length > 0) {
      setInput(pendingInput);
      onPendingInputApplied?.();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput]);

  // Whenever the panel enters Plan mode, force the platform picker closed —
  // it's not rendered in Plan mode, and leaving open=true would cause it to
  // re-mount in the wrong state on the next Plan→Build flip. The reverse is
  // also true for the Think model picker on the way back to Build mode.
  useEffect(() => {
    if (isPlan) setPickerOpen(false);
    else setModelPickerOpen(false);
  }, [isPlan]);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !onAttachFiles) return;
    onAttachFiles(Array.from(e.target.files));
    e.target.value = "";
  }, [onAttachFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (!onAttachFiles) return;
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (files.length > 0) onAttachFiles(files);
  }, [onAttachFiles]);

  const submit = () => {
    const text = input.trim();
    if (!text || isSending || isClearingChat) return;
    onSend(text);
    setInput("");
    // Sending implicitly means "stopped typing" — clear the indicator on the
    // recipients' side immediately rather than waiting for the 5s expiry.
    onTypingChange?.(false);
  };

  const handleInputChange = (next: string) => {
    setInput(next);
    if (!onTypingChange) return;
    if (next.length > 0) onTypingChange(true);
    else onTypingChange(false);
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
    <aside
      className="w-[360px] flex-shrink-0 bg-white border-l border-neutral-200 flex flex-col dark:bg-neutral-900 dark:border-neutral-800 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-violet-50/90 dark:bg-violet-950/80 border-2 border-dashed border-violet-400 rounded-none pointer-events-none">
          <Paperclip className="w-8 h-8 text-violet-500 mb-2" />
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Drop to attach</span>
        </div>
      )}
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFilePick}
      />
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-1 font-medium text-[13px] text-neutral-900 truncate dark:text-neutral-100">
          <span className="truncate" data-testid="text-chat-board-title">{boardTitle}</span>
        </div>
        <div className="flex items-center gap-1">
          {onChangeChatHistoryCap && (
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center text-neutral-500 dark:hover:bg-neutral-800 dark:text-neutral-400"
                  data-testid="button-chat-settings"
                  aria-label="Chat history settings"
                  title="Chat history settings"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[260px] p-3">
                <div className="space-y-2">
                  <div>
                    <div
                      className="text-[12px] font-medium text-neutral-800 dark:text-neutral-100"
                      data-testid="text-chat-history-cap-title"
                    >
                      Keep last N messages
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                      Older messages get auto-trimmed. Choose between {chatHistoryCapMin} and {chatHistoryCapMax}.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={chatHistoryCapMin}
                      max={chatHistoryCapMax}
                      value={capDraft}
                      onChange={(e) => setCapDraft(e.target.value)}
                      className="flex-1 text-[13px] rounded-md border border-neutral-200 px-2 py-1 bg-white text-neutral-800 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      data-testid="input-chat-history-cap"
                      disabled={isSavingChatHistoryCap}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = Number.parseInt(capDraft, 10);
                        if (!Number.isFinite(parsed)) return;
                        const clamped = Math.min(
                          chatHistoryCapMax,
                          Math.max(chatHistoryCapMin, parsed),
                        );
                        if (clamped === chatHistoryCap) {
                          setSettingsOpen(false);
                          return;
                        }
                        onChangeChatHistoryCap(clamped);
                        setSettingsOpen(false);
                      }}
                      disabled={isSavingChatHistoryCap}
                      className="text-[12px] px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                      data-testid="button-save-chat-history-cap"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {onClearChat && (
            <button
              type="button"
              onClick={() => {
                if (isClearingChat) return;
                if (messages.length === 0) return;
                onClearChat();
              }}
              disabled={isClearingChat || messages.length === 0}
              className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center text-neutral-500 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-neutral-800 dark:text-neutral-400"
              data-testid="button-clear-chat"
              aria-label="Clear chat history"
              title="Clear chat history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onCollapse?.()}
            className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center text-neutral-500 dark:hover:bg-neutral-800 dark:text-neutral-400"
            data-testid="button-collapse-chat"
            aria-label="Collapse chat"
            title="Collapse chat"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
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
          // Only label user turns by another collaborator. The current
          // user's own bubbles stay clean so the most common case (private
          // board) looks unchanged.
          const showAuthor =
            m.role === "user" && m.author && !m.author.isSelf;
          return (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={m.role === "user" ? "flex flex-col items-end" : ""}>
              {showAuthor && (
                <div
                  className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-0.5 mr-1"
                  data-testid={`text-msg-author-${m.id}`}
                >
                  {m.author!.name}
                </div>
              )}
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
                {m.cta && !m.pending && (
                  <div className="mt-2">
                    <a
                      href={m.cta.href}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium"
                      data-testid={m.cta.testId ?? `button-cta-${m.id}`}
                    >
                      {m.cta.label}
                    </a>
                  </div>
                )}
              </div>
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
        {isSending && (
          <div data-testid="status-chat-thinking" aria-live="polite">
            <div className="text-neutral-700 leading-relaxed dark:text-neutral-300 max-w-[300px] inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce motion-reduce:animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce motion-reduce:animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce motion-reduce:animate-pulse" style={{ animationDelay: "300ms" }} />
              </span>
              <span
                className="text-[12px] text-neutral-500 dark:text-neutral-400 italic"
                data-testid="text-chat-thinking-label"
              >
                {thinkingLabel}
              </span>
              {onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-neutral-200 bg-white text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  data-testid="button-stop-chat"
                  aria-label="Stop reply"
                  title="Stop reply"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  Stop
                </button>
              )}
            </div>
            {waitStage > 0 && (
              <div
                className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 max-w-[300px] leading-snug"
                data-testid={
                  waitStage === 1
                    ? "text-chat-thinking-hint-slow"
                    : "text-chat-thinking-hint-very-slow"
                }
              >
                {waitStage === 1
                  ? "Still thinking — this is taking longer than usual."
                  : "This is unusually slow — you can try again."}
              </div>
            )}
          </div>
        )}
        {typingUserNames && typingUserNames.length > 0 && (
          <div
            className="text-[11px] text-neutral-500 dark:text-neutral-400 italic"
            data-testid="text-collaborator-typing"
            aria-live="polite"
          >
            {typingUserNames.length === 1
              ? `${typingUserNames[0]} is typing…`
              : typingUserNames.length === 2
                ? `${typingUserNames[0]} and ${typingUserNames[1]} are typing…`
                : `${typingUserNames.length} people are typing…`}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {referencedAssetIds.length > 0 && (() => {
        // Prefer the rich chip list when the parent provides it; fall back to
        // the id list so older callers keep rendering at least a count chip.
        const chipSource: ReferencedAssetChip[] =
          referencedAssets && referencedAssets.length > 0
            ? referencedAssets
            : referencedAssetIds.map((id) => ({ id, kind: "image", previewUrl: null }));
        const visible = chipSource.slice(0, MAX_CHIPS_VISIBLE);
        const overflow = chipSource.length - visible.length;
        return (
          <div
            className="px-3 pb-2 flex items-center gap-1.5 flex-wrap"
            data-testid="row-referenced-chips"
          >
            {visible.map((a) => {
              const isVideo = a.kind === "video";
              return (
                <div
                  key={a.id}
                  className="group relative inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
                  data-testid={`chip-referenced-${a.id}`}
                  title={isVideo ? "Video reference (still frame sent to model)" : "Image reference"}
                >
                  <div className="relative w-7 h-7 rounded-md overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex-shrink-0">
                    {a.previewUrl ? (
                      <img
                        src={a.previewUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        data-testid={`img-referenced-${a.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400">
                        <Film className="w-3 h-3" />
                      </div>
                    )}
                    {isPlan && (
                      <span
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-600 text-white flex items-center justify-center"
                        data-testid={`badge-vision-${a.id}`}
                        aria-label="Sent to vision model"
                        title="Sent to the picked vision model"
                      >
                        <Eye className="w-2 h-2" />
                      </span>
                    )}
                  </div>
                  {onRemoveReferencedAsset && (
                    <button
                      type="button"
                      onClick={() => onRemoveReferencedAsset(a.id)}
                      className="w-3.5 h-3.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                      data-testid={`button-remove-referenced-${a.id}`}
                      aria-label="Remove reference"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {overflow > 0 && (
              <span
                className="text-[11px] text-neutral-500 dark:text-neutral-400 px-1"
                data-testid="text-referenced-overflow"
              >
                +{overflow} more
              </span>
            )}
            {!isPlan && sel.kind === "image" && hasReferencedImage && (
              <span
                className="text-[11px] text-violet-600 dark:text-violet-300 ml-1"
                data-testid="text-edit-referenced-image-hint"
              >
                · will edit referenced image
              </span>
            )}
          </div>
        );
      })()}

      <div className="px-3 pb-3">
        <div className="border border-neutral-200 rounded-xl bg-white shadow-sm focus-within:border-neutral-400 focus-within:ring-0 outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:focus-within:border-neutral-500 transition-colors" style={{ outline: "none" }}>
          <div className="flex items-start gap-2 px-3 pt-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-300 via-rose-300 to-violet-400 flex-shrink-0" />
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 border-0 bg-transparent p-0 outline-none shadow-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none text-[13px] leading-5 text-neutral-800 placeholder:text-neutral-400 py-0.5 resize-none overflow-hidden dark:text-neutral-100 dark:placeholder:text-neutral-500 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                background: "transparent",
                border: "none",
                boxShadow: "none",
                outline: "none",
              }}
              placeholder={
                isClearingChat
                  ? "Clearing chat — undo within 10 seconds…"
                  : isPlan
                    ? "Plan it out — ask a question or share an idea…"
                    : "What do you want to build?"
              }
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={isClearingChat}
              data-testid="input-chat"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="inline-flex items-center rounded-full bg-neutral-100 p-0.5 dark:bg-neutral-700"
                data-testid="group-mode-toggle"
              >
                <button
                  type="button"
                  className={`text-[11px] px-2.5 py-0.5 rounded-full transition-colors ${
                    isPlan
                      ? "bg-white text-violet-700 shadow-sm dark:bg-neutral-900 dark:text-violet-300"
                      : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                  onClick={() => onModeChange("brainstorm")}
                  data-testid="button-mode-plan"
                  aria-pressed={isPlan}
                >
                  Think
                </button>
                <button
                  type="button"
                  className={`text-[11px] px-2.5 py-0.5 rounded-full transition-colors ${
                    !isPlan
                      ? "bg-white text-violet-700 shadow-sm dark:bg-neutral-900 dark:text-violet-300"
                      : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                  onClick={() => onModeChange("create")}
                  data-testid="button-mode-build"
                  aria-pressed={!isPlan}
                >
                  Build
                </button>
              </div>
              {isPlan ? (
                <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="flex items-center gap-1 text-[12px] text-neutral-700 hover:bg-neutral-100 rounded-md px-2 py-1 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      data-testid="button-open-think-model-picker"
                    >
                      <Sparkles className="w-3 h-3 text-violet-500" />
                      <span data-testid="text-think-model-name">{selectedThinkModel.name}</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[180px] p-1">
                    <div data-testid="picker-think-model" className="flex flex-col">
                      {THINK_MODELS.map((m) => {
                        const active = m.id === selectedThinkModel.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              onChatModelChange?.(m.id);
                              setModelPickerOpen(false);
                            }}
                            className={`flex items-center justify-between text-[12px] rounded-md px-2 py-1.5 ${
                              active
                                ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
                                : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                            }`}
                            data-testid={`button-think-model-${m.id}`}
                            aria-pressed={active}
                          >
                            <span>{m.name}</span>
                            {active && <Sparkles className="w-3 h-3 text-violet-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
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
              {showI2VProviderToggle && (
                <div className="flex items-center gap-1" data-testid="group-i2v-provider-toggle">
                  {I2V_PROVIDER_CHOICES.map((choice) => {
                    const active = generationMode === "image-to-video" && provider === choice.id;
                    const isVeoDisabled =
                      choice.id === "veo" && !hasReferencedImage;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={isVeoDisabled}
                        onClick={() => {
                          onGenerationModeChange("image-to-video");
                          onProviderChange(choice.id);
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                          active
                            ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200"
                            : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        } ${isVeoDisabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
                        title={
                          isVeoDisabled
                            ? "Select an image on the board to enable Google VEO"
                            : `Use ${choice.label} for image-to-video`
                        }
                        data-testid={`button-i2v-provider-${choice.id}`}
                        aria-pressed={active}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {showI2VProviderToggle && !hasReferencedImage && (
                <span className="text-[10px] text-neutral-400 italic" data-testid="text-i2v-select-image-hint">
                  Select an image on the board to enable Google VEO.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                data-testid="button-attach"
                title="Attach image or video from device"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button className="text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200" data-testid="button-mic"><Mic className="w-3.5 h-3.5" /></button>
              <button
                onClick={submit}
                disabled={isSending || isClearingChat || !input.trim()}
                className="w-6 h-6 rounded-full bg-neutral-200 hover:bg-neutral-300 disabled:opacity-50 flex items-center justify-center dark:bg-neutral-700 dark:hover:bg-neutral-600"
                data-testid="button-send-chat"
              >
                <ArrowUp className="w-3 h-3 text-neutral-700 dark:text-neutral-200" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
