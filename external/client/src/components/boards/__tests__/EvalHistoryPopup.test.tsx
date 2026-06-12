import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { BoardCanvas, type CanvasBatch } from "../BoardCanvas";

afterEach(() => cleanup());

const baseAsset = {
  id: "asset-1",
  assetUrl: "https://example.com/a.png",
  thumbnailUrl: null,
  durationSeconds: null,
  status: "ready",
  rejectionReason: null,
  kind: "image",
};

function makeBatch(assetOverrides: Partial<typeof baseAsset> & { evalHistory?: any } = {}): CanvasBatch {
  return {
    batchId: "batch-1",
    batchLabel: "Batch 1",
    assets: [{ ...baseAsset, ...assetOverrides }],
  };
}

function renderCanvas(batches: CanvasBatch[]) {
  return render(
    <BoardCanvas
      batches={batches}
      selectedAssetIds={new Set()}
      onSelectAsset={() => {}}
      onDeleteAsset={() => {}}
      onClearRejection={() => {}}
    />,
  );
}

describe("Asset tile eval history popover", () => {
  it("does not render the history button when there are no eval entries", () => {
    renderCanvas([makeBatch({ evalHistory: [] })]);
    expect(screen.queryByTestId("button-history-asset-1")).toBeNull();
  });

  it("renders the history button when entries exist and toggles the popover open on click", () => {
    const evalHistory = [
      {
        at: "2026-01-01T10:00:00.000Z",
        source: "auto",
        outcome: "winner",
        modelUsed: "gpt-4o",
        reason: "Best composition",
      },
    ];
    renderCanvas([makeBatch({ evalHistory })]);
    const btn = screen.getByTestId("button-history-asset-1");
    expect(screen.queryByTestId("popup-history-asset-1")).toBeNull();
    fireEvent.click(btn);
    const popup = screen.getByTestId("popup-history-asset-1");
    expect(popup).toBeTruthy();
    expect(within(popup).getByText(/winner/i)).toBeTruthy();
    expect(within(popup).getByText(/auto/i)).toBeTruthy();
    expect(within(popup).getByText(/gpt-4o/)).toBeTruthy();
    expect(within(popup).getByText(/Best composition/)).toBeTruthy();
  });

  it("renders entries in chronological order (oldest first) with all required fields", () => {
    const evalHistory = [
      {
        at: "2026-02-02T12:00:00.000Z",
        source: "manual",
        outcome: "promoted",
        reason: "User override",
      },
      {
        at: "2026-01-01T10:00:00.000Z",
        source: "auto",
        outcome: "rejected",
        modelUsed: "claude-3",
        reason: "Out of focus",
      },
    ];
    renderCanvas([makeBatch({ evalHistory })]);
    fireEvent.click(screen.getByTestId("button-history-asset-1"));
    const first = screen.getByTestId("history-entry-asset-1-0");
    const second = screen.getByTestId("history-entry-asset-1-1");
    expect(within(first).getByText(/rejected/i)).toBeTruthy();
    expect(within(first).getByText(/claude-3/)).toBeTruthy();
    expect(within(first).getByText(/Out of focus/)).toBeTruthy();
    expect(within(second).getByText(/promoted/i)).toBeTruthy();
    expect(within(second).getByText(/manual/i)).toBeTruthy();
    expect(within(second).getByText(/User override/)).toBeTruthy();
  });

  it("renders before/after affordance and source link only for assets with a sourceAssetId", () => {
    const sourceAsset = {
      id: "asset-source",
      assetUrl: "https://example.com/source.png",
      thumbnailUrl: null,
      durationSeconds: null,
      status: "ready",
      rejectionReason: null,
      kind: "image",
    };
    const editedAsset = {
      ...baseAsset,
      id: "asset-edited",
      sourceAssetId: "asset-source",
    } as any;
    const batches: CanvasBatch[] = [
      { batchId: "batch-source", batchLabel: "Source", assets: [sourceAsset as any] },
      { batchId: "batch-edit", batchLabel: "Edit", assets: [editedAsset] },
    ];
    renderCanvas(batches);
    expect(screen.getByTestId("button-before-asset-edited")).toBeTruthy();
    expect(screen.getByTestId("link-source-asset-edited")).toBeTruthy();
    // Plain (non-edited) source tile has no before/after UI.
    expect(screen.queryByTestId("button-before-asset-source")).toBeNull();
    expect(screen.queryByTestId("link-source-asset-source")).toBeNull();
  });

  it("popover is rendered outside the clipped tile container so it is fully visible", () => {
    const evalHistory = [
      { at: "2026-01-01T10:00:00.000Z", source: "auto", outcome: "winner", reason: "ok" },
    ];
    renderCanvas([makeBatch({ evalHistory })]);
    fireEvent.click(screen.getByTestId("button-history-asset-1"));
    const tile = screen.getByTestId("asset-asset-1");
    const popup = screen.getByTestId("popup-history-asset-1");
    expect(tile.contains(popup)).toBe(false);
  });
});
