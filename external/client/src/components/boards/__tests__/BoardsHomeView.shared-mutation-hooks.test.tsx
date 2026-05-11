import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoardsHomeView } from "../BoardsHomeView";

// Wiring guard: BoardsHomeView must delegate the destructive board-card
// actions to the shared `useDeleteBoardMutation` / `useLeaveBoardMutation`
// hooks (covered directly by their own unit tests). If a future refactor
// quietly re-implemented the optimistic-remove / toast / rollback dance
// inline on the grid, these mocks would never get called and this test
// would fail — catching the fork before behavioural regressions surface.

const apiRequestMock = vi.fn();
const boardsListRef: { current: unknown[] } = { current: [] };
const queryClientRef: { current: QueryClient | null } = { current: null };

vi.mock("@/lib/queryClient", () => {
  const proxy = new Proxy(
    {},
    {
      get: (_t, prop) => {
        const qc = queryClientRef.current;
        if (!qc) return () => {};
        const value = (qc as unknown as Record<string, unknown>)[prop as string];
        return typeof value === "function" ? value.bind(qc) : value;
      },
    },
  );
  return {
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    queryClient: proxy,
    getQueryFn: () => async () => boardsListRef.current,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: () => {} }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com", name: "Tester" } }),
}));

const deleteMutateMock = vi.fn();
const leaveMutateMock = vi.fn();
const renameMutateMock = vi.fn();

vi.mock("@/hooks/use-delete-board", () => ({
  useDeleteBoardMutation: () => ({
    mutate: deleteMutateMock,
    isPending: false,
    variables: undefined as string | undefined,
  }),
}));

vi.mock("@/hooks/use-leave-board", () => ({
  useLeaveBoardMutation: () => ({
    mutate: leaveMutateMock,
    isPending: false,
    variables: undefined as string | undefined,
  }),
}));

vi.mock("@/hooks/use-rename-board", () => ({
  useRenameBoardMutation: () => ({
    mutate: renameMutateMock,
    isPending: false,
    variables: undefined as { boardId: string; title: string } | undefined,
  }),
}));

function renderWithProviders(ui: React.ReactElement, initialPath = "/boards") {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        queryFn: async () => boardsListRef.current,
      },
      mutations: { retry: false },
    },
  });
  queryClientRef.current = qc;
  const { hook } = memoryLocation({ path: initialPath, record: true });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Router hook={hook}>{ui}</Router>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  if (!(Element.prototype as unknown as { hasPointerCapture?: unknown }).hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  apiRequestMock.mockReset();
  deleteMutateMock.mockReset();
  leaveMutateMock.mockReset();
  renameMutateMock.mockReset();
  boardsListRef.current = [];
  apiRequestMock.mockImplementation(async (method: string, url: string) => {
    if (method === "GET" && url === "/api/boards") {
      return new Response(JSON.stringify(boardsListRef.current), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
});

afterEach(() => cleanup());

describe("BoardsHomeView shared mutation hook wiring", () => {
  it("delegates the owner card 'Delete board' confirm to useDeleteBoardMutation.mutate(boardId)", async () => {
    boardsListRef.current = [
      {
        id: "brd_owned_wired",
        title: "Coastal listings",
        isOwner: true,
        updatedAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<BoardsHomeView hideSidebar />);

    await screen.findByTestId("card-board-brd_owned_wired");

    const trigger = screen.getByTestId("button-board-menu-brd_owned_wired");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);

    const deleteItem = await screen.findByTestId("menu-item-delete-brd_owned_wired");
    fireEvent.click(deleteItem);

    const confirm = await screen.findByTestId("button-confirm-delete-brd_owned_wired");
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(deleteMutateMock).toHaveBeenCalledTimes(1);
    });
    expect(deleteMutateMock).toHaveBeenCalledWith("brd_owned_wired");

    // Sibling shared hooks must not be triggered by a delete confirm.
    expect(leaveMutateMock).not.toHaveBeenCalled();
    expect(renameMutateMock).not.toHaveBeenCalled();

    // No DELETE call should reach apiRequest directly — the grid must go
    // through the shared hook (which owns the network call), not duplicate
    // it inline.
    const directDeletes = apiRequestMock.mock.calls.filter(
      (c) => c[0] === "DELETE" && c[1] === "/api/boards/brd_owned_wired",
    );
    expect(directDeletes.length).toBe(0);
  });

  it("delegates the shared card 'Leave board' confirm to useLeaveBoardMutation.mutate(boardId)", async () => {
    boardsListRef.current = [
      {
        id: "brd_shared_wired",
        title: "Someone else's board",
        isOwner: false,
        owner: { id: "u-other", name: "Other", email: "other@example.com" },
        updatedAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<BoardsHomeView hideSidebar />);

    await screen.findByTestId("card-board-brd_shared_wired");

    const trigger = screen.getByTestId("button-board-menu-brd_shared_wired");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);

    const leaveItem = await screen.findByTestId("menu-item-leave-brd_shared_wired");
    fireEvent.click(leaveItem);

    const confirm = await screen.findByTestId("button-confirm-leave-brd_shared_wired");
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(leaveMutateMock).toHaveBeenCalledTimes(1);
    });
    expect(leaveMutateMock).toHaveBeenCalledWith("brd_shared_wired");

    // Sibling shared hooks must not be triggered by a leave confirm.
    expect(deleteMutateMock).not.toHaveBeenCalled();
    expect(renameMutateMock).not.toHaveBeenCalled();

    // No DELETE call should reach apiRequest directly — the grid must go
    // through the shared hook (which owns the network call), not duplicate
    // it inline.
    const directLeaves = apiRequestMock.mock.calls.filter(
      (c) => c[0] === "DELETE" && c[1] === "/api/boards/brd_shared_wired/share/me",
    );
    expect(directLeaves.length).toBe(0);
  });
});
