import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { ReactElement } from "react";

const apiRequestMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  getQueryFn: () => async () => null,
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "owner" }, isAuthenticated: true }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null }),
}));
vi.mock("@/hooks/useBoardsTheme", () => ({
  useBoardsTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));
vi.mock("@/components/boards/BoardCanvas", () => ({ BoardCanvas: () => null }));
vi.mock("@/components/boards/AssetToolbar", () => ({ AssetToolbar: () => null }));
vi.mock("@/components/boards/ShareBoardDialog", () => ({ ShareBoardDialog: () => null }));

// Stub ChatPanel so we can drive the page contract directly. The real
// "button-clear-chat" rendering / disabled-states are covered separately in
// ChatPanel.test.tsx — here we focus on the page's undo-window logic.
vi.mock("@/components/boards/ChatPanel", () => ({
  ChatPanel: ({ messages, onClearChat, isClearingChat }: any) => (
    <div data-testid="chat-stub" data-clearing={isClearingChat ? "true" : "false"}>
      <button
        data-testid="button-clear-chat"
        disabled={isClearingChat || messages.length === 0}
        onClick={() => {
          if (isClearingChat) return;
          if (messages.length === 0) return;
          onClearChat?.();
        }}
      >
        clear
      </button>
      <ul>
        {messages.map((m: any) => (
          <li key={m.id} data-testid={`stub-msg-${m.id}`}>
            {m.content}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

import BoardDetailPage from "@/pages/board-detail";

const BOARD_ID = "board-undo";
const SEED_MESSAGES = [
  { id: "m1", role: "user", content: "Hi", notice: null, cta: null, authorUserId: "owner", author: null },
  { id: "m2", role: "assistant", content: "Hello!", notice: null, cta: null, authorUserId: null, author: null },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base, id, sub] = queryKey as [string, string, string?];
          if (base === "/api/boards" && id && !sub) {
            return {
              id,
              title: "B",
              isShared: false,
              isOwner: true,
              userId: "owner",
              batches: [],
              assets: [],
            };
          }
          if (base === "/api/boards" && id && sub === "messages") {
            return { messages: SEED_MESSAGES };
          }
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
}

function installApiMock() {
  apiRequestMock.mockImplementation(async (_method: string, _url: string) => {
    return { json: async () => ({ ok: true }) };
  });
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  installApiMock();
  window.history.replaceState({}, "", "/");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderBoard() {
  const qc = makeQueryClient();
  const path = `/boards/${BOARD_ID}`;
  window.history.replaceState({}, "", path);
  const { hook } = memoryLocation({ path, record: true });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
}

async function waitForHydratedTranscript() {
  await waitFor(() => {
    expect(screen.getByTestId("stub-msg-m1")).not.toBeNull();
    expect(screen.getByTestId("stub-msg-m2")).not.toBeNull();
  });
}

function lastClearToast() {
  const calls = toastMock.mock.calls.filter(
    ([arg]) => arg && (arg as { title?: string }).title === "Chat cleared",
  );
  return calls[calls.length - 1]?.[0] as
    | { description?: string; action?: ReactElement<{ onClick: () => void }> }
    | undefined;
}

function clickClear() {
  act(() => {
    screen.getByTestId("button-clear-chat").click();
  });
}

function deleteCalls() {
  return apiRequestMock.mock.calls.filter(
    ([method, url]) =>
      method === "DELETE" &&
      typeof url === "string" &&
      url === `/api/boards/${BOARD_ID}/messages`,
  );
}

describe("BoardDetailPage clear-chat undo window", () => {
  it("clearing wipes the local transcript immediately and shows an Undo toast (no DELETE yet)", async () => {
    renderBoard();
    await waitForHydratedTranscript();

    clickClear();

    // Local transcript wiped right away.
    await waitFor(() => {
      expect(screen.queryByTestId("stub-msg-m1")).toBeNull();
      expect(screen.queryByTestId("stub-msg-m2")).toBeNull();
    });

    // Toast surfaced with an Undo action.
    const t = lastClearToast();
    expect(t).toBeTruthy();
    expect(t!.action).toBeTruthy();
    expect(typeof t!.action!.props.onClick).toBe("function");

    // ChatPanel is in the "clearing" state, disabling the button.
    expect(screen.getByTestId("chat-stub").getAttribute("data-clearing")).toBe("true");
    expect((screen.getByTestId("button-clear-chat") as HTMLButtonElement).disabled).toBe(true);

    // Server delete must not have fired yet.
    expect(deleteCalls()).toHaveLength(0);
  });

  it("clicking Undo within the window restores the messages and never calls DELETE", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderBoard();
    await waitForHydratedTranscript();

    clickClear();
    await waitFor(() => {
      expect(screen.queryByTestId("stub-msg-m1")).toBeNull();
    });

    const t = lastClearToast();
    expect(t).toBeTruthy();

    // Undo before the 10s window elapses.
    act(() => {
      vi.advanceTimersByTime(2_000);
      t!.action!.props.onClick();
    });

    await waitFor(() => {
      expect(screen.getByTestId("stub-msg-m1")).not.toBeNull();
      expect(screen.getByTestId("stub-msg-m2")).not.toBeNull();
    });

    // Clearing flag released; button re-enabled.
    expect(screen.getByTestId("chat-stub").getAttribute("data-clearing")).toBe("false");

    // A "Chat restored" confirmation was raised.
    expect(
      toastMock.mock.calls.some(
        ([arg]) => arg && (arg as { title?: string }).title === "Chat restored",
      ),
    ).toBe(true);

    // Even if more time passes, the deferred DELETE must NEVER fire.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(deleteCalls()).toHaveLength(0);
  });

  it("after the undo window elapses, DELETE /api/boards/:id/messages is called exactly once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderBoard();
    await waitForHydratedTranscript();

    clickClear();
    await waitFor(() => {
      expect(screen.queryByTestId("stub-msg-m1")).toBeNull();
    });

    expect(deleteCalls()).toHaveLength(0);

    // Roll past the 10s window — the deferred commit should fire.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(deleteCalls()).toHaveLength(1);
    });

    // Clearing flag released after the deferred commit fires.
    await waitFor(() => {
      expect(screen.getByTestId("chat-stub").getAttribute("data-clearing")).toBe("false");
    });

    // Pushing time further must not cause additional DELETEs.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(deleteCalls()).toHaveLength(1);
  });

  it("unmounting while a clear is still pending commits the DELETE immediately", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const utils = renderBoard();
    await waitForHydratedTranscript();

    clickClear();
    await waitFor(() => {
      expect(screen.queryByTestId("stub-msg-m1")).toBeNull();
    });
    expect(deleteCalls()).toHaveLength(0);

    // Navigate away (unmount) before the undo window expires.
    await act(async () => {
      utils.unmount();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(deleteCalls()).toHaveLength(1);
    });

    // And no second commit when the original 10s timer would have fired.
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(deleteCalls()).toHaveLength(1);
  });
});
