import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const { apiRequestMock, toastMock, sharedQueryClient, setLocationMock } = vi.hoisted(() => {
  const { QueryClient } = require("@tanstack/react-query") as typeof import("@tanstack/react-query");
  return {
    apiRequestMock: vi.fn(),
    toastMock: vi.fn(),
    setLocationMock: vi.fn(),
    sharedQueryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
  };
});

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: sharedQueryClient,
  getQueryFn: () => async () => null,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "viewer" }, isAuthenticated: true }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null, send: vi.fn() }),
}));
vi.mock("@/hooks/useBoardsTheme", () => ({
  useBoardsTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));
vi.mock("@/components/boards/BoardCanvas", () => ({ BoardCanvas: () => null }));
vi.mock("@/components/boards/AssetToolbar", () => ({ AssetToolbar: () => null }));
vi.mock("@/components/boards/GroupAssetToolbar", () => ({
  GroupAssetToolbar: () => null,
}));
vi.mock("@/components/boards/ShareBoardDialog", () => ({
  ShareBoardDialog: () => null,
}));
vi.mock("@/components/boards/DrawingModal", () => ({ DrawingModal: () => null }));
vi.mock("@/components/boards/RecordModal", () => ({ RecordModal: () => null }));
vi.mock("@/components/boards/PresenceAvatars", () => ({
  PresenceAvatars: () => null,
}));
vi.mock("@/components/boards/NotificationsBell", () => ({
  NotificationsBell: () => null,
}));
vi.mock("@/components/boards/BoardBottomToolbar", () => ({
  BoardBottomToolbar: () => null,
}));
vi.mock("@/components/boards/ChatPanel", () => ({
  ChatPanel: () => null,
}));

import BoardDetailPage from "@/pages/board-detail";

const BOARD_ID = "board-leave";

function configureQueryClient() {
  sharedQueryClient.clear();
  sharedQueryClient.setDefaultOptions({
    queries: {
      retry: false,
      queryFn: async ({ queryKey }) => {
        const [base, id, sub] = queryKey as [string, string, string?];
        if (base === "/api/boards" && id && !sub) {
          return {
            id,
            title: "Shared board",
            isShared: true,
            isOwner: false,
            userId: "owner",
            batches: [],
            assets: [],
          };
        }
        if (base === "/api/boards" && id && sub === "messages") {
          return { messages: [] };
        }
        if (base === "/api/boards/chat/health") {
          return { healthy: [], unhealthy: [], default: null };
        }
        return null;
      },
    },
    mutations: { retry: false },
  });
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  setLocationMock.mockReset();
  apiRequestMock.mockImplementation(async () => ({
    json: async () => ({ ok: true }),
  }));
  window.history.replaceState({}, "", "/");
});
afterEach(() => {
  cleanup();
});

function renderBoard() {
  configureQueryClient();
  const path = `/boards/${BOARD_ID}`;
  window.history.replaceState({}, "", path);
  const { hook, history } = memoryLocation({ path, record: true });
  const utils = render(
    <QueryClientProvider client={sharedQueryClient}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, history };
}

function deleteCalls() {
  return apiRequestMock.mock.calls.filter(
    ([method, url]) =>
      method === "DELETE" &&
      typeof url === "string" &&
      url === `/api/boards/${BOARD_ID}/share/me`,
  );
}

describe("BoardDetailPage leave confirmation dialog", () => {
  it("does not render the styled leave dialog by default", async () => {
    renderBoard();
    await screen.findByTestId("button-leave-board");
    expect(screen.queryByTestId("dialog-leave-board")).toBeNull();
  });

  it("does not call window.confirm and opens the styled dialog when Leave is clicked", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    renderBoard();
    const leaveButton = await screen.findByTestId("button-leave-board");
    act(() => {
      fireEvent.click(leaveButton);
    });
    await screen.findByTestId("dialog-leave-board");
    expect(screen.getByTestId("button-confirm-leave-board")).not.toBeNull();
    expect(screen.getByTestId("button-cancel-leave-board")).not.toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
    // Mutation must not have fired yet — it waits for explicit confirm.
    expect(deleteCalls()).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it("cancels without firing the leave mutation", async () => {
    renderBoard();
    const leaveButton = await screen.findByTestId("button-leave-board");
    act(() => {
      fireEvent.click(leaveButton);
    });
    await screen.findByTestId("dialog-leave-board");
    const cancel = screen.getByTestId("button-cancel-leave-board");
    act(() => {
      fireEvent.click(cancel);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("dialog-leave-board")).toBeNull();
    });
    expect(deleteCalls()).toHaveLength(0);
  });

  it("fires the leave mutation and navigates back to /boards after the user confirms", async () => {
    const { history } = renderBoard();
    const leaveButton = await screen.findByTestId("button-leave-board");
    act(() => {
      fireEvent.click(leaveButton);
    });
    const confirm = await screen.findByTestId("button-confirm-leave-board");
    act(() => {
      fireEvent.click(confirm);
    });
    await waitFor(() => {
      expect(deleteCalls()).toHaveLength(1);
    });
    // Mutation success path navigates back to /boards. Locks in the
    // requirement so a future refactor of the dialog can't accidentally
    // strip the navigation by short-circuiting `leaveBoardFromDetail`.
    await waitFor(() => {
      expect(history?.[history.length - 1]).toBe("/boards");
    });
    await waitFor(() => {
      expect(screen.queryByTestId("dialog-leave-board")).toBeNull();
    });
  });
});
