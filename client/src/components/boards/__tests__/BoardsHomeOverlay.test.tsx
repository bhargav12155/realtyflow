import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { BoardsHomeOverlay } from "../BoardsHomeOverlay";

const apiRequestMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn() },
  getQueryFn: () => async () => [],
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com", name: "Tester" } }),
}));

function renderOverlay(onOpenChange: (v: boolean) => void) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const { hook } = memoryLocation({ path: "/dashboard", record: true });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <BoardsHomeOverlay open onOpenChange={onOpenChange} />
      </Router>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue(
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
  );
});
afterEach(() => cleanup());

describe("BoardsHomeOverlay dismissal", () => {
  it("renders the content as a full-screen (inset-0) surface", async () => {
    renderOverlay(vi.fn());
    const content = await screen.findByTestId("boards-overlay-content");
    expect(content.className).toMatch(/\binset-0\b/);
    expect(content.className).not.toMatch(/\binset-(?!0\b)\d/);
  });

  it("calls onOpenChange(false) when the X close button is clicked", async () => {
    const onOpenChange = vi.fn();
    renderOverlay(onOpenChange);
    const closeBtn = await screen.findByTestId("button-close-boards-overlay");
    fireEvent.click(closeBtn);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("calls onOpenChange(false) when Escape is pressed", async () => {
    const onOpenChange = vi.fn();
    renderOverlay(onOpenChange);
    await screen.findByTestId("boards-overlay-content");
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("calls onOpenChange(false) when a backdrop region (gray gutter) is clicked", async () => {
    const onOpenChange = vi.fn();
    renderOverlay(onOpenChange);
    // The boards-home-view's outer gray bg is part of the visible backdrop area inside the
    // full-screen Content. Pointer-down here should dismiss because the target is not inside
    // any [data-overlay-keep] interactive island.
    const view = await screen.findByTestId("boards-home-view");
    fireEvent.pointerDown(view);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("does NOT dismiss when pointer-down lands inside an interactive island (the prompt input)", async () => {
    const onOpenChange = vi.fn();
    renderOverlay(onOpenChange);
    const promptInput = await screen.findByTestId("input-prompt");
    fireEvent.pointerDown(promptInput);
    // Allow any async work to settle; then assert no close was called.
    await new Promise((r) => setTimeout(r, 20));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
