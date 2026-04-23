import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();
let capturedOnMessage:
  | ((msg: { type: string; data: unknown }) => void)
  | null = null;
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
    user: { id: "owner", email: "owner@example.com", name: "Olivia Owner" },
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
    return { isConnected: false, lastMessage: null, send: () => {} };
  },
}));
vi.mock("@/hooks/useBoardsTheme", () => ({
  useBoardsTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));
vi.mock("@/components/boards/BoardCanvas", () => ({ BoardCanvas: () => null }));
vi.mock("@/components/boards/AssetToolbar", () => ({ AssetToolbar: () => null }));
vi.mock("@/components/boards/ShareBoardDialog", () => ({
  ShareBoardDialog: () => null,
}));
vi.mock("@/components/boards/ChatPanel", () => ({ ChatPanel: () => null }));

import BoardDetailPage from "@/pages/board-detail";

const BOARD_ID = "board-presence";

interface BoardLite {
  id: string;
  title: string;
  isShared: boolean;
  isOwner: boolean;
  batches: never[];
  assets: never[];
}

function renderBoard(): { qc: QueryClient } {
  const board: BoardLite = {
    id: BOARD_ID,
    title: "Shared Board",
    isShared: true,
    isOwner: true,
    batches: [],
    assets: [],
  };
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base, id] = queryKey as [string, string];
          if (base === "/api/boards" && id === BOARD_ID) return board;
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  activeQueryClient = qc;
  window.history.replaceState({}, "", `/boards/${BOARD_ID}`);
  const { hook } = memoryLocation({
    path: `/boards/${BOARD_ID}`,
    record: true,
  });
  render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
  return { qc };
}

beforeEach(() => {
  apiRequestMock.mockReset();
  capturedOnMessage = null;
  activeQueryClient = null;
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());

describe("BoardDetailPage presence popover", () => {
  it("shows the presence avatars trigger and lists viewers from WebSocket presence updates", async () => {
    renderBoard();
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    // Initially no other viewers, so no trigger.
    expect(screen.queryByTestId("button-presence-avatars")).toBeNull();

    // Two collaborators arrive via WS.
    act(() => {
      capturedOnMessage!({
        type: "board_presence",
        data: {
          boardId: BOARD_ID,
          viewers: [
            {
              userId: "owner",
              name: "Olivia Owner",
              email: "owner@example.com",
            },
            {
              userId: "collab-1",
              name: "Carl Collab",
              email: "carl@example.com",
            },
            {
              userId: "collab-2",
              name: "Dana Diaz",
              email: "dana@example.com",
            },
          ],
        },
      });
    });

    // The current user is filtered out, so only the two others appear.
    const trigger = await screen.findByTestId("button-presence-avatars");
    expect(trigger.getAttribute("aria-label")).toMatch(/2 other viewers/i);

    fireEvent.click(trigger);
    expect(screen.getByTestId("text-presence-heading").textContent).toBe(
      "2 people here",
    );
    expect(screen.getByTestId("text-presence-name-collab-1").textContent).toBe(
      "Carl Collab",
    );
    expect(screen.getByTestId("text-presence-email-collab-1").textContent).toBe(
      "carl@example.com",
    );
    expect(screen.getByTestId("text-presence-name-collab-2").textContent).toBe(
      "Dana Diaz",
    );
    // Self should never appear in the popover list.
    expect(screen.queryByTestId("row-presence-viewer-owner")).toBeNull();
  });

  it("ignores presence updates addressed to a different board", async () => {
    renderBoard();
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    act(() => {
      capturedOnMessage!({
        type: "board_presence",
        data: {
          boardId: "some-other-board",
          viewers: [
            {
              userId: "intruder",
              name: "Wrong Board",
              email: "x@example.com",
            },
          ],
        },
      });
    });

    expect(screen.queryByTestId("button-presence-avatars")).toBeNull();
  });

  it("removes a viewer from the open popover when WebSocket reports they left", async () => {
    renderBoard();
    await waitFor(() => {
      expect(capturedOnMessage).not.toBeNull();
    });

    act(() => {
      capturedOnMessage!({
        type: "board_presence",
        data: {
          boardId: BOARD_ID,
          viewers: [
            {
              userId: "collab-1",
              name: "Carl Collab",
              email: "carl@example.com",
            },
            {
              userId: "collab-2",
              name: "Dana Diaz",
              email: "dana@example.com",
            },
          ],
        },
      });
    });

    const trigger = await screen.findByTestId("button-presence-avatars");
    fireEvent.click(trigger);
    expect(screen.getByTestId("text-presence-heading").textContent).toBe(
      "2 people here",
    );
    expect(screen.getByTestId("row-presence-viewer-collab-1")).toBeTruthy();

    // One collaborator leaves — the popover heading and rows update live.
    act(() => {
      capturedOnMessage!({
        type: "board_presence",
        data: {
          boardId: BOARD_ID,
          viewers: [
            {
              userId: "collab-2",
              name: "Dana Diaz",
              email: "dana@example.com",
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("text-presence-heading").textContent).toBe(
        "1 person here",
      );
    });
    expect(screen.queryByTestId("row-presence-viewer-collab-1")).toBeNull();
    expect(screen.getByTestId("row-presence-viewer-collab-2")).toBeTruthy();

    // When the last viewer leaves, the trigger disappears entirely.
    act(() => {
      capturedOnMessage!({
        type: "board_presence",
        data: { boardId: BOARD_ID, viewers: [] },
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId("button-presence-avatars")).toBeNull();
    });
  });
});
