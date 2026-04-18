import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { BoardsHomeView } from "../BoardsHomeView";

const apiRequestMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn() },
  getQueryFn: () => async () => [],
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com", name: "Tester" } }),
}));

function renderWithProviders(ui: React.ReactElement, initialPath = "/boards") {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const { hook, history } = memoryLocation({ path: initialPath, record: true });
  const tree = (
    <QueryClientProvider client={qc}>
      <Router hook={hook}>{ui}</Router>
    </QueryClientProvider>
  );
  const utils = render(tree);
  return Object.assign(utils, { history });
}

beforeEach(() => {
  apiRequestMock.mockReset();
  // Default: GET /api/boards returns []
  apiRequestMock.mockImplementation(async (method: string, url: string, body?: unknown) => {
    if (method === "GET" && url === "/api/boards") {
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "POST" && url === "/api/boards") {
      const created = {
        id: "brd_test_1",
        title: (body as { title?: string } | undefined)?.title ?? "Untitled board",
      };
      return new Response(JSON.stringify(created), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
});

afterEach(() => cleanup());

describe("BoardsHomeView create-from-prompt", () => {
  it("submits the prompt as { title } via Enter, navigates to /boards/:id, and fires onBoardCreated", async () => {
    const onBoardCreated = vi.fn();
    const { history } = renderWithProviders(<BoardsHomeView onBoardCreated={onBoardCreated} />);

    const input = await screen.findByTestId("input-prompt");
    fireEvent.change(input, { target: { value: "Plan a video for 123 Main St" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      expect(postCalls.length).toBe(1);
      expect(postCalls[0][1]).toBe("/api/boards");
      expect(postCalls[0][2]).toEqual({ title: "Plan a video for 123 Main St" });
    });

    await waitFor(() => {
      expect(onBoardCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "brd_test_1", title: "Plan a video for 123 Main St" }),
      );
      expect(history.at(-1)).toBe("/boards/brd_test_1");
    });
  });

  it("submits an empty payload {} when prompt is blank (clicking the New board card)", async () => {
    renderWithProviders(<BoardsHomeView />);

    const newBoard = await screen.findByTestId("card-new-board");
    fireEvent.click(newBoard);

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      expect(postCalls.length).toBe(1);
      expect(postCalls[0][1]).toBe("/api/boards");
      expect(postCalls[0][2]).toEqual({});
    });
  });
});
