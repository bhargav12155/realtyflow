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
  it("invalidates the board query when a board_asset_status frame for an unknown asset arrives so a collaborator's new tile appears without a refresh", async () => {
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
    // After invalidation, the next fetch returns the board with the new tile
    // included — that's what the user should see on the canvas.
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
              positionX: 50,
              positionY: 75,
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
          positionX: 50,
          positionY: 75,
        },
      ],
    };

    const { qc, getFetchCount } = renderAt(
      "/boards/board-1",
      initialBoard,
      refetchedBoard,
    );
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
        },
      });
    });

    // The page should have triggered a refetch, and the refetched board
    // contains the brand-new tile from the collaborator.
    await waitFor(() => {
      expect(getFetchCount()).toBeGreaterThan(fetchesBefore);
    });
    await waitFor(() => {
      const after = qc.getQueryData<BoardResponseLite>([
        "/api/boards",
        "board-1",
      ]);
      expect(after!.batches[0].assets.some((a) => a.id === "asset-new")).toBe(
        true,
      );
      expect(after!.assets.some((a) => a.id === "asset-new")).toBe(true);
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
