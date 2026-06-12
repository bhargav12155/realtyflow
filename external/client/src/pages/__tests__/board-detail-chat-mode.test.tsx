import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
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
        return {
          id,
          title: "Plan Board",
          isShared: false,
          isOwner: true,
          batches: [],
          assets: [],
        };
      }
      return null;
    },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com", name: "Tester" },
    isAuthenticated: true,
  }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null }),
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
  ChatPanel: ({ mode }: { mode: string }) => (
    <div data-testid="chat-panel-stub" data-mode={mode}>
      mode:{mode}
    </div>
  ),
}));

import BoardDetailPage from "@/pages/board-detail";

beforeEach(() => {
  apiRequestMock.mockReset();
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());

function renderAt(path: string) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base, id] = queryKey as [string, string];
          if (base === "/api/boards" && id) {
            return {
              id,
              title: "Plan Board",
              isShared: false,
              isOwner: true,
              batches: [],
              assets: [],
            };
          }
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  // wouter's memoryLocation only sets the routing path; the seedParams
  // useMemo reads window.location.search directly, so push the full URL
  // (including query string) onto the real window.history first.
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

describe("BoardDetailPage chatMode URL handling", () => {
  it("?seed=…&chatMode=plan starts the chat in Plan (brainstorm) mode", async () => {
    renderAt("/boards/board-1?seed=hello+world&chatMode=plan");
    const panel = await waitFor(() => screen.getByTestId("chat-panel-stub"));
    expect(panel.getAttribute("data-mode")).toBe("brainstorm");
  });

  it("?chatMode=plan alone (no seed) still applies Plan mode", async () => {
    renderAt("/boards/board-2?chatMode=plan");
    const panel = await waitFor(() => screen.getByTestId("chat-panel-stub"));
    expect(panel.getAttribute("data-mode")).toBe("brainstorm");
  });

  it("an unknown chatMode falls back to Build (create) mode", async () => {
    renderAt("/boards/board-3?seed=x&chatMode=foo");
    const panel = await waitFor(() => screen.getByTestId("chat-panel-stub"));
    expect(panel.getAttribute("data-mode")).toBe("create");
  });
});
