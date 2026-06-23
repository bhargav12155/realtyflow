import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BoardCanvas, type CanvasAsset, type CanvasBatch } from "../BoardCanvas";

interface PointerCaptureCapableElement {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
}

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as PointerCaptureCapableElement;
  if (!proto.setPointerCapture) {
    proto.setPointerCapture = () => {};
  }
  if (!proto.releasePointerCapture) {
    proto.releasePointerCapture = () => {};
  }
});

afterEach(() => cleanup());

function makeAsset(overrides: Partial<CanvasAsset> & { id: string; kind: string }): CanvasAsset {
  return {
    assetUrl: null,
    thumbnailUrl: null,
    durationSeconds: null,
    status: "ready",
    rejectionReason: null,
    content: null,
    ...overrides,
  };
}

function makeBatch(kind: string, id = "asset-1"): CanvasBatch {
  return {
    batchId: `batch-${id}`,
    batchLabel: "Batch",
    assets: [
      makeAsset({
        id,
        kind,
        assetUrl: kind === "drawing" ? null : "https://example.com/a.mp3",
        content:
          kind === "drawing"
            ? JSON.stringify({ width: 200, height: 150, strokes: [] })
            : null,
      }),
    ],
  };
}

function renderCanvas(
  batch: CanvasBatch,
  opts: {
    selected?: Set<string>;
    onResizeAsset?: (id: string, w: number, h: number) => void;
  } = {},
) {
  return render(
    <BoardCanvas
      batches={[batch]}
      selectedAssetIds={opts.selected ?? new Set()}
      onSelectAsset={() => {}}
      onDeleteAsset={() => {}}
      onClearRejection={() => {}}
      onResizeAsset={opts.onResizeAsset}
    />,
  );
}

function dragHandle(handle: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: dx, clientY: dy, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientX: dx, clientY: dy, pointerId: 1 });
}

describe("BoardCanvas resize handle", () => {
  it("calls onResizeAsset with start size + drag delta after a non-clamping drag (drawing)", () => {
    const onResizeAsset = vi.fn();
    renderCanvas(makeBatch("drawing"), {
      selected: new Set(["asset-1"]),
      onResizeAsset,
    });
    const handle = screen.getByTestId("handle-resize-asset-1");
    // Drawing default size is 360x240; +50,+40 stays within 160-800 / 80-600 bounds.
    dragHandle(handle, 50, 40);
    expect(onResizeAsset).toHaveBeenCalledTimes(1);
    expect(onResizeAsset).toHaveBeenCalledWith("asset-1", 410, 280);
  });

  it("calls onResizeAsset with start size + drag delta after a non-clamping drag (audio)", () => {
    const onResizeAsset = vi.fn();
    renderCanvas(makeBatch("audio", "asset-aud"), {
      selected: new Set(["asset-aud"]),
      onResizeAsset,
    });
    const handle = screen.getByTestId("handle-resize-asset-aud");
    // Audio default size is 320x90; +30,+25 stays within bounds.
    dragHandle(handle, 30, 25);
    expect(onResizeAsset).toHaveBeenCalledTimes(1);
    expect(onResizeAsset).toHaveBeenCalledWith("asset-aud", 350, 115);
  });

  it("honours the asset's persisted width/height as the drag start size", () => {
    const onResizeAsset = vi.fn();
    const batch: CanvasBatch = {
      batchId: "batch-stored",
      batchLabel: "Batch",
      assets: [
        makeAsset({
          id: "asset-stored",
          kind: "drawing",
          content: JSON.stringify({ width: 200, height: 150, strokes: [] }),
          width: 250,
          height: 180,
        }),
      ],
    };
    renderCanvas(batch, {
      selected: new Set(["asset-stored"]),
      onResizeAsset,
    });
    const handle = screen.getByTestId("handle-resize-asset-stored");
    dragHandle(handle, 20, 30);
    expect(onResizeAsset).toHaveBeenCalledWith("asset-stored", 270, 210);
  });

  it("clamps the reported size to the min bounds when dragged far past them", () => {
    const onResizeAsset = vi.fn();
    renderCanvas(makeBatch("audio", "asset-mini"), {
      selected: new Set(["asset-mini"]),
      onResizeAsset,
    });
    const handle = screen.getByTestId("handle-resize-asset-mini");
    dragHandle(handle, -5000, -5000);
    expect(onResizeAsset).toHaveBeenCalledTimes(1);
    const [, w, h] = onResizeAsset.mock.calls[0];
    expect(w).toBe(160);
    expect(h).toBe(80);
  });

  it("clamps the reported size to the max bounds when dragged far past them", () => {
    const onResizeAsset = vi.fn();
    renderCanvas(makeBatch("audio", "asset-big"), {
      selected: new Set(["asset-big"]),
      onResizeAsset,
    });
    const handle = screen.getByTestId("handle-resize-asset-big");
    dragHandle(handle, 5000, 5000);
    expect(onResizeAsset).toHaveBeenCalledTimes(1);
    const [, w, h] = onResizeAsset.mock.calls[0];
    expect(w).toBe(800);
    expect(h).toBe(600);
  });

  it("does not fire onResizeAsset when pointer-up happens without any movement", () => {
    const onResizeAsset = vi.fn();
    renderCanvas(makeBatch("drawing", "asset-still"), {
      selected: new Set(["asset-still"]),
      onResizeAsset,
    });
    const handle = screen.getByTestId("handle-resize-asset-still");
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(onResizeAsset).not.toHaveBeenCalled();
  });

  it("does not render the resize handle when no onResizeAsset callback is wired up", () => {
    for (const kind of ["drawing", "audio", "image", "video", "sticky", "text", "frame"]) {
      const id = `asset-${kind}-no-cb`;
      const { unmount } = renderCanvas(makeBatch(kind, id), {
        selected: new Set([id]),
        // intentionally omit onResizeAsset
      });
      expect(screen.queryByTestId(`handle-resize-${id}`)).toBeNull();
      unmount();
    }
  });

  it("does not render the resize handle when the asset is not selected", () => {
    renderCanvas(makeBatch("drawing", "asset-unsel"), {
      selected: new Set(),
      onResizeAsset: () => {},
    });
    expect(screen.queryByTestId("handle-resize-asset-unsel")).toBeNull();
  });
});
