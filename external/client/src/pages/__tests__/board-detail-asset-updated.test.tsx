import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();
let capturedOnMessage: ((msg: { type: string; data: unknown }) => void) | null =
  null;
// Holder so the mocked `queryClient` in `@/lib/queryClient` (which the page
// imports directly) delegates to the real QueryClient created per-test.
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
      positionX?: number;
      positionY?: number;
    }>;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    content?: string | null;
    status: string;
    positionX?: number;
    positionY?: number;
  }>;
}

function renderAt(path: string, board: BoardResponseLite) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base, id] = queryKey as [string, string];
          if (base === "/api/boards" && id === board.id) return board;
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
  return { ...utils, qc };
}

describe("BoardDetailPage WS board_asset_updated handler", () => {
  it("patches the cached asset's content when a board_asset_updated message arrives", async () => {
    const board: BoardResponseLite = {
      id: "board-1",
      title: "B",
      isShared: false,
      isOwner: true,
      batches: [
        {
          batchId: "batch-1",
          batchLabel: null,
          assets: [
            { id: "asset-1", kind: "sticky", content: "Before", status: "ready" },
            { id: "asset-2", kind: "sticky", content: "Untouched", status: "ready" },
          ],
        },
      ],
      assets: [
        { id: "asset-1", kind: "sticky", content: "Before", status: "ready" },
        { id: "asset-2", kind: "sticky", content: "Untouched", status: "ready" },
      ],
    };
    const { qc } = renderAt("/boards/board-1", board);
    // Wait until the page registers its WS onMessage handler.
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    // Wait until the query cache has the board so setQueryData has a baseline
    // to mutate.
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-1"])).toBeTruthy();
    });

    // Simulate the WS broadcast for the matching board.
    act(() => {
      capturedOnMessage!({
        type: "board_asset_updated",
        data: {
          boardId: "board-1",
          batchId: "batch-1",
          assetId: "asset-1",
          content: "After WS",
        },
      });
    });

    const patched = qc.getQueryData<BoardResponseLite>(["/api/boards", "board-1"]);
    expect(patched).toBeTruthy();
    expect(patched!.batches[0].assets[0].content).toBe("After WS");
    // Untouched sibling stays the same.
    expect(patched!.batches[0].assets[1].content).toBe("Untouched");
    // Top-level assets array also patched.
    expect(patched!.assets[0].content).toBe("After WS");
    expect(patched!.assets[1].content).toBe("Untouched");
  });

  it("ignores board_asset_updated messages addressed to a different board", async () => {
    const board: BoardResponseLite = {
      id: "board-x",
      title: "B",
      isShared: false,
      isOwner: true,
      batches: [
        {
          batchId: "batch-x",
          batchLabel: null,
          assets: [{ id: "asset-x", kind: "sticky", content: "Original", status: "ready" }],
        },
      ],
      assets: [{ id: "asset-x", kind: "sticky", content: "Original", status: "ready" }],
    };
    const { qc } = renderAt("/boards/board-x", board);
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-x"])).toBeTruthy();
    });

    act(() => {
      capturedOnMessage!({
        type: "board_asset_updated",
        data: {
          boardId: "some-other-board",
          batchId: "batch-x",
          assetId: "asset-x",
          content: "Should NOT apply",
        },
      });
    });

    const after = qc.getQueryData<BoardResponseLite>(["/api/boards", "board-x"]);
    expect(after!.batches[0].assets[0].content).toBe("Original");
    expect(after!.assets[0].content).toBe("Original");
  });

  it("patches the cached asset's positionX/Y when a board_asset_updated message includes a drag", async () => {
    const board: BoardResponseLite = {
      id: "board-1",
      title: "B",
      isShared: false,
      isOwner: true,
      batches: [
        {
          batchId: "batch-1",
          batchLabel: null,
          assets: [
            {
              id: "asset-1",
              kind: "image",
              status: "ready",
              positionX: 0,
              positionY: 0,
            },
          ],
        },
      ],
      assets: [
        {
          id: "asset-1",
          kind: "image",
          status: "ready",
          positionX: 0,
          positionY: 0,
        },
      ],
    };
    const { qc } = renderAt("/boards/board-1", board);
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });
    await waitFor(() => {
      expect(qc.getQueryData(["/api/boards", "board-1"])).toBeTruthy();
    });

    act(() => {
      capturedOnMessage!({
        type: "board_asset_updated",
        data: {
          boardId: "board-1",
          batchId: "batch-1",
          assetId: "asset-1",
          positionX: 120,
          positionY: -45,
        },
      });
    });

    const patched = qc.getQueryData<BoardResponseLite>([
      "/api/boards",
      "board-1",
    ]);
    expect(patched!.batches[0].assets[0].positionX).toBe(120);
    expect(patched!.batches[0].assets[0].positionY).toBe(-45);
    expect(patched!.assets[0].positionX).toBe(120);
    expect(patched!.assets[0].positionY).toBe(-45);
  });
});
