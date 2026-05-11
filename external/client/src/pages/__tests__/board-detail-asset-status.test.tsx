import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();
let capturedOnMessage: ((msg: { type: string; data: unknown }) => void) | null =
  null;
let activeQueryClient: QueryClient | null = null;

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeQueryClient?.invalidateQueries(...(args as [any])),
    setQueryData: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeQueryClient?.setQueryData(...(args as [any, any])),
    getQueryData: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeQueryClient?.getQueryData(...(args as [any])),
  },
  getQueryFn: () => async () => null,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com", name: "Tester" },
    isAuthenticated: true,
  }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: ({
    onMessage,
  }: {
    onMessage?: (msg: { type: string; data: unknown }) => void;
  }) => {
    if (onMessage) capturedOnMessage = onMessage;
    return { isConnected: false, lastMessage: null };
  },
}));
vi.mock("@/hooks/useBoardsTheme", () => ({
  useBoardsTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));
vi.mock("@/components/boards/BoardCanvas", () => ({
  BoardCanvas: () => null,
}));
vi.mock("@/components/boards/AssetToolbar", () => ({
  AssetToolbar: () => null,
}));
vi.mock("@/components/boards/ShareBoardDialog", () => ({
  ShareBoardDialog: () => null,
}));
vi.mock("@/components/boards/ChatPanel", () => ({
  ChatPanel: () => null,
}));

import BoardDetailPage from "@/pages/board-detail";

beforeEach(() => {
  apiRequestMock.mockReset();
  capturedOnMessage = null;
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());

interface BoardResponseLite {
  id: string;
  title: string;
  isShared: boolean;
  isOwner: boolean;
  batches: Array<{
    batchId: string;
    batchLabel: string | null;
    assets: Array<{
      id: string;
      kind: string;
      content?: string | null;
      status: string;
      assetUrl?: string | null;
      thumbnailUrl?: string | null;
      positionX?: number;
      positionY?: number;
    }>;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    content?: string | null;
    status: string;
    assetUrl?: string | null;
    thumbnailUrl?: string | null;
    positionX?: number;
    positionY?: number;
  }>;
}

function renderAt(
  path: string,
  initialBoard: BoardResponseLite,
  refetchedBoard?: BoardResponseLite,
) {
  let fetchCount = 0;
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base, id] = queryKey as [string, string];
          if (base === "/api/boards" && id === initialBoard.id) {
            fetchCount += 1;
            if (fetchCount === 1) return initialBoard;
            return refetchedBoard ?? initialBoard;
          }
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  activeQueryClient = qc;
  window.history.replaceState({}, "", path);
  const pathOnly = path.split("?")[0];
  const { hook } = memoryLocation({ path: pathOnly, record: true });
  const utils = render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, qc, getFetchCount: () => fetchCount };
}

describe("BoardDetailPage WS board_asset_status handler", () => {
  it("splices a brand-new collaborator tile into the cache from the fullAsset payload — no full board refetch (Task #244)", async () => {
    const initialBoard: BoardResponseLite = {
      id: "board-1",
      title: "B",
      isShared: true,
      isOwner: false,
      batches: [
        {
          batchId: "batch-1",
          batchLabel: null,
          assets: [
            { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
          ],
        },
      ],
      assets: [
        { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
      ],
    };

    const { qc, getFetchCount } = renderAt("/boards/board-1", initialBoard);
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-1"])).toBeTruthy();
    });
    const fetchesBefore = getFetchCount();

    act(() => {
      capturedOnMessage!({
        type: "board_asset_status",
        data: {
          boardId: "board-1",
          batchId: "batch-1",
          assetId: "asset-new",
          status: "ready",
          assetUrl: "https://example.com/new.png",
          thumbnailUrl: null,
          // Server-side `pushAssetStatus` now forwards the entire asset
          // row so the client can render the tile immediately.
          fullAsset: {
            id: "asset-new",
            kind: "image",
            status: "ready",
            assetUrl: "https://example.com/new.png",
            thumbnailUrl: null,
            positionX: 50,
            positionY: 75,
            width: 256,
            height: 256,
            batchId: "batch-1",
            batchLabel: null,
            content: null,
          },
        },
      });
    });

    // The new tile should appear in cache *without* triggering a refetch.
    const after = qc.getQueryData<BoardResponseLite>(["/api/boards", "board-1"]);
    expect(after!.batches[0].assets.some((a) => a.id === "asset-new")).toBe(true);
    expect(after!.assets.some((a) => a.id === "asset-new")).toBe(true);
    const newTile = after!.batches[0].assets.find((a) => a.id === "asset-new")!;
    expect(newTile.assetUrl).toBe("https://example.com/new.png");
    expect(newTile.positionX).toBe(50);
    expect(newTile.positionY).toBe(75);
    expect(getFetchCount()).toBe(fetchesBefore);
  });

  it("creates a new batch entry when fullAsset belongs to a batch we haven't seen yet", async () => {
    const initialBoard: BoardResponseLite = {
      id: "board-1b",
      title: "B",
      isShared: true,
      isOwner: false,
      batches: [
        {
          batchId: "batch-1",
          batchLabel: null,
          assets: [
            { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
          ],
        },
      ],
      assets: [
        { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
      ],
    };

    const { qc, getFetchCount } = renderAt("/boards/board-1b", initialBoard);
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-1b"])).toBeTruthy();
    });
    const fetchesBefore = getFetchCount();

    act(() => {
      capturedOnMessage!({
        type: "board_asset_status",
        data: {
          boardId: "board-1b",
          batchId: "brand-new-batch",
          batchLabel: "Uploaded sticky",
          assetId: "asset-fresh",
          status: "ready",
          fullAsset: {
            id: "asset-fresh",
            kind: "sticky",
            status: "ready",
            content: "hello world",
            positionX: 0,
            positionY: 0,
            width: 200,
            height: 120,
            batchId: "brand-new-batch",
            batchLabel: "Uploaded sticky",
          },
        },
      });
    });

    const after = qc.getQueryData<BoardResponseLite>(["/api/boards", "board-1b"]);
    expect(after!.batches.length).toBe(2);
    const newBatch = after!.batches.find((b) => b.batchId === "brand-new-batch")!;
    expect(newBatch.batchLabel).toBe("Uploaded sticky");
    expect(newBatch.assets.map((a) => a.id)).toEqual(["asset-fresh"]);
    expect(after!.assets.some((a) => a.id === "asset-fresh")).toBe(true);
    expect(getFetchCount()).toBe(fetchesBefore);
  });

  it("falls back to invalidating the board when fullAsset is malformed (missing kind)", async () => {
    const initialBoard: BoardResponseLite = {
      id: "board-1d",
      title: "B",
      isShared: true,
      isOwner: false,
      batches: [
        {
          batchId: "batch-1",
          batchLabel: null,
          assets: [
            { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
          ],
        },
      ],
      assets: [
        { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
      ],
    };
    const refetchedBoard: BoardResponseLite = {
      ...initialBoard,
      batches: [
        {
          ...initialBoard.batches[0],
          assets: [
            ...initialBoard.batches[0].assets,
            { id: "asset-new", kind: "image", status: "ready" },
          ],
        },
      ],
      assets: [
        ...initialBoard.assets,
        { id: "asset-new", kind: "image", status: "ready" },
      ],
    };

    const { qc, getFetchCount } = renderAt(
      "/boards/board-1d",
      initialBoard,
      refetchedBoard,
    );
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-1d"])).toBeTruthy();
    });
    const fetchesBefore = getFetchCount();

    act(() => {
      capturedOnMessage!({
        type: "board_asset_status",
        data: {
          boardId: "board-1d",
          batchId: "batch-1",
          assetId: "asset-new",
          status: "ready",
          // fullAsset is present but missing the required `kind` field —
          // the canvas branches on `kind`, so we'd rather refetch than
          // splice in a tile we can't render.
          fullAsset: {
            id: "asset-new",
            status: "ready",
            assetUrl: "https://example.com/new.png",
          },
        },
      });
    });

    await waitFor(() => {
      expect(getFetchCount()).toBeGreaterThan(fetchesBefore);
    });
  });

  it("falls back to invalidating the board when an unknown asset arrives without a fullAsset payload", async () => {
    const initialBoard: BoardResponseLite = {
      id: "board-1c",
      title: "B",
      isShared: true,
      isOwner: false,
      batches: [
        {
          batchId: "batch-1",
          batchLabel: null,
          assets: [
            { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
          ],
        },
      ],
      assets: [
        { id: "asset-existing", kind: "image", status: "ready", assetUrl: "https://example.com/a.png" },
      ],
    };
    const refetchedBoard: BoardResponseLite = {
      ...initialBoard,
      batches: [
        {
          ...initialBoard.batches[0],
          assets: [
            ...initialBoard.batches[0].assets,
            {
              id: "asset-new",
              kind: "image",
              status: "ready",
              assetUrl: "https://example.com/new.png",
            },
          ],
        },
      ],
      assets: [
        ...initialBoard.assets,
        {
          id: "asset-new",
          kind: "image",
          status: "ready",
          assetUrl: "https://example.com/new.png",
        },
      ],
    };

    const { qc, getFetchCount } = renderAt(
      "/boards/board-1c",
      initialBoard,
      refetchedBoard,
    );
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-1c"])).toBeTruthy();
    });
    const fetchesBefore = getFetchCount();

    act(() => {
      capturedOnMessage!({
        type: "board_asset_status",
        data: {
          boardId: "board-1c",
          batchId: "batch-1",
          assetId: "asset-new",
          status: "ready",
          assetUrl: "https://example.com/new.png",
          // Intentionally no fullAsset — exercise the fallback path.
        },
      });
    });

    await waitFor(() => {
      expect(getFetchCount()).toBeGreaterThan(fetchesBefore);
    });
    await waitFor(() => {
      const after = qc.getQueryData<BoardResponseLite>([
        "/api/boards",
        "board-1c",
      ]);
      expect(after!.batches[0].assets.some((a) => a.id === "asset-new")).toBe(true);
    });
  });

  it("patches in place (no refetch) when a board_asset_status frame for an already-cached asset arrives", async () => {
    const board: BoardResponseLite = {
      id: "board-2",
      title: "B",
      isShared: true,
      isOwner: false,
      batches: [
        {
          batchId: "batch-2",
          batchLabel: null,
          assets: [
            {
              id: "asset-known",
              kind: "video",
              status: "generating",
              assetUrl: null,
              thumbnailUrl: null,
            },
          ],
        },
      ],
      assets: [
        {
          id: "asset-known",
          kind: "video",
          status: "generating",
          assetUrl: null,
          thumbnailUrl: null,
        },
      ],
    };
    const { qc, getFetchCount } = renderAt("/boards/board-2", board);
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-2"])).toBeTruthy();
    });
    const fetchesBefore = getFetchCount();

    act(() => {
      capturedOnMessage!({
        type: "board_asset_status",
        data: {
          boardId: "board-2",
          batchId: "batch-2",
          assetId: "asset-known",
          status: "ready",
          assetUrl: "https://example.com/v.mp4",
          thumbnailUrl: "https://example.com/v.jpg",
        },
      });
    });

    const after = qc.getQueryData<BoardResponseLite>([
      "/api/boards",
      "board-2",
    ]);
    expect(after!.batches[0].assets[0].status).toBe("ready");
    expect(after!.batches[0].assets[0].assetUrl).toBe("https://example.com/v.mp4");
    expect(after!.assets[0].status).toBe("ready");
    // No extra refetch — the patch path handled the known asset in-place.
    expect(getFetchCount()).toBe(fetchesBefore);
  });

  it("ignores board_asset_status for a different board (does not refetch ours)", async () => {
    const board: BoardResponseLite = {
      id: "board-3",
      title: "B",
      isShared: false,
      isOwner: true,
      batches: [
        {
          batchId: "batch-3",
          batchLabel: null,
          assets: [{ id: "asset-3", kind: "sticky", status: "ready" }],
        },
      ],
      assets: [{ id: "asset-3", kind: "sticky", status: "ready" }],
    };
    const { qc, getFetchCount } = renderAt("/boards/board-3", board);
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-3"])).toBeTruthy();
    });
    const fetchesBefore = getFetchCount();

    act(() => {
      capturedOnMessage!({
        type: "board_asset_status",
        data: {
          boardId: "some-other-board",
          batchId: "batch-other",
          assetId: "asset-other",
          status: "ready",
        },
      });
    });

    expect(getFetchCount()).toBe(fetchesBefore);
  });
});
