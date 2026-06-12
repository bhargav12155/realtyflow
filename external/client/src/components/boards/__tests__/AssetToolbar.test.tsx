import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AssetToolbar } from "../AssetToolbar";
import type { CanvasAsset } from "../BoardCanvas";

afterEach(() => cleanup());

function makeAsset(overrides: Partial<CanvasAsset> = {}): CanvasAsset {
  return {
    id: "asset-1",
    assetUrl: "https://example.com/after.png",
    thumbnailUrl: "https://example.com/after-thumb.png",
    durationSeconds: null,
    status: "ready",
    rejectionReason: null,
    kind: "image",
    evalHistory: null,
    sourceAssetId: "src-1",
    ...overrides,
  };
}

function makeSource(overrides: Partial<CanvasAsset> = {}): CanvasAsset {
  return {
    id: "src-1",
    assetUrl: "https://example.com/before.png",
    thumbnailUrl: "https://example.com/before-thumb.png",
    durationSeconds: null,
    status: "ready",
    rejectionReason: null,
    kind: "image",
    evalHistory: null,
    sourceAssetId: null,
    ...overrides,
  };
}

function renderToolbar(
  overrides: Partial<React.ComponentProps<typeof AssetToolbar>> = {},
) {
  const onClose = vi.fn();
  const onDelete = vi.fn();
  const onClearRejection = vi.fn();
  const onReuseInChat = vi.fn();
  const props: React.ComponentProps<typeof AssetToolbar> = {
    asset: makeAsset(),
    sourceAsset: makeSource(),
    onClose,
    onDelete,
    onClearRejection,
    onReuseInChat,
    ...overrides,
  };
  const utils = render(<AssetToolbar {...props} />);
  return { ...utils, onClose, onDelete, onClearRejection, onReuseInChat };
}

describe("AssetToolbar before/after compare panel", () => {
  it("renders the comparison panel when an image asset has a source with usable URLs", () => {
    renderToolbar();
    expect(screen.getByTestId("compare-panel-asset-1")).toBeTruthy();
    expect(screen.getByTestId("compare-slider-asset-1")).toBeTruthy();
  });

  it("does not render the comparison panel when there is no sourceAsset", () => {
    renderToolbar({ sourceAsset: null });
    expect(screen.queryByTestId("compare-panel-asset-1")).toBeNull();
  });

  it("does not render the comparison panel when the asset is not an image", () => {
    renderToolbar({ asset: makeAsset({ kind: "video" }) });
    expect(screen.queryByTestId("compare-panel-asset-1")).toBeNull();
  });

  it("does not render the comparison panel when the source has no usable URL", () => {
    renderToolbar({
      sourceAsset: makeSource({ assetUrl: null, thumbnailUrl: null }),
    });
    expect(screen.queryByTestId("compare-panel-asset-1")).toBeNull();
  });

  it("does not render the comparison panel when the asset has no usable URL", () => {
    renderToolbar({
      asset: makeAsset({ assetUrl: null, thumbnailUrl: null, status: "pending" }),
    });
    expect(screen.queryByTestId("compare-panel-asset-1")).toBeNull();
  });

  it("switches between Before, Slider, and After tabs", () => {
    renderToolbar();
    // starts in slider view
    expect(screen.getByTestId("compare-slider-asset-1")).toBeTruthy();

    fireEvent.click(screen.getByTestId("compare-tab-before-asset-1"));
    expect(screen.getByTestId("compare-image-before-asset-1")).toBeTruthy();
    expect(screen.queryByTestId("compare-slider-asset-1")).toBeNull();
    expect(
      screen.getByTestId("compare-tab-before-asset-1").getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.click(screen.getByTestId("compare-tab-after-asset-1"));
    expect(screen.getByTestId("compare-image-after-asset-1")).toBeTruthy();
    expect(screen.queryByTestId("compare-image-before-asset-1")).toBeNull();

    fireEvent.click(screen.getByTestId("compare-tab-slider-asset-1"));
    expect(screen.getByTestId("compare-slider-asset-1")).toBeTruthy();
    expect(screen.queryByTestId("compare-image-after-asset-1")).toBeNull();
  });

  it("updates the slider position via mouse drag", () => {
    renderToolbar();
    const slider = screen.getByTestId("compare-slider-asset-1");
    const handle = screen.getByTestId("compare-handle-asset-1");
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.mouseDown(slider, { clientX: 50 });
    expect(handle.getAttribute("aria-valuenow")).toBe("25");

    fireEvent.mouseMove(window, { clientX: 150 });
    expect(handle.getAttribute("aria-valuenow")).toBe("75");

    fireEvent.mouseUp(window);

    fireEvent.mouseMove(window, { clientX: 20 });
    expect(handle.getAttribute("aria-valuenow")).toBe("75");

    fireEvent.mouseDown(slider, { clientX: 400 });
    expect(handle.getAttribute("aria-valuenow")).toBe("100");

    fireEvent.mouseUp(window);
    fireEvent.mouseDown(slider, { clientX: -50 });
    expect(handle.getAttribute("aria-valuenow")).toBe("0");
    fireEvent.mouseUp(window);
  });

  it("updates the slider position via keyboard ArrowLeft/ArrowRight/Home/End", () => {
    renderToolbar();
    const handle = screen.getByTestId("compare-handle-asset-1");
    expect(handle.getAttribute("aria-valuenow")).toBe("50");

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle.getAttribute("aria-valuenow")).toBe("52");

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle.getAttribute("aria-valuenow")).toBe("48");

    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle.getAttribute("aria-valuenow")).toBe("0");

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(handle.getAttribute("aria-valuenow")).toBe("0");

    fireEvent.keyDown(handle, { key: "End" });
    expect(handle.getAttribute("aria-valuenow")).toBe("100");

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle.getAttribute("aria-valuenow")).toBe("100");
  });
});

describe("AssetToolbar action buttons", () => {
  it("invokes close, delete, and reuse callbacks", () => {
    const { onClose, onDelete, onReuseInChat } = renderToolbar();
    fireEvent.click(screen.getByTestId("toolbar-close"));
    fireEvent.click(screen.getByTestId("toolbar-delete"));
    fireEvent.click(screen.getByTestId("toolbar-reference"));
    fireEvent.click(screen.getByTestId("toolbar-variation"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onReuseInChat).toHaveBeenCalledTimes(2);
  });

  it("copies the asset URL to clipboard", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = (navigator as unknown as { clipboard: unknown }).clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      renderToolbar();
      fireEvent.click(screen.getByTestId("toolbar-copy"));
      expect(writeText).toHaveBeenCalledWith("https://example.com/after.png");
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it("provides a usable download link when the asset is ready", () => {
    renderToolbar();
    const link = screen.getByTestId("toolbar-download") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://example.com/after.png");
  });

  it("disables the download link when the asset is not ready", () => {
    renderToolbar({ asset: makeAsset({ status: "pending" }) });
    const link = screen.getByTestId("toolbar-download");
    expect(link.getAttribute("href")).toBeNull();
    expect(link.className).toContain("pointer-events-none");
  });

  it("shows the clear-rejection button only when the asset is rejected", () => {
    const { rerender, onClearRejection } = renderToolbar();
    expect(screen.queryByTestId("toolbar-clear-rejection")).toBeNull();

    rerender(
      <AssetToolbar
        asset={makeAsset({ status: "rejected" })}
        sourceAsset={makeSource()}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onClearRejection={onClearRejection}
        onReuseInChat={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("toolbar-clear-rejection"));
    expect(onClearRejection).toHaveBeenCalledTimes(1);
  });
});
