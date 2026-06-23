import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoardsHomeView } from "../BoardsHomeView";
import { BoardsHomeOverlay } from "../BoardsHomeOverlay";

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

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com", name: "Tester" } }),
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
  const { hook, history } = memoryLocation({ path: initialPath, record: true });
  const tree = (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Router hook={hook}>{ui}</Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
  const utils = render(tree);
  return Object.assign(utils, { history });
}

// Radix DropdownMenu uses pointer capture APIs that JSDOM doesn't implement.
// Polyfill them so the menu actually opens in tests.
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
  toastMock.mockReset();
  boardsListRef.current = [];
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
  it("submits the prompt with { title, seedPrompt, seedMode: 'plan' } via Enter, navigates to /boards/:id?...&chatMode=plan, and fires onBoardCreated", async () => {
    const onBoardCreated = vi.fn();
    const { history } = renderWithProviders(<BoardsHomeView onBoardCreated={onBoardCreated} />);

    const input = await screen.findByTestId("input-prompt");
    fireEvent.change(input, { target: { value: "Plan a video for 123 Main St" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST");
      expect(postCalls.length).toBe(1);
      expect(postCalls[0][1]).toBe("/api/boards");
      // Free-form prompts must seed Think mode so the new board opens with
      // a planning question, not the "press send to start" build seed.
      expect(postCalls[0][2]).toEqual({
        title: "Plan a video for 123 Main St",
        seedPrompt: "Plan a video for 123 Main St",
        seedMode: "plan",
      });
    });

    await waitFor(() => {
      expect(onBoardCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "brd_test_1", title: "Plan a video for 123 Main St" }),
      );
      const last = history.at(-1) ?? "";
      expect(last.startsWith("/boards/brd_test_1?")).toBe(true);
      // Prompt is carried through as the seed.
      expect(last).toContain(
        `seed=${encodeURIComponent("Plan a video for 123 Main St").replace(/%20/g, "+")}`,
      );
      // Think mode is propagated via chatMode=plan so board-detail switches
      // the chat toggle to brainstorm and opens with the planning question.
      expect(last).toContain("chatMode=plan");
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
      // Video is an image-first guided flow: it seeds an image provider so the
      // first generation produces image options (not a direct text-to-video).
      expect(body.seedProvider).toBe("gemini-image");
      expect(body.seedGenerationMode).toBeUndefined();
    });

    await waitFor(() => {
      expect(history.at(-1) ?? "").toContain("chatMode=build");
    });
  });

  it("owner cards expose a 'Delete board' action that calls DELETE /api/boards/:id and removes the card", async () => {
    const owned = [
      {
        id: "brd_owned_1",
        title: "Coastal listings",
        isOwner: true,
        updatedAt: new Date().toISOString(),
      },
    ];
    boardsListRef.current = owned;
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method === "DELETE" && url === "/api/boards/brd_owned_1") {
        boardsListRef.current = (boardsListRef.current as { id: string }[]).filter(
          (b) => b.id !== "brd_owned_1",
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderWithProviders(<BoardsHomeView />);

    const card = await screen.findByTestId("card-board-brd_owned_1");
    expect(card).not.toBeNull();
    // No "Leave board" item on an owned board.
    expect(screen.queryByTestId("menu-item-leave-brd_owned_1")).toBeNull();

    const trigger = screen.getByTestId("button-board-menu-brd_owned_1");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);
    const deleteItem = await screen.findByTestId("menu-item-delete-brd_owned_1");
    fireEvent.click(deleteItem);

    const confirm = await screen.findByTestId("button-confirm-delete-brd_owned_1");
    fireEvent.click(confirm);

    await waitFor(() => {
      const deleteCalls = apiRequestMock.mock.calls.filter(
        (c) => c[0] === "DELETE" && c[1] === "/api/boards/brd_owned_1",
      );
      expect(deleteCalls.length).toBe(1);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("card-board-brd_owned_1")).toBeNull();
    });
  });

  it("delete confirm inside the Boards overlay does NOT dismiss the overlay (no bounce-to-dashboard)", async () => {
    const owned = [
      {
        id: "brd_owned_overlay",
        title: "Coastal listings",
        isOwner: true,
        updatedAt: new Date().toISOString(),
      },
    ];
    boardsListRef.current = owned;
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method === "GET" && url === "/api/boards") {
        return new Response(JSON.stringify(boardsListRef.current), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "DELETE" && url === "/api/boards/brd_owned_overlay") {
        boardsListRef.current = (boardsListRef.current as { id: string }[]).filter(
          (b) => b.id !== "brd_owned_overlay",
        );
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const onOpenChange = vi.fn();
    renderWithProviders(<BoardsHomeOverlay open onOpenChange={onOpenChange} />);

    await screen.findByTestId("boards-overlay-content");
    await screen.findByTestId("card-board-brd_owned_overlay");

    const trigger = screen.getByTestId("button-board-menu-brd_owned_overlay");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);
    const deleteItem = await screen.findByTestId("menu-item-delete-brd_owned_overlay");
    fireEvent.click(deleteItem);

    const confirm = await screen.findByTestId("button-confirm-delete-brd_owned_overlay");
    // Pointer-down through click — the full interaction sequence Radix
    // uses to detect dismiss-outside.
    fireEvent.pointerDown(confirm, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(confirm, { button: 0, pointerType: "mouse" });
    fireEvent.click(confirm);

    await waitFor(() => {
      const deleteCalls = apiRequestMock.mock.calls.filter(
        (c) => c[0] === "DELETE" && c[1] === "/api/boards/brd_owned_overlay",
      );
      expect(deleteCalls.length).toBe(1);
    });

    // The card is gone, but the overlay must still be open: the user should
    // stay on the boards grid, not get bounced back to /dashboard.
    await waitFor(() => {
      expect(screen.queryByTestId("card-board-brd_owned_overlay")).toBeNull();
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.queryByTestId("boards-overlay-content")).not.toBeNull();
  });

  it("rolls back the optimistic delete and shows an error toast when DELETE /api/boards/:id fails", async () => {
    const owned = [
      {
        id: "brd_owned_2",
        title: "Coastal listings",
        isOwner: true,
        updatedAt: new Date().toISOString(),
      },
    ];
    boardsListRef.current = owned;
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method === "DELETE" && url === "/api/boards/brd_owned_2") {
        throw new Error("500: server exploded");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderWithProviders(<BoardsHomeView />);

    await screen.findByTestId("card-board-brd_owned_2");
    const trigger = screen.getByTestId("button-board-menu-brd_owned_2");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);
    const deleteItem = await screen.findByTestId("menu-item-delete-brd_owned_2");
    fireEvent.click(deleteItem);
    const confirm = await screen.findByTestId("button-confirm-delete-brd_owned_2");
    fireEvent.click(confirm);

    await waitFor(() => {
      const deleteCalls = apiRequestMock.mock.calls.filter(
        (c) => c[0] === "DELETE" && c[1] === "/api/boards/brd_owned_2",
      );
      expect(deleteCalls.length).toBe(1);
    });

    // Card should reappear after rollback.
    await waitFor(() => {
      expect(screen.queryByTestId("card-board-brd_owned_2")).not.toBeNull();
    });

    // Destructive error toast should have been fired.
    await waitFor(() => {
      const errorToasts = toastMock.mock.calls.filter(
        (c) => (c[0] as { variant?: string } | undefined)?.variant === "destructive",
      );
      expect(errorToasts.length).toBeGreaterThan(0);
      expect((errorToasts[0][0] as { title?: string }).title).toBe("Couldn't delete board");
    });
  });

  it("rolls back the optimistic leave and shows an error toast when DELETE /api/boards/:id/share/me fails", async () => {
    const shared = [
      {
        id: "brd_shared_2",
        title: "Someone else's board",
        isOwner: false,
        owner: { id: "u-other", name: "Other", email: "other@example.com" },
        updatedAt: new Date().toISOString(),
      },
    ];
    boardsListRef.current = shared;
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method === "DELETE" && url === "/api/boards/brd_shared_2/share/me") {
        throw new Error("403: not allowed");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderWithProviders(<BoardsHomeView />);

    await screen.findByTestId("card-board-brd_shared_2");
    const trigger = screen.getByTestId("button-board-menu-brd_shared_2");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);
    const leaveItem = await screen.findByTestId("menu-item-leave-brd_shared_2");
    fireEvent.click(leaveItem);
    const confirm = await screen.findByTestId("button-confirm-leave-brd_shared_2");
    fireEvent.click(confirm);

    await waitFor(() => {
      const leaveCalls = apiRequestMock.mock.calls.filter(
        (c) => c[0] === "DELETE" && c[1] === "/api/boards/brd_shared_2/share/me",
      );
      expect(leaveCalls.length).toBe(1);
    });

    // Card should reappear after rollback.
    await waitFor(() => {
      expect(screen.queryByTestId("card-board-brd_shared_2")).not.toBeNull();
    });

    await waitFor(() => {
      const errorToasts = toastMock.mock.calls.filter(
        (c) => (c[0] as { variant?: string } | undefined)?.variant === "destructive",
      );
      expect(errorToasts.length).toBeGreaterThan(0);
      expect((errorToasts[0][0] as { title?: string }).title).toBe("Couldn't leave board");
    });
  });

  it("non-owner (shared) cards still expose only 'Leave board', never 'Delete board'", async () => {
    const shared = [
      {
        id: "brd_shared_1",
        title: "Someone else's board",
        isOwner: false,
        owner: { id: "u-other", name: "Other", email: "other@example.com" },
        updatedAt: new Date().toISOString(),
      },
    ];
    boardsListRef.current = shared;
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderWithProviders(<BoardsHomeView />);

    await screen.findByTestId("card-board-brd_shared_1");
    const trigger = screen.getByTestId("button-board-menu-brd_shared_1");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);

    await screen.findByTestId("menu-item-leave-brd_shared_1");
    expect(screen.queryByTestId("menu-item-delete-brd_shared_1")).toBeNull();
  });

  it("never shows 'Delete board' when isOwner is missing from the API response", async () => {
    // Simulate a legacy/partial /api/boards payload that forgot to set
    // `isOwner`. The destructive Delete action must NOT appear, because we
    // can't confirm the current user owns the board.
    const ambiguous = [
      {
        id: "brd_ambiguous_1",
        title: "Mystery board",
        // intentionally no isOwner
        updatedAt: new Date().toISOString(),
      },
    ];
    boardsListRef.current = ambiguous;
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderWithProviders(<BoardsHomeView />);

    await screen.findByTestId("card-board-brd_ambiguous_1");
    // Even if a kebab menu were rendered, the destructive action must not
    // be in the DOM. We check both the menu item and the confirm dialog
    // button so a misconfigured render can't sneak it in.
    expect(screen.queryByTestId("menu-item-delete-brd_ambiguous_1")).toBeNull();
    expect(screen.queryByTestId("button-confirm-delete-brd_ambiguous_1")).toBeNull();
    expect(screen.queryByTestId("dialog-delete-board-brd_ambiguous_1")).toBeNull();
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
      expect(body.seedProvider).toBe("gemini-image");
    });
  });
});
