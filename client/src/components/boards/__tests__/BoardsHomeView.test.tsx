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
  it("submits the prompt with { title, seedPrompt } via Enter, navigates to /boards/:id, and fires onBoardCreated", async () => {
    const onBoardCreated = vi.fn();
    const { history } = renderWithProviders(<BoardsHomeView onBoardCreated={onBoardCreated} />);

    const input = await screen.findByTestId("input-prompt");
    fireEvent.change(input, { target: { value: "Plan a video for 123 Main St" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      expect(postCalls.length).toBe(1);
      expect(postCalls[0][1]).toBe("/api/boards");
      expect(postCalls[0][2]).toEqual({
        title: "Plan a video for 123 Main St",
        seedPrompt: "Plan a video for 123 Main St",
      });
    });

    await waitFor(() => {
      expect(onBoardCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "brd_test_1", title: "Plan a video for 123 Main St" }),
      );
      expect(history.at(-1)).toBe(
        `/boards/brd_test_1?seed=${encodeURIComponent("Plan a video for 123 Main St").replace(/%20/g, "+")}`,
      );
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

  it("clicking the Image chip seeds the prompt and tags the board with the intent (no provider override)", async () => {
    const { history } = renderWithProviders(<BoardsHomeView />);

    const chip = await screen.findByTestId("chip-intent-image");
    fireEvent.click(chip);

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      expect(postCalls.length).toBe(1);
      expect(postCalls[0][1]).toBe("/api/boards");
      const body = postCalls[0][2] as Record<string, unknown>;
      expect(body.seedIntent).toBe("image");
      // Image intent must NOT pre-set provider/generationMode because the
      // board chat schema does not accept image-only providers like
      // `openai-image` today — leaving them unset lets the chat default
      // to a valid provider on first send.
      expect(body.seedProvider).toBeUndefined();
      expect(body.seedGenerationMode).toBeUndefined();
      expect(typeof body.seedPrompt).toBe("string");
      expect((body.seedPrompt as string).startsWith("Create an image of")).toBe(true);
    });

    await waitFor(() => {
      const last = history.at(-1) ?? "";
      expect(last.startsWith("/boards/brd_test_1?")).toBe(true);
      expect(last).toContain("intent=image");
      expect(last).not.toContain("provider=");
    });
  });

  it("clicking the Social Post chip seeds plan mode (no provider) and routes with chatMode=plan", async () => {
    const { history } = renderWithProviders(<BoardsHomeView />);

    const chip = await screen.findByTestId("chip-intent-social-post");
    fireEvent.click(chip);

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      expect(postCalls.length).toBe(1);
      const body = postCalls[0][2] as Record<string, unknown>;
      expect(body.seedIntent).toBe("social-post");
      expect(body.seedMode).toBe("plan");
      // Plan-mode intents must NOT pre-set provider/generationMode — the
      // platform picker is hidden in Plan mode and there is nothing to pick.
      expect(body.seedProvider).toBeUndefined();
      expect(body.seedGenerationMode).toBeUndefined();
    });

    await waitFor(() => {
      const last = history.at(-1) ?? "";
      expect(last).toContain("intent=social-post");
      expect(last).toContain("chatMode=plan");
      expect(last).not.toContain("provider=");
    });
  });

  it("clicking the Video chip seeds build mode and routes with chatMode=build", async () => {
    const { history } = renderWithProviders(<BoardsHomeView />);

    const chip = await screen.findByTestId("chip-intent-video");
    fireEvent.click(chip);

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      const body = postCalls[0][2] as Record<string, unknown>;
      expect(body.seedMode).toBe("build");
      expect(body.seedProvider).toBe("veo");
    });

    await waitFor(() => {
      expect(history.at(-1) ?? "").toContain("chatMode=build");
    });
  });

  it("uses the typed prompt as the chip seed when the input is non-empty", async () => {
    renderWithProviders(<BoardsHomeView />);

    const input = await screen.findByTestId("input-prompt");
    fireEvent.change(input, { target: { value: "a sunset over the ocean" } });

    const chip = await screen.findByTestId("chip-intent-video");
    fireEvent.click(chip);

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      expect(postCalls.length).toBe(1);
      const body = postCalls[0][2] as Record<string, unknown>;
      expect(body.seedIntent).toBe("video");
      expect(body.seedPrompt).toBe("a sunset over the ocean");
      expect(body.seedProvider).toBe("veo");
    });
  });
});
