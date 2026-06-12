import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();

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

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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

// Stub ChatPanel: expose onSend via a button and render messages so the test
// can fire the send and assert the CTA shows up on the resulting assistant
// message without going through the real input wiring.
vi.mock("@/components/boards/ChatPanel", () => ({
  ChatPanel: ({ messages, onSend }: any) => (
    <div data-testid="chat-stub">
      <button
        data-testid="stub-send-self-avatar"
        onClick={() => onSend("create an avatar of myself")}
      >
        send-self-avatar
      </button>
      <button
        data-testid="stub-send-other"
        onClick={() => onSend("write me a property description")}
      >
        send-other
      </button>
      <ul>
        {messages.map((m: any) => (
          <li key={m.id} data-testid={`stub-msg-${m.role}`}>
            {m.content}
            {m.cta ? (
              <a href={m.cta.href} data-testid={m.cta.testId}>
                {m.cta.label}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

import BoardDetailPage from "@/pages/board-detail";

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ json: async () => ({ reply: "ok" }) });
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());

function renderBoard() {
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
  window.history.replaceState({}, "", "/boards/b1");
  const { hook } = memoryLocation({ path: "/boards/b1", record: true });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
}

describe("Board chat: self-avatar CTA short-circuit", () => {
  it("shows the Photo Avatars CTA and does not POST to /chat (it persists via /messages instead)", async () => {
    renderBoard();
    const btn = await waitFor(() => screen.getByTestId("stub-send-self-avatar"));
    act(() => btn.click());
    const cta = await waitFor(() => screen.getByTestId("button-open-photo-avatars"));
    expect(cta.getAttribute("href")).toBe("/dashboard?action=upload#photo-avatars");
    // The short-circuit must NOT hit the LLM /chat endpoint, but it SHOULD
    // persist the user+assistant turn via /messages so the CTA pair survives
    // a refresh.
    const calls = apiRequestMock.mock.calls;
    expect(calls.some(([, url]) => String(url).includes("/chat"))).toBe(false);
    const messagesCall = calls.find(([, url]) => String(url).includes("/messages"));
    expect(messagesCall).toBeTruthy();
    const [, , body] = messagesCall as unknown as [string, string, { messages: Array<{ role: string }> }];
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[1].role).toBe("assistant");
  });

  it("normal prompts still POST to /chat", async () => {
    renderBoard();
    const btn = await waitFor(() => screen.getByTestId("stub-send-other"));
    act(() => btn.click());
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalled();
    });
    const [, url] = apiRequestMock.mock.calls[0];
    expect(String(url)).toContain("/chat");
  });
});
