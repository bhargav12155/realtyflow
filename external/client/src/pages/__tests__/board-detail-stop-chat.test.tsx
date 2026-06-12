import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  getQueryFn:
    () =>
    async ({ queryKey }: { queryKey: unknown[] }) => {
      const [base, id] = queryKey as [string, string];
      if (base === "/api/boards" && id) {
        return { id, title: "B", isShared: false, isOwner: true, batches: [], assets: [] };
      }
      return null;
    },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isAuthenticated: true }),
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

// Stub ChatPanel: surface enough of the contract (mode, isSending, onStop,
// onSend, messages) so we can drive the page from a test without pulling in
// the full ChatPanel render tree. The real ChatPanel rendering of the Stop
// button is covered separately in ChatPanel.test.tsx.
vi.mock("@/components/boards/ChatPanel", () => ({
  ChatPanel: ({ messages, onSend, isSending, onStop, mode }: any) => (
    <div data-testid="chat-stub" data-mode={mode}>
      <button data-testid="stub-send" onClick={() => onSend("hello world")}>send</button>
      {isSending && <div data-testid="stub-thinking">thinking</div>}
      {isSending && onStop && (
        <button data-testid="stub-stop" onClick={onStop}>stop</button>
      )}
      <ul>
        {messages.map((m: any) => (
          <li key={m.id} data-testid={`stub-msg-${m.role}-${m.id}`} data-pending={m.pending ? "true" : "false"}>
            {m.content}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

import BoardDetailPage from "@/pages/board-detail";

type ChatCall = {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  signal: AbortSignal | undefined;
};
let pendingChat: ChatCall | null = null;

function installChatMock() {
  apiRequestMock.mockImplementation(
    async (
      _method: string,
      url: string,
      _body?: unknown,
      options?: { signal?: AbortSignal },
    ) => {
      if (typeof url === "string" && url.endsWith("/chat")) {
        return new Promise((resolve, reject) => {
          pendingChat = { resolve, reject, signal: options?.signal };
          if (options?.signal) {
            options.signal.addEventListener("abort", () => {
              const err = new Error("aborted") as Error & { name: string };
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      }
      // Default: behave like an empty success response for any other call
      // (e.g. the messages history hydration).
      return { json: async () => ({ messages: [] }) };
    },
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  pendingChat = null;
  installChatMock();
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());

function renderBoard(path: string) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base, id] = queryKey as [string, string];
          if (base === "/api/boards" && id) {
            return { id, title: "B", isShared: false, isOwner: true, batches: [], assets: [] };
          }
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  window.history.replaceState({}, "", path);
  const pathOnly = path.split("?")[0];
  const { hook } = memoryLocation({ path: pathOnly, record: true });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
}

async function startInFlightChat(path: string) {
  renderBoard(path);
  const sendBtn = await waitFor(() => screen.getByTestId("stub-send"));
  act(() => sendBtn.click());
  // Wait until the optimistic pending assistant bubble + thinking indicator
  // have been rendered, which means the mutation is in-flight.
  await waitFor(() => {
    expect(screen.getByTestId("stub-thinking")).not.toBeNull();
    expect(screen.getByTestId("stub-stop")).not.toBeNull();
  });
  // The chat fetch must have been started with an AbortSignal so Stop can
  // actually cancel it.
  expect(pendingChat).not.toBeNull();
  expect(pendingChat?.signal).toBeInstanceOf(AbortSignal);
  expect(pendingChat?.signal?.aborted).toBe(false);
}

function lastPendingAssistant() {
  return Array.from(document.querySelectorAll("[data-testid^='stub-msg-assistant-']")).filter(
    (el) => el.getAttribute("data-pending") === "true",
  );
}

describe("BoardDetailPage stop in-flight chat reply", () => {
  for (const { label, path, expectedMode } of [
    { label: "Build (create) mode", path: "/boards/b1?chatMode=build", expectedMode: "create" },
    { label: "Think (brainstorm) mode", path: "/boards/b2?chatMode=plan", expectedMode: "brainstorm" },
  ]) {
    describe(label, () => {
      it("shows the Stop affordance alongside the thinking indicator while sending, then both disappear once the reply settles", async () => {
        await startInFlightChat(path);
        expect(screen.getByTestId("chat-stub").getAttribute("data-mode")).toBe(expectedMode);

        // Settle the in-flight chat normally — Stop and thinking should both
        // vanish, and there must be no orphan pending bubble left behind.
        await act(async () => {
          pendingChat!.resolve({ json: async () => ({ reply: "all done" }) });
          // Let microtasks for the mutation onSuccess flush.
          await Promise.resolve();
        });

        await waitFor(() => {
          expect(screen.queryByTestId("stub-thinking")).toBeNull();
          expect(screen.queryByTestId("stub-stop")).toBeNull();
        });
        expect(lastPendingAssistant()).toHaveLength(0);
      });

      it("clicking Stop aborts the in-flight fetch, removes the pending bubble, and shows a non-destructive 'Reply stopped' toast", async () => {
        await startInFlightChat(path);

        // Snapshot the in-flight signal so we can assert it actually aborted.
        const inFlightSignal = pendingChat!.signal!;

        act(() => screen.getByTestId("stub-stop").click());

        // The optimistic "…" bubble must be gone.
        await waitFor(() => {
          expect(lastPendingAssistant()).toHaveLength(0);
        });

        // The fetch's AbortSignal must have been triggered.
        expect(inFlightSignal.aborted).toBe(true);

        // Stop and thinking indicator are gone once the aborted mutation
        // finishes settling (the abort rejection is delivered async).
        await waitFor(() => {
          expect(screen.queryByTestId("stub-thinking")).toBeNull();
          expect(screen.queryByTestId("stub-stop")).toBeNull();
        });

        // The non-destructive "Reply stopped" toast was raised exactly once,
        // and the destructive "Chat error" toast was NOT raised on abort.
        await waitFor(() => {
          expect(
            toastMock.mock.calls.some(
              ([arg]) =>
                arg && typeof arg === "object" && (arg as { title?: string }).title === "Reply stopped",
            ),
          ).toBe(true);
        });
        const stoppedCalls = toastMock.mock.calls.filter(
          ([arg]) => arg && (arg as { title?: string }).title === "Reply stopped",
        );
        expect(stoppedCalls).toHaveLength(1);
        const stoppedToast = stoppedCalls[0][0] as { variant?: string };
        expect(stoppedToast.variant).not.toBe("destructive");

        const errorCalls = toastMock.mock.calls.filter(
          ([arg]) => arg && (arg as { title?: string }).title === "Chat error",
        );
        expect(errorCalls).toHaveLength(0);
      });
    });
  }
});
