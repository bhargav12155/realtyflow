import { describe, it, expect, vi, afterEach } from "vitest";
import { useEffect, useRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  BoardBottomToolbar,
  type BoardBottomToolbarHandle,
} from "../BoardBottomToolbar";

afterEach(() => cleanup());

function renderToolbar(
  overrides: Partial<React.ComponentProps<typeof BoardBottomToolbar>> = {},
) {
  const onActivateCursor = vi.fn();
  const onPickImage = vi.fn();
  const onPickVideo = vi.fn();
  const onPickMedia = vi.fn();
  const onPickAudio = vi.fn();
  const onCreateSticky = vi.fn();
  const onCreateText = vi.fn();
  const onCreateFrame = vi.fn();
  const onOpenDraw = vi.fn();
  const onOpenRecord = vi.fn();
  const ref = { current: null } as { current: BoardBottomToolbarHandle | null };
  function Wrapper() {
    const localRef = useRef<BoardBottomToolbarHandle>(null);
    useEffect(() => {
      ref.current = localRef.current;
    }, []);
    return (
      <BoardBottomToolbar
        ref={localRef}
        cursorActive
        onActivateCursor={onActivateCursor}
        onPickImage={onPickImage}
        onPickVideo={onPickVideo}
        onPickMedia={onPickMedia}
        onPickAudio={onPickAudio}
        onCreateSticky={onCreateSticky}
        onCreateText={onCreateText}
        onCreateFrame={onCreateFrame}
        onOpenDraw={onOpenDraw}
        onOpenRecord={onOpenRecord}
        {...overrides}
      />
    );
  }
  render(<Wrapper />);
  return {
    onActivateCursor,
    onPickImage,
    onPickVideo,
    onPickMedia,
    onPickAudio,
    onCreateSticky,
    onCreateText,
    onCreateFrame,
    onOpenDraw,
    onOpenRecord,
    ref,
  };
}

const TOOL_TIDS = [
  "toolbar-bottom-cursor",
  "toolbar-bottom-image",
  "toolbar-bottom-video",
  "toolbar-bottom-audio",
  "toolbar-bottom-frame",
  "toolbar-bottom-draw",
  "toolbar-bottom-text",
  "toolbar-bottom-sticky",
  "toolbar-bottom-record",
  "toolbar-bottom-plus",
];

describe("BoardBottomToolbar", () => {
  it("renders all ten tool icons enabled (no more Coming soon placeholders)", () => {
    renderToolbar();
    for (const id of TOOL_TIDS) {
      const btn = screen.getByTestId(id) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute("title")).not.toBe("Coming soon");
    }
  });

  it("clicking the cursor button clears any selection", () => {
    const { onActivateCursor } = renderToolbar();
    fireEvent.click(screen.getByTestId("toolbar-bottom-cursor"));
    expect(onActivateCursor).toHaveBeenCalledTimes(1);
  });

  it("clicking the image button forwards image-only files to onPickImage", () => {
    const { onPickImage, onPickVideo } = renderToolbar();
    const input = screen.getByTestId(
      "input-toolbar-bottom-image",
    ) as HTMLInputElement;
    expect(input.accept).toBe("image/*");
    const file = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPickImage).toHaveBeenCalledTimes(1);
    expect(onPickImage.mock.calls[0][0][0]).toBe(file);
    expect(onPickVideo).not.toHaveBeenCalled();
  });

  it("the video button accept filter is video-only", () => {
    renderToolbar();
    const input = screen.getByTestId(
      "input-toolbar-bottom-video",
    ) as HTMLInputElement;
    expect(input.accept).toBe("video/*");
  });

  it("the audio button forwards audio-only files to onPickAudio", () => {
    const { onPickAudio } = renderToolbar();
    const input = screen.getByTestId(
      "input-toolbar-bottom-audio",
    ) as HTMLInputElement;
    expect(input.accept).toBe("audio/*");
    const file = new File(["x"], "tone.mp3", { type: "audio/mpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPickAudio).toHaveBeenCalledTimes(1);
    expect(onPickAudio.mock.calls[0][0][0]).toBe(file);
  });

  it("plus button picker accepts both images and videos and shows the Ctrl+U hint", () => {
    const { onPickMedia } = renderToolbar();
    const input = screen.getByTestId(
      "input-toolbar-bottom-plus",
    ) as HTMLInputElement;
    expect(input.accept).toBe("image/*,video/*");
    const tipTrigger = screen.getByTestId("toolbar-bottom-plus");
    expect(tipTrigger.getAttribute("title")).toContain("Ctrl+U");
    expect(screen.getByTestId("kbd-toolbar-bottom-plus").textContent).toBe(
      "Ctrl+U",
    );

    const f = new File(["x"], "v.mp4", { type: "video/mp4" });
    fireEvent.change(input, { target: { files: [f] } });
    expect(onPickMedia).toHaveBeenCalledTimes(1);
  });

  it("openMediaPicker handle clicks the same picker as the plus button", () => {
    const { ref, onPickMedia } = renderToolbar();
    const input = screen.getByTestId(
      "input-toolbar-bottom-plus",
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    ref.current?.openMediaPicker();
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const f = new File(["x"], "p.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [f] } });
    expect(onPickMedia).toHaveBeenCalledTimes(1);
  });

  it("clicking sticky/text/frame triggers their create callbacks", () => {
    const { onCreateSticky, onCreateText, onCreateFrame } = renderToolbar();
    fireEvent.click(screen.getByTestId("toolbar-bottom-sticky"));
    fireEvent.click(screen.getByTestId("toolbar-bottom-text"));
    fireEvent.click(screen.getByTestId("toolbar-bottom-frame"));
    expect(onCreateSticky).toHaveBeenCalledTimes(1);
    expect(onCreateText).toHaveBeenCalledTimes(1);
    expect(onCreateFrame).toHaveBeenCalledTimes(1);
  });

  it("clicking draw and record opens their respective tools", () => {
    const { onOpenDraw, onOpenRecord } = renderToolbar();
    fireEvent.click(screen.getByTestId("toolbar-bottom-draw"));
    fireEvent.click(screen.getByTestId("toolbar-bottom-record"));
    expect(onOpenDraw).toHaveBeenCalledTimes(1);
    expect(onOpenRecord).toHaveBeenCalledTimes(1);
  });
});

describe("BoardBottomToolbar Ctrl+U keyboard wiring", () => {
  // The board page registers a window keydown listener that calls
  // openMediaPicker(); this test simulates that wiring and ensures it is
  // suppressed inside text inputs.
  function PageHarness() {
    const ref = useRef<BoardBottomToolbarHandle>(null);
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "u" && e.key !== "U") return;
        if (!(e.ctrlKey || e.metaKey)) return;
        const target = e.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName;
          if (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT" ||
            target.isContentEditable
          ) {
            return;
          }
        }
        e.preventDefault();
        ref.current?.openMediaPicker();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);
    return (
      <div>
        <textarea data-testid="harness-textarea" />
        <BoardBottomToolbar
          ref={ref}
          cursorActive
          onActivateCursor={() => {}}
          onPickImage={() => {}}
          onPickVideo={() => {}}
          onPickMedia={() => {}}
          onPickAudio={() => {}}
          onCreateSticky={() => {}}
          onCreateText={() => {}}
          onCreateFrame={() => {}}
          onOpenDraw={() => {}}
          onOpenRecord={() => {}}
        />
      </div>
    );
  }

  it("Ctrl+U fires the same picker as the plus button", () => {
    render(<PageHarness />);
    const input = screen.getByTestId(
      "input-toolbar-bottom-plus",
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(window, { key: "u", ctrlKey: true });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+U is suppressed while focus is in a textarea", () => {
    render(<PageHarness />);
    const input = screen.getByTestId(
      "input-toolbar-bottom-plus",
    ) as HTMLInputElement;
    const textarea = screen.getByTestId(
      "harness-textarea",
    ) as HTMLTextAreaElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(textarea, { key: "u", ctrlKey: true });
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
