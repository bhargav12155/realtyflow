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

  it("calls onOpenChange(false) when the backdrop is clicked", async () => {
    const onOpenChange = vi.fn();
    renderOverlay(onOpenChange);
    const backdrop = await screen.findByTestId("boards-overlay-backdrop");
    // Radix listens to pointerdown on the overlay; clicking simulates outside-content interaction.
    fireEvent.pointerDown(backdrop);
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
