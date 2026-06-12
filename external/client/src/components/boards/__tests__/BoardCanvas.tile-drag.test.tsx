import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BoardCanvas, type CanvasAsset, type CanvasBatch } from "../BoardCanvas";

afterEach(() => cleanup());

function makeAsset(overrides: Partial<CanvasAsset> & { id: string }): CanvasAsset {
  return {
    assetUrl: "https://example.com/a.png",
    thumbnailUrl: null,
    durationSeconds: null,
    status: "ready",
    rejectionReason: null,
    kind: "image",
    ...overrides,
  };
}

function makeBatch(): CanvasBatch {
  return {
    batchId: "batch-1",
    batchLabel: "Batch 1",
    assets: [
      makeAsset({ id: "a1", positionX: 0, positionY: 0 }),
      makeAsset({ id: "a2", positionX: 10, positionY: 20 }),
      makeAsset({ id: "a3", positionX: -5, positionY: 5 }),
    ],
  };
}

function renderCanvas(opts: {
  selected?: Set<string>;
  onMoveAssets?: (moves: Array<{ id: string; positionX: number; positionY: number }>) => void;
  onSelectAsset?: (id: string | null, opts?: { additive?: boolean }) => void;
}) {
  return render(
    <BoardCanvas
      batches={[makeBatch()]}
      selectedAssetIds={opts.selected ?? new Set()}
      onSelectAsset={opts.onSelectAsset ?? (() => {})}
      onDeleteAsset={() => {}}
      onClearRejection={() => {}}
      onMoveAssets={opts.onMoveAssets}
    />,
  );
}

function dragTile(testId: string, fromX: number, fromY: number, toX: number, toY: number) {
  const tileBody = screen.getByTestId(testId);
  fireEvent.mouseDown(tileBody, { button: 0, clientX: fromX, clientY: fromY });
  fireEvent.mouseMove(window, { clientX: toX, clientY: toY });
  fireEvent.mouseUp(window, { clientX: toX, clientY: toY });
}

describe("BoardCanvas tile drag", () => {
  it("dragging a single unselected tile moves only that tile", () => {
    const onMoveAssets = vi.fn();
    renderCanvas({ onMoveAssets });
    dragTile("asset-a1", 100, 100, 150, 130);
    expect(onMoveAssets).toHaveBeenCalledTimes(1);
    expect(onMoveAssets).toHaveBeenCalledWith([
      { id: "a1", positionX: 50, positionY: 30 },
    ]);
  });

  it("dragging a selected tile within a multi-selection moves the whole group by the same delta", () => {
    const onMoveAssets = vi.fn();
    renderCanvas({
      selected: new Set(["a1", "a2"]),
      onMoveAssets,
    });
    dragTile("asset-a1", 0, 0, 40, -10);
    expect(onMoveAssets).toHaveBeenCalledTimes(1);
    const [moves] = onMoveAssets.mock.calls[0] as [
      Array<{ id: string; positionX: number; positionY: number }>,
    ];
    const byId = Object.fromEntries(moves.map((m) => [m.id, m]));
    expect(byId.a1).toEqual({ id: "a1", positionX: 40, positionY: -10 });
    // a2 started at (10, 20) — same delta of (40, -10) ⇒ (50, 10)
    expect(byId.a2).toEqual({ id: "a2", positionX: 50, positionY: 10 });
    expect(byId.a3).toBeUndefined();
  });

  it("dragging a non-selected tile while others are selected only moves the dragged tile", () => {
    const onMoveAssets = vi.fn();
    renderCanvas({
      selected: new Set(["a2", "a3"]),
      onMoveAssets,
    });
    dragTile("asset-a1", 0, 0, 25, 25);
    expect(onMoveAssets).toHaveBeenCalledWith([
      { id: "a1", positionX: 25, positionY: 25 },
    ]);
  });

  it("a click without movement does not call onMoveAssets and still selects the tile", () => {
    const onMoveAssets = vi.fn();
    const onSelectAsset = vi.fn();
    renderCanvas({ onMoveAssets, onSelectAsset });
    const tile = screen.getByTestId("asset-a1");
    fireEvent.mouseDown(tile, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseUp(window, { clientX: 0, clientY: 0 });
    fireEvent.click(tile);
    expect(onMoveAssets).not.toHaveBeenCalled();
    expect(onSelectAsset).toHaveBeenCalledWith("a1", { additive: false });
  });

  it("the trailing click after a drag is suppressed so selection is not toggled", () => {
    const onMoveAssets = vi.fn();
    const onSelectAsset = vi.fn();
    renderCanvas({
      selected: new Set(["a1", "a2"]),
      onMoveAssets,
      onSelectAsset,
    });
    const tile = screen.getByTestId("asset-a1");
    fireEvent.mouseDown(tile, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 30, clientY: 30 });
    fireEvent.mouseUp(window, { clientX: 30, clientY: 30 });
    fireEvent.click(tile);
    expect(onMoveAssets).toHaveBeenCalledTimes(1);
    expect(onSelectAsset).not.toHaveBeenCalled();
  });

  it("shift-click does not start a drag (it stays as additive selection)", () => {
    const onMoveAssets = vi.fn();
    const onSelectAsset = vi.fn();
    renderCanvas({ onMoveAssets, onSelectAsset });
    const tile = screen.getByTestId("asset-a1");
    fireEvent.mouseDown(tile, { button: 0, shiftKey: true, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(window, { clientX: 50, clientY: 50 });
    fireEvent.click(tile, { shiftKey: true });
    expect(onMoveAssets).not.toHaveBeenCalled();
    expect(onSelectAsset).toHaveBeenCalledWith("a1", { additive: true });
  });

  it("renders the persisted positionX/Y as a transform on the tile wrapper", () => {
    renderCanvas({});
    const wrapper = screen.getByTestId("asset-a2").parentElement!;
    expect(wrapper.style.transform).toContain("translate(10px, 20px)");
  });

  it("does not start a drag when onMoveAssets is not provided", () => {
    const onSelectAsset = vi.fn();
    render(
      <BoardCanvas
        batches={[makeBatch()]}
        selectedAssetIds={new Set()}
        onSelectAsset={onSelectAsset}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
      />,
    );
    const tile = screen.getByTestId("asset-a1");
    fireEvent.mouseDown(tile, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 30, clientY: 30 });
    fireEvent.mouseUp(window, { clientX: 30, clientY: 30 });
    fireEvent.click(tile);
    // No drag happened, click selects normally.
    expect(onSelectAsset).toHaveBeenCalledWith("a1", { additive: false });
  });
});
