import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
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
  useWebSocket: () => ({ isConnected: false, lastMessage: null }),
}));
vi.mock("@/hooks/useBoardsTheme", () => ({
  useBoardsTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

vi.mock("@/components/boards/BoardCanvas", () => ({ BoardCanvas: () => null }));
vi.mock("@/components/boards/AssetToolbar", () => ({ AssetToolbar: () => null }));
vi.mock("@/components/boards/ShareBoardDialog", () => ({ ShareBoardDialog: () => null }));

import BoardDetailPage from "@/pages/board-detail";

beforeEach(() => {
  apiRequestMock.mockReset();
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());

describe("Shared board chat history hydration", () => {
  it("renders the author label on persisted messages even when the board query resolves after the messages query", async () => {
    let resolveBoard: ((value: unknown) => void) | null = null;
    const boardPromise = new Promise((res) => {
      resolveBoard = res;
    });

    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: async ({ queryKey }) => {
            const [base, id, sub] = queryKey as [string, string, string?];
            if (base === "/api/boards" && id && !sub) {
              // Stall the board query until we explicitly resolve it.
              await boardPromise;
              return {
                id,
                title: "Shared Board",
                isShared: true,
                isOwner: true,
                userId: "owner",
                batches: [],
                assets: [],
              };
            }
            if (base === "/api/boards" && id && sub === "messages") {
              return {
                messages: [
                  {
                    id: "m1",
                    role: "user",
                    content: "Reply from collab",
                    notice: null,
                    cta: null,
                    authorUserId: "collab",
                    author: {
                      id: "collab",
                      name: "Carl Collab",
                      email: "carl@example.com",
                    },
                  },
                ],
              };
            }
            return null;
          },
        },
        mutations: { retry: false },
      },
    });

    window.history.replaceState({}, "", "/boards/board-shared");
    const { hook } = memoryLocation({ path: "/boards/board-shared", record: true });
    render(
      <QueryClientProvider client={qc}>
        <Router hook={hook}>
          <Route path="/boards/:id" component={BoardDetailPage} />
        </Router>
      </QueryClientProvider>,
    );

    // Let the messages query settle first, simulating the race.
    await new Promise((r) => setTimeout(r, 50));
    // Now release the board metadata.
    resolveBoard?.(undefined);

    // Once both have resolved, the persisted message should be hydrated
    // *with* its author label so the owner can see who posted it.
    const label = await waitFor(() => screen.getByTestId("text-msg-author-m1"));
    expect(label.textContent).toMatch(/Carl Collab/);
  });
});
