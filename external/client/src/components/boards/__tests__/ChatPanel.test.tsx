import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import {
  ChatPanel,
  CHAT_HISTORY_CAP_DEFAULT,
  CHAT_HISTORY_CAP_MAX,
  CHAT_HISTORY_CAP_MIN,
  extractSuggestedPrompt,
  type ChatMessage,
} from "../ChatPanel";
import { DEFAULT_SEEDANCE_OPTIONS } from "../PlatformPicker";

afterEach(() => cleanup());

function renderPanel(overrides: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
  const onModeChange = vi.fn();
  const onProviderChange = vi.fn();
  const onGenerationModeChange = vi.fn();
  const onSend = vi.fn();
  const props: React.ComponentProps<typeof ChatPanel> = {
    boardTitle: "My Board",
    messages: [],
    mode: "create",
    onModeChange,
    provider: "luma",
    onProviderChange,
    generationMode: "text-to-video",
    onGenerationModeChange,
    seedanceOptions: DEFAULT_SEEDANCE_OPTIONS,
    onSeedanceOptionsChange: vi.fn(),
    referencedAssetIds: [],
    onSend,
    ...overrides,
  };
  const utils = render(<ChatPanel {...props} />);
  return { ...utils, onModeChange, onProviderChange, onSend };
}

describe("ChatPanel think/build modes", () => {
  it("renames the mode pills to Think / Build with the new test ids", () => {
    renderPanel();
    expect(screen.getByTestId("button-mode-plan").textContent).toBe("Think");
    expect(screen.getByTestId("button-mode-build").textContent).toBe("Build");
  });

  it("hides the platform picker in Think mode and shows the Think model picker instead", () => {
    renderPanel({ mode: "brainstorm" });
    expect(screen.queryByTestId("button-open-platform-picker")).toBeNull();
    expect(screen.queryByTestId("button-open-think-model-picker")).not.toBeNull();
  });

  it("shows the platform picker in Build mode and hides the Think model picker", () => {
    renderPanel({ mode: "create" });
    expect(screen.queryByTestId("button-open-platform-picker")).not.toBeNull();
    expect(screen.queryByTestId("button-open-think-model-picker")).toBeNull();
  });

  it("clicking the Think pill switches mode to brainstorm; clicking Build switches to create", () => {
    const { onModeChange } = renderPanel({ mode: "create" });
    fireEvent.click(screen.getByTestId("button-mode-plan"));
    expect(onModeChange).toHaveBeenCalledWith("brainstorm");
    fireEvent.click(screen.getByTestId("button-mode-build"));
    expect(onModeChange).toHaveBeenCalledWith("create");
  });

  it("Think model picker shows the active model and can switch between Claude/Gemini/ChatGPT", () => {
    const onChatModelChange = vi.fn();
    renderPanel({ mode: "brainstorm", chatModel: "gemini", onChatModelChange });
    expect(screen.getByTestId("text-think-model-name").textContent).toBe("Gemini");
    fireEvent.click(screen.getByTestId("button-open-think-model-picker"));
    fireEvent.click(screen.getByTestId("button-think-model-openai"));
    expect(onChatModelChange).toHaveBeenCalledWith("openai");
  });

  it('renders a "Build this" button under a Think-mode assistant message that contains a quoted suggestion, and clicking it switches to Build', () => {
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        content: 'Try this prompt: "A cinematic shot of a sunset over the ocean, golden hour"',
      },
    ];
    const { onModeChange } = renderPanel({ mode: "brainstorm", messages });
    const buildBtn = screen.getByTestId("button-build-this-a1");
    expect(buildBtn).not.toBeNull();
    act(() => {
      fireEvent.click(buildBtn);
    });
    expect(onModeChange).toHaveBeenCalledWith("create");
    // The handoff must also pre-fill the chat input with the extracted prompt.
    const chatInput = screen.getByTestId("input-chat") as HTMLInputElement;
    expect(chatInput.value).toBe(
      "A cinematic shot of a sunset over the ocean, golden hour",
    );
  });

  it("does not render Build this in Build mode even with a quoted message", () => {
    const messages: ChatMessage[] = [
      { id: "a1", role: "assistant", content: 'Prompt: "A sunset"' },
    ];
    renderPanel({ mode: "create", messages });
    expect(screen.queryByTestId("button-build-this-a1")).toBeNull();
  });

  it("hides the image-edit hint in Think mode even when a referenced image asset is selected", () => {
    renderPanel({
      mode: "brainstorm",
      provider: "openai-image",
      referencedAssetIds: ["a1"],
      hasReferencedImage: true,
    });
    expect(screen.queryByTestId("text-edit-referenced-image-hint")).toBeNull();
  });
});

describe("ChatPanel referenced-asset chips", () => {
  it("renders a thumbnail chip with × button for each referenced asset, and clicking × calls onRemoveReferencedAsset", () => {
    const onRemoveReferencedAsset = vi.fn();
    renderPanel({
      mode: "brainstorm",
      referencedAssetIds: ["a1"],
      referencedAssets: [{ id: "a1", kind: "image", previewUrl: "https://x/p.jpg" }],
      onRemoveReferencedAsset,
    });
    expect(screen.getByTestId("chip-referenced-a1")).not.toBeNull();
    const img = screen.getByTestId("img-referenced-a1") as HTMLImageElement;
    expect(img.src).toBe("https://x/p.jpg");
    fireEvent.click(screen.getByTestId("button-remove-referenced-a1"));
    expect(onRemoveReferencedAsset).toHaveBeenCalledWith("a1");
  });

  it("shows the eye/vision badge in Think mode and hides it in Build mode", () => {
    const props = {
      referencedAssetIds: ["a1"],
      referencedAssets: [{ id: "a1", kind: "image" as const, previewUrl: "https://x/p.jpg" }],
    };
    const { rerender } = renderPanel({ mode: "brainstorm", ...props });
    expect(screen.queryByTestId("badge-vision-a1")).not.toBeNull();
    rerender(
      <ChatPanel
        boardTitle="My Board"
        messages={[]}
        mode="create"
        onModeChange={vi.fn()}
        provider="luma"
        onProviderChange={vi.fn()}
        generationMode="text-to-video"
        onGenerationModeChange={vi.fn()}
        seedanceOptions={DEFAULT_SEEDANCE_OPTIONS}
        onSeedanceOptionsChange={vi.fn()}
        onSend={vi.fn()}
        {...props}
      />,
    );
    expect(screen.queryByTestId("badge-vision-a1")).toBeNull();
  });

  it("caps the chip row at 3 visible chips and shows a +N more badge", () => {
    const referencedAssetIds = ["a1", "a2", "a3", "a4", "a5"];
    const referencedAssets = referencedAssetIds.map((id) => ({
      id,
      kind: "image" as const,
      previewUrl: `https://x/${id}.jpg`,
    }));
    renderPanel({ mode: "brainstorm", referencedAssetIds, referencedAssets });
    expect(screen.queryByTestId("chip-referenced-a1")).not.toBeNull();
    expect(screen.queryByTestId("chip-referenced-a2")).not.toBeNull();
    expect(screen.queryByTestId("chip-referenced-a3")).not.toBeNull();
    expect(screen.queryByTestId("chip-referenced-a4")).toBeNull();
    expect(screen.getByTestId("text-referenced-overflow").textContent).toContain("+2");
  });

  it("falls back to a placeholder for video chips when previewUrl is missing", () => {
    renderPanel({
      mode: "brainstorm",
      referencedAssetIds: ["v1"],
      referencedAssets: [{ id: "v1", kind: "video", previewUrl: null }],
    });
    expect(screen.queryByTestId("img-referenced-v1")).toBeNull();
    expect(screen.getByTestId("chip-referenced-v1")).not.toBeNull();
  });
});

describe("ChatPanel thinking indicator", () => {
  it("shows the indicator with the active Think model name in Think mode while sending", () => {
    renderPanel({ mode: "brainstorm", chatModel: "gemini", isSending: true });
    expect(screen.getByTestId("status-chat-thinking")).not.toBeNull();
    expect(screen.getByTestId("text-chat-thinking-label").textContent).toBe(
      "Gemini is thinking…",
    );
  });

  it('shows "Generating…" in Build mode while sending', () => {
    renderPanel({ mode: "create", isSending: true });
    expect(screen.getByTestId("status-chat-thinking")).not.toBeNull();
    expect(screen.getByTestId("text-chat-thinking-label").textContent).toBe(
      "Generating…",
    );
  });

  it("does not render the indicator when isSending is false", () => {
    renderPanel({ mode: "brainstorm", isSending: false });
    expect(screen.queryByTestId("status-chat-thinking")).toBeNull();
  });

  it("removes the indicator when isSending flips back to false", () => {
    const baseProps: React.ComponentProps<typeof ChatPanel> = {
      boardTitle: "My Board",
      messages: [],
      mode: "brainstorm",
      onModeChange: vi.fn(),
      provider: "luma",
      onProviderChange: vi.fn(),
      generationMode: "text-to-video",
      onGenerationModeChange: vi.fn(),
      seedanceOptions: DEFAULT_SEEDANCE_OPTIONS,
      onSeedanceOptionsChange: vi.fn(),
      referencedAssetIds: [],
      onSend: vi.fn(),
      isSending: true,
    };
    const { rerender } = render(<ChatPanel {...baseProps} />);
    expect(screen.getByTestId("status-chat-thinking")).not.toBeNull();
    rerender(<ChatPanel {...baseProps} isSending={false} />);
    expect(screen.queryByTestId("status-chat-thinking")).toBeNull();
  });
});

describe("ChatPanel thinking hint escalation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows no soft-warning hint before 20s, escalates at 20s and 60s, and clears them when isSending flips off", () => {
    const baseProps: React.ComponentProps<typeof ChatPanel> = {
      boardTitle: "My Board",
      messages: [],
      mode: "brainstorm",
      onModeChange: vi.fn(),
      provider: "luma",
      onProviderChange: vi.fn(),
      generationMode: "text-to-video",
      onGenerationModeChange: vi.fn(),
      seedanceOptions: DEFAULT_SEEDANCE_OPTIONS,
      onSeedanceOptionsChange: vi.fn(),
      referencedAssetIds: [],
      onSend: vi.fn(),
      isSending: true,
    };
    const { rerender } = render(<ChatPanel {...baseProps} />);

    // Before 20s: no hint visible.
    expect(screen.queryByTestId("text-chat-thinking-hint-slow")).toBeNull();
    expect(screen.queryByTestId("text-chat-thinking-hint-very-slow")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(19_999);
    });
    expect(screen.queryByTestId("text-chat-thinking-hint-slow")).toBeNull();
    expect(screen.queryByTestId("text-chat-thinking-hint-very-slow")).toBeNull();

    // At 20s: the gentle "still thinking" hint appears.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    const slow = screen.getByTestId("text-chat-thinking-hint-slow");
    expect(slow.textContent).toBe(
      "Still thinking — this is taking longer than usual.",
    );
    expect(screen.queryByTestId("text-chat-thinking-hint-very-slow")).toBeNull();

    // At 60s: the stronger "unusually slow" hint replaces it.
    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    expect(screen.queryByTestId("text-chat-thinking-hint-slow")).toBeNull();
    const verySlow = screen.getByTestId("text-chat-thinking-hint-very-slow");
    expect(verySlow.textContent).toBe(
      "This is unusually slow — you can try again.",
    );

    // When isSending flips to false, all hints (and the indicator) disappear.
    rerender(<ChatPanel {...baseProps} isSending={false} />);
    expect(screen.queryByTestId("status-chat-thinking")).toBeNull();
    expect(screen.queryByTestId("text-chat-thinking-hint-slow")).toBeNull();
    expect(screen.queryByTestId("text-chat-thinking-hint-very-slow")).toBeNull();
  });
});

describe("ChatPanel stop button", () => {
  it("renders the Stop button next to the thinking indicator while sending in Think mode", () => {
    const onStop = vi.fn();
    renderPanel({ mode: "brainstorm", isSending: true, onStop });
    expect(screen.getByTestId("status-chat-thinking")).not.toBeNull();
    expect(screen.getByTestId("button-stop-chat")).not.toBeNull();
  });

  it("renders the Stop button next to the thinking indicator while sending in Build mode", () => {
    const onStop = vi.fn();
    renderPanel({ mode: "create", isSending: true, onStop });
    expect(screen.getByTestId("status-chat-thinking")).not.toBeNull();
    expect(screen.getByTestId("button-stop-chat")).not.toBeNull();
  });

  it("does not render the Stop button when not sending, even if onStop is provided", () => {
    renderPanel({ mode: "brainstorm", isSending: false, onStop: vi.fn() });
    expect(screen.queryByTestId("button-stop-chat")).toBeNull();
  });

  it("does not render the Stop button when onStop is omitted, even while sending", () => {
    renderPanel({ mode: "create", isSending: true });
    expect(screen.getByTestId("status-chat-thinking")).not.toBeNull();
    expect(screen.queryByTestId("button-stop-chat")).toBeNull();
  });

  it("removes the Stop button once the reply settles (isSending flips back to false)", () => {
    const onStop = vi.fn();
    const baseProps: React.ComponentProps<typeof ChatPanel> = {
      boardTitle: "My Board",
      messages: [],
      mode: "brainstorm",
      onModeChange: vi.fn(),
      provider: "luma",
      onProviderChange: vi.fn(),
      generationMode: "text-to-video",
      onGenerationModeChange: vi.fn(),
      seedanceOptions: DEFAULT_SEEDANCE_OPTIONS,
      onSeedanceOptionsChange: vi.fn(),
      referencedAssetIds: [],
      onSend: vi.fn(),
      isSending: true,
      onStop,
    };
    const { rerender } = render(<ChatPanel {...baseProps} />);
    expect(screen.getByTestId("button-stop-chat")).not.toBeNull();
    rerender(<ChatPanel {...baseProps} isSending={false} />);
    expect(screen.queryByTestId("button-stop-chat")).toBeNull();
  });

  it("invokes onStop when the Stop button is clicked", () => {
    const onStop = vi.fn();
    renderPanel({ mode: "create", isSending: true, onStop });
    fireEvent.click(screen.getByTestId("button-stop-chat"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe("ChatPanel chat history cap (owner-only settings)", () => {
  it("does not render the gear button when onChangeChatHistoryCap is omitted (non-owner)", () => {
    renderPanel({ chatHistoryCap: 200 });
    expect(screen.queryByTestId("button-chat-settings")).toBeNull();
  });

  it("renders the gear button when onChangeChatHistoryCap is provided (owner)", () => {
    renderPanel({
      chatHistoryCap: 200,
      onChangeChatHistoryCap: vi.fn(),
    });
    expect(screen.getByTestId("button-chat-settings")).not.toBeNull();
  });

  it("opens the popover with the input pre-filled to the current cap, and Save invokes onChangeChatHistoryCap with the new value", () => {
    const onChangeChatHistoryCap = vi.fn();
    renderPanel({ chatHistoryCap: 200, onChangeChatHistoryCap });
    fireEvent.click(screen.getByTestId("button-chat-settings"));
    const input = screen.getByTestId("input-chat-history-cap") as HTMLInputElement;
    expect(input.value).toBe("200");
    fireEvent.change(input, { target: { value: "75" } });
    fireEvent.click(screen.getByTestId("button-save-chat-history-cap"));
    expect(onChangeChatHistoryCap).toHaveBeenCalledTimes(1);
    expect(onChangeChatHistoryCap).toHaveBeenCalledWith(75);
  });

  it("clamps an out-of-range value down to the maximum before persisting", () => {
    const onChangeChatHistoryCap = vi.fn();
    renderPanel({ chatHistoryCap: 200, onChangeChatHistoryCap });
    fireEvent.click(screen.getByTestId("button-chat-settings"));
    const input = screen.getByTestId("input-chat-history-cap") as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(CHAT_HISTORY_CAP_MAX + 5000) } });
    fireEvent.click(screen.getByTestId("button-save-chat-history-cap"));
    expect(onChangeChatHistoryCap).toHaveBeenCalledWith(CHAT_HISTORY_CAP_MAX);
  });

  it("clamps an out-of-range value up to the minimum before persisting", () => {
    const onChangeChatHistoryCap = vi.fn();
    renderPanel({ chatHistoryCap: 200, onChangeChatHistoryCap });
    fireEvent.click(screen.getByTestId("button-chat-settings"));
    const input = screen.getByTestId("input-chat-history-cap") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("button-save-chat-history-cap"));
    expect(onChangeChatHistoryCap).toHaveBeenCalledWith(CHAT_HISTORY_CAP_MIN);
  });

  it("does not call onChangeChatHistoryCap when the (clamped) value matches the current cap", () => {
    const onChangeChatHistoryCap = vi.fn();
    renderPanel({ chatHistoryCap: 200, onChangeChatHistoryCap });
    fireEvent.click(screen.getByTestId("button-chat-settings"));
    fireEvent.click(screen.getByTestId("button-save-chat-history-cap"));
    expect(onChangeChatHistoryCap).not.toHaveBeenCalled();
  });

  it("ignores Save when the input is non-numeric", () => {
    const onChangeChatHistoryCap = vi.fn();
    renderPanel({ chatHistoryCap: 200, onChangeChatHistoryCap });
    fireEvent.click(screen.getByTestId("button-chat-settings"));
    const input = screen.getByTestId("input-chat-history-cap") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByTestId("button-save-chat-history-cap"));
    expect(onChangeChatHistoryCap).not.toHaveBeenCalled();
  });

  it("falls back to the default cap when chatHistoryCap is undefined", () => {
    const onChangeChatHistoryCap = vi.fn();
    renderPanel({ onChangeChatHistoryCap });
    fireEvent.click(screen.getByTestId("button-chat-settings"));
    const input = screen.getByTestId("input-chat-history-cap") as HTMLInputElement;
    expect(input.value).toBe(String(CHAT_HISTORY_CAP_DEFAULT));
  });

  it("disables the input and Save button while a save is in flight", () => {
    renderPanel({
      chatHistoryCap: 200,
      onChangeChatHistoryCap: vi.fn(),
      isSavingChatHistoryCap: true,
    });
    fireEvent.click(screen.getByTestId("button-chat-settings"));
    const input = screen.getByTestId("input-chat-history-cap") as HTMLInputElement;
    const save = screen.getByTestId("button-save-chat-history-cap") as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(save.disabled).toBe(true);
  });
});

describe("ChatPanel collaborator typing indicator", () => {
  it("does not render the typing line when typingUserNames is empty or undefined", () => {
    renderPanel();
    expect(screen.queryByTestId("text-collaborator-typing")).toBeNull();
    cleanup();
    renderPanel({ typingUserNames: [] });
    expect(screen.queryByTestId("text-collaborator-typing")).toBeNull();
  });

  it('renders "<name> is typing…" for one collaborator', () => {
    renderPanel({ typingUserNames: ["Casey"] });
    expect(screen.getByTestId("text-collaborator-typing").textContent).toBe(
      "Casey is typing…",
    );
  });

  it('renders "<a> and <b> are typing…" for exactly two collaborators', () => {
    renderPanel({ typingUserNames: ["Casey", "Sam"] });
    expect(screen.getByTestId("text-collaborator-typing").textContent).toBe(
      "Casey and Sam are typing…",
    );
  });

  it("collapses three or more collaborators into a count summary", () => {
    renderPanel({ typingUserNames: ["Casey", "Sam", "Jordan"] });
    expect(screen.getByTestId("text-collaborator-typing").textContent).toBe(
      "3 people are typing…",
    );
  });

  it("fires onTypingChange(true) when text is entered and onTypingChange(false) when cleared", () => {
    const onTypingChange = vi.fn();
    renderPanel({ onTypingChange });
    const input = screen.getByTestId("input-chat") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onTypingChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(input, { target: { value: "" } });
    expect(onTypingChange).toHaveBeenLastCalledWith(false);
  });

  it("clears the typing indicator after sending a message", () => {
    const onTypingChange = vi.fn();
    const onSend = vi.fn();
    renderPanel({ onTypingChange, onSend });
    const input = screen.getByTestId("input-chat") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ping" } });
    expect(onTypingChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("ping");
    expect(onTypingChange).toHaveBeenLastCalledWith(false);
  });
});

describe("extractSuggestedPrompt", () => {
  it("pulls the contents of the first fenced code block", () => {
    expect(extractSuggestedPrompt("Sure!\n```\nA red barn at dawn\n```\nLet me know.")).toBe(
      "A red barn at dawn",
    );
  });

  it('pulls the text after a "Try:" or "Prompt:" label', () => {
    expect(extractSuggestedPrompt('Try: A misty forest at sunrise')).toBe(
      "A misty forest at sunrise",
    );
    expect(extractSuggestedPrompt("Prompt — A misty forest at sunrise")).toBe(
      "A misty forest at sunrise",
    );
  });

  it("falls back to a long double-quoted span when no fence/label is present", () => {
    const out = extractSuggestedPrompt(
      'Some intro. "A cinematic shot of a sunset over the ocean".',
    );
    expect(out).toBe("A cinematic shot of a sunset over the ocean");
  });

  it("returns null when nothing structured is found", () => {
    expect(extractSuggestedPrompt("Just some chat with no concrete prompt.")).toBeNull();
  });
});
