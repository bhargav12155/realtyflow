import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BoardCanvas, type CanvasBatch } from "../BoardCanvas";
import { GroupAssetToolbar } from "../GroupAssetToolbar";

afterEach(() => cleanup());

function makeBatch(): CanvasBatch {
  return {
    batchId: "batch-1",
    batchLabel: "Batch 1",
    assets: [
      {
        id: "asset-1",
        assetUrl: "https://example.com/a.png",
        thumbnailUrl: null,
        durationSeconds: null,
        status: "ready",
        rejectionReason: null,
        kind: "image",
      },
      {
        id: "asset-2",
        assetUrl: "https://example.com/b.png",
        thumbnailUrl: null,
        durationSeconds: null,
        status: "ready",
        rejectionReason: null,
        kind: "image",
      },
    ],
  };
}

describe("BoardCanvas multi-select", () => {
  it("plain click reports a non-additive selection", () => {
    const onSelect = vi.fn();
    render(
      <BoardCanvas
        batches={[makeBatch()]}
        selectedAssetIds={new Set()}
        onSelectAsset={onSelect}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("asset-asset-1"));
    expect(onSelect).toHaveBeenCalledWith("asset-1", { additive: false });
  });

  it("shift-click marks the selection as additive", () => {
    const onSelect = vi.fn();
    render(
      <BoardCanvas
        batches={[makeBatch()]}
        selectedAssetIds={new Set(["asset-1"])}
        onSelectAsset={onSelect}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("asset-asset-2"), { shiftKey: true });
    expect(onSelect).toHaveBeenCalledWith("asset-2", { additive: true });
  });

  it("Cmd+A asks the parent to select every asset", () => {
    const onSelectAll = vi.fn();
    render(
      <BoardCanvas
        batches={[makeBatch()]}
        selectedAssetIds={new Set()}
        onSelectAsset={() => {}}
        onSelectAll={onSelectAll}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
      />,
    );
    fireEvent.keyDown(window, { key: "a", metaKey: true });
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("Esc clears the current selection", () => {
    const onSelect = vi.fn();
    render(
      <BoardCanvas
        batches={[makeBatch()]}
        selectedAssetIds={new Set(["asset-1", "asset-2"])}
        onSelectAsset={onSelect}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe("GroupAssetToolbar", () => {
  const assets = [
    {
      id: "a1",
      assetUrl: "https://example.com/a.png",
      thumbnailUrl: null,
      durationSeconds: null,
      status: "ready" as const,
      rejectionReason: null,
      kind: "image" as const,
    },
    {
      id: "a2",
      assetUrl: "https://example.com/b.png",
      thumbnailUrl: null,
      durationSeconds: null,
      status: "ready" as const,
      rejectionReason: null,
      kind: "image" as const,
    },
  ];

  it("renders the selected count", () => {
    render(
      <GroupAssetToolbar
        assets={assets}
        onClose={() => {}}
        onReuseInChat={() => {}}
        onBulkDelete={() => {}}
      />,
    );
    expect(screen.getByTestId("text-group-selected-count").textContent).toContain("2 selected");
  });

  it("only fires bulk delete after the user confirms", () => {
    const onBulkDelete = vi.fn();
    render(
      <GroupAssetToolbar
        assets={assets}
        onClose={() => {}}
        onReuseInChat={() => {}}
        onBulkDelete={onBulkDelete}
      />,
    );
    fireEvent.click(screen.getByTestId("toolbar-group-delete"));
    expect(onBulkDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-group-delete-confirm"));
    expect(onBulkDelete).toHaveBeenCalledTimes(1);
  });
});
