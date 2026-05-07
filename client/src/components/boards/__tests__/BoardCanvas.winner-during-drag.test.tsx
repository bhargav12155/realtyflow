import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BoardCanvas, type CanvasAsset, type CanvasBatch } from "../BoardCanvas";
import { colorHexFor } from "@/lib/presence-colors";

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

function batchWithSingleWinner(): CanvasBatch {
  // pickWinnerId returns the only ready asset when there is exactly one,
  // so this guarantees a1 is the winner without needing eval history.
  return {
    batchId: "batch-winner",
    batchLabel: "Batch winner",
    assets: [makeAsset({ id: "a1", positionX: 0, positionY: 0 })],
  };
}

describe("BoardCanvas winner ring during a remote drag", () => {
  it("keeps the winner badge visible while another collaborator drags the tile", () => {
    const remoteDrags = new Map([
      [
        "a1",
        {
          positionX: 50,
          positionY: 60,
          userId: "user-other",
          name: "Casey",
          email: "casey@example.com",
        },
      ],
    ]);

    render(
      <BoardCanvas
        batches={[batchWithSingleWinner()]}
        selectedAssetIds={new Set()}
        onSelectAsset={() => {}}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
        remoteDrags={remoteDrags}
      />,
    );

    // The amber winner badge in the corner must still be there during the drag.
    expect(screen.getByTestId("badge-winner-a1")).toBeTruthy();
  });

  it("paints the dragger's color on the outside and a thin amber outline inside", () => {
    const otherUserId = "user-other";
    const remoteDrags = new Map([
      [
        "a1",
        {
          positionX: 50,
          positionY: 60,
          userId: otherUserId,
          name: "Casey",
          email: "casey@example.com",
        },
      ],
    ]);

    render(
      <BoardCanvas
        batches={[batchWithSingleWinner()]}
        selectedAssetIds={new Set()}
        onSelectAsset={() => {}}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
        remoteDrags={remoteDrags}
      />,
    );

    const tile = document.querySelector('[data-asset-id="a1"]') as HTMLElement;
    expect(tile).toBeTruthy();

    const shadow = tile.style.boxShadow;
    const expectedHex = colorHexFor(otherUserId);
    // Dragger's per-user color sits on the outside (no inset prefix).
    expect(shadow).toContain(`0 0 0 2px ${expectedHex}`);
    // The amber winner outline is tucked inside via an inset shadow so the
    // two rings can coexist without one hiding the other.
    expect(shadow).toContain("inset 0 0 0 2px #fbbf24");
  });

  it("only paints the per-user ring when the dragged tile is not a winner", () => {
    // Two ready assets without eval history → pickWinnerId picks the first
    // (a1), so a2 is the non-winner we'll have a remote collaborator drag.
    const batch: CanvasBatch = {
      batchId: "batch-2",
      batchLabel: "Batch 2",
      assets: [
        makeAsset({ id: "a1", positionX: 0, positionY: 0 }),
        makeAsset({ id: "a2", positionX: 10, positionY: 20 }),
      ],
    };
    const otherUserId = "user-other";
    const remoteDrags = new Map([
      [
        "a2",
        {
          positionX: 80,
          positionY: 90,
          userId: otherUserId,
          name: "Casey",
          email: "casey@example.com",
        },
      ],
    ]);

    render(
      <BoardCanvas
        batches={[batch]}
        selectedAssetIds={new Set()}
        onSelectAsset={() => {}}
        onDeleteAsset={() => {}}
        onClearRejection={() => {}}
        remoteDrags={remoteDrags}
      />,
    );

    const tile = document.querySelector('[data-asset-id="a2"]') as HTMLElement;
    expect(tile).toBeTruthy();
    const shadow = tile.style.boxShadow;
    const expectedHex = colorHexFor(otherUserId);
    expect(shadow).toContain(`0 0 0 2px ${expectedHex}`);
    expect(shadow).not.toContain("inset");
  });
});
