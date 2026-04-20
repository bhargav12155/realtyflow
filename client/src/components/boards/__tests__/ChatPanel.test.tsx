import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { ChatPanel, extractSuggestedPrompt, type ChatMessage } from "../ChatPanel";
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
