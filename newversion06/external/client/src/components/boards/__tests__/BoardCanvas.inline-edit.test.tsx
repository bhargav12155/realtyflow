import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BoardCanvas, type CanvasAsset, type CanvasBatch } from "../BoardCanvas";

afterEach(() => cleanup());

function makeAsset(overrides: Partial<CanvasAsset> = {}): CanvasAsset {
  return {
    id: "asset-1",
    assetUrl: null,
    thumbnailUrl: null,
    durationSeconds: null,
    status: "ready",
    rejectionReason: null,
    kind: "sticky",
    content: "Original",
    evalHistory: null,
    sourceAssetId: null,
    ...overrides,
  };
}

function renderCanvas(
  asset: CanvasAsset,
  overrides: Partial<React.ComponentProps<typeof BoardCanvas>> = {},
) {
  const onSelectAsset = vi.fn();
  const onDeleteAsset = vi.fn();
  const onClearRejection = vi.fn();
  const onUpdateAssetContent = vi.fn();
  const batches: CanvasBatch[] = [
    { batchId: "batch-1", batchLabel: null, assets: [asset] },
  ];
  const utils = render(
    <BoardCanvas
      batches={batches}
      selectedAssetIds={new Set()}
      onSelectAsset={onSelectAsset}
      onDeleteAsset={onDeleteAsset}
      onClearRejection={onClearRejection}
      onUpdateAssetContent={onUpdateAssetContent}
      {...overrides}
    />,
  );
  return { ...utils, onUpdateAssetContent, onSelectAsset, batches };
}

describe("BoardCanvas inline editor for sticky/text/frame", () => {
  it("double-clicking a sticky tile renders the inline editor", () => {
    const asset = makeAsset({ kind: "sticky", id: "sticky-1", content: "Hi" });
    renderCanvas(asset);
    expect(screen.queryByTestId("input-edit-sticky-sticky-1")).toBeNull();
    fireEvent.doubleClick(screen.getByTestId("asset-sticky-1"));
    const editor = screen.getByTestId("input-edit-sticky-sticky-1");
    expect((editor as HTMLTextAreaElement).value).toBe("Hi");
  });

  it("Enter on a sticky editor commits the change via onUpdateAssetContent", () => {
    const asset = makeAsset({ kind: "sticky", id: "sticky-2", content: "Old" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-sticky-2"));
    const editor = screen.getByTestId("input-edit-sticky-sticky-2");
    fireEvent.change(editor, { target: { value: "New value" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onUpdateAssetContent).toHaveBeenCalledTimes(1);
    expect(onUpdateAssetContent).toHaveBeenCalledWith("sticky-2", "New value");
    // Editor closes on commit
    expect(screen.queryByTestId("input-edit-sticky-sticky-2")).toBeNull();
  });

  it("Shift+Enter on a sticky editor inserts a newline instead of committing", () => {
    const asset = makeAsset({ kind: "sticky", id: "sticky-3", content: "Old" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-sticky-3"));
    const editor = screen.getByTestId("input-edit-sticky-sticky-3");
    fireEvent.change(editor, { target: { value: "Line one" } });
    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    expect(onUpdateAssetContent).not.toHaveBeenCalled();
    expect(screen.getByTestId("input-edit-sticky-sticky-3")).toBeTruthy();
  });

  it("Escape on a sticky editor cancels without saving", () => {
    const asset = makeAsset({ kind: "sticky", id: "sticky-4", content: "Old" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-sticky-4"));
    const editor = screen.getByTestId("input-edit-sticky-sticky-4");
    fireEvent.change(editor, { target: { value: "Discard me" } });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(onUpdateAssetContent).not.toHaveBeenCalled();
    expect(screen.queryByTestId("input-edit-sticky-sticky-4")).toBeNull();
    // Original content still visible
    expect(screen.getByTestId("sticky-content-sticky-4").textContent).toBe("Old");
  });

  it("blurring the sticky editor saves the draft", () => {
    const asset = makeAsset({ kind: "sticky", id: "sticky-5", content: "Old" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-sticky-5"));
    const editor = screen.getByTestId("input-edit-sticky-sticky-5");
    fireEvent.change(editor, { target: { value: "Saved on blur" } });
    fireEvent.blur(editor);
    expect(onUpdateAssetContent).toHaveBeenCalledWith("sticky-5", "Saved on blur");
  });

  it("does not call onUpdateAssetContent when the draft equals the existing content", () => {
    const asset = makeAsset({ kind: "sticky", id: "sticky-6", content: "Same" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-sticky-6"));
    const editor = screen.getByTestId("input-edit-sticky-sticky-6");
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onUpdateAssetContent).not.toHaveBeenCalled();
  });

  it("text tiles open a textarea editor and Enter commits", () => {
    const asset = makeAsset({ kind: "text", id: "text-1", content: "T" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-text-1"));
    const editor = screen.getByTestId("input-edit-text-text-1");
    expect(editor.tagName).toBe("TEXTAREA");
    fireEvent.change(editor, { target: { value: "Updated text" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onUpdateAssetContent).toHaveBeenCalledWith("text-1", "Updated text");
  });

  it("frame labels open a single-line input editor and Enter commits a trimmed single line", () => {
    const asset = makeAsset({ kind: "frame", id: "frame-1", content: "Old label" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-frame-1"));
    const editor = screen.getByTestId("input-edit-frame-frame-1");
    expect(editor.tagName).toBe("INPUT");
    // Frame trims surrounding whitespace before saving.
    fireEvent.change(editor, { target: { value: "  Renamed frame  " } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onUpdateAssetContent).toHaveBeenCalledWith("frame-1", "Renamed frame");
  });

  it("Escape on a text editor cancels without saving", () => {
    const asset = makeAsset({ kind: "text", id: "text-esc", content: "Keep me" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-text-esc"));
    const editor = screen.getByTestId("input-edit-text-text-esc");
    fireEvent.change(editor, { target: { value: "Drop me" } });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(onUpdateAssetContent).not.toHaveBeenCalled();
    expect(screen.queryByTestId("input-edit-text-text-esc")).toBeNull();
    expect(screen.getByTestId("text-content-text-esc").textContent).toBe("Keep me");
  });

  it("blurring a text editor saves the draft", () => {
    const asset = makeAsset({ kind: "text", id: "text-blur", content: "Old" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-text-blur"));
    const editor = screen.getByTestId("input-edit-text-text-blur");
    fireEvent.change(editor, { target: { value: "Saved on blur" } });
    fireEvent.blur(editor);
    expect(onUpdateAssetContent).toHaveBeenCalledWith("text-blur", "Saved on blur");
  });

  it("Escape on a frame label editor cancels without saving", () => {
    const asset = makeAsset({ kind: "frame", id: "frame-esc", content: "Original" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-frame-esc"));
    const editor = screen.getByTestId("input-edit-frame-frame-esc");
    fireEvent.change(editor, { target: { value: "Throw away" } });
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(onUpdateAssetContent).not.toHaveBeenCalled();
    expect(screen.queryByTestId("input-edit-frame-frame-esc")).toBeNull();
    expect(screen.getByTestId("frame-content-frame-esc").textContent).toBe(
      "Original",
    );
  });

  it("blurring a frame label editor saves the draft", () => {
    const asset = makeAsset({ kind: "frame", id: "frame-blur", content: "Old" });
    const { onUpdateAssetContent } = renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-frame-blur"));
    const editor = screen.getByTestId("input-edit-frame-frame-blur");
    fireEvent.change(editor, { target: { value: "Saved on blur" } });
    fireEvent.blur(editor);
    expect(onUpdateAssetContent).toHaveBeenCalledWith("frame-blur", "Saved on blur");
  });

  it("non-editable kinds (e.g. image) ignore double-clicks", () => {
    const asset = makeAsset({
      kind: "image",
      id: "image-1",
      content: null,
      assetUrl: "https://example.com/x.png",
      thumbnailUrl: "https://example.com/x-thumb.png",
    });
    renderCanvas(asset);
    fireEvent.doubleClick(screen.getByTestId("asset-image-1"));
    expect(screen.queryByTestId("input-edit-sticky-image-1")).toBeNull();
    expect(screen.queryByTestId("input-edit-text-image-1")).toBeNull();
    expect(screen.queryByTestId("input-edit-frame-image-1")).toBeNull();
  });

  it("an incoming content update (simulating a board_asset_updated WS payload) refreshes the rendered tile when not editing", () => {
    const asset = makeAsset({ kind: "sticky", id: "sticky-ws", content: "Before WS" });
    const onSelectAsset = vi.fn();
    const onDeleteAsset = vi.fn();
    const onClearRejection = vi.fn();
    const onUpdateAssetContent = vi.fn();
    const initial: CanvasBatch[] = [
      { batchId: "b", batchLabel: null, assets: [asset] },
    ];
    const { rerender } = render(
      <BoardCanvas
        batches={initial}
        selectedAssetIds={new Set()}
        onSelectAsset={onSelectAsset}
        onDeleteAsset={onDeleteAsset}
        onClearRejection={onClearRejection}
        onUpdateAssetContent={onUpdateAssetContent}
      />,
    );
    expect(screen.getByTestId("sticky-content-sticky-ws").textContent).toBe(
      "Before WS",
    );
    // A WS push from another collaborator patches the cached asset; the page
    // re-renders BoardCanvas with the new content.
    const patched: CanvasBatch[] = [
      {
        batchId: "b",
        batchLabel: null,
        assets: [{ ...asset, content: "After WS" }],
      },
    ];
    rerender(
      <BoardCanvas
        batches={patched}
        selectedAssetIds={new Set()}
        onSelectAsset={onSelectAsset}
        onDeleteAsset={onDeleteAsset}
        onClearRejection={onClearRejection}
        onUpdateAssetContent={onUpdateAssetContent}
      />,
    );
    expect(screen.getByTestId("sticky-content-sticky-ws").textContent).toBe(
      "After WS",
    );
  });
});
