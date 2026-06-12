import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { BoardsHomeView } from "../BoardsHomeView";
import { __resetBoardsThemeForTests } from "@/hooks/useBoardsTheme";

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })),
  queryClient: { invalidateQueries: vi.fn() },
  getQueryFn: () => async () => [],
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com", name: "Tester" } }),
}));

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { hook } = memoryLocation({ path: "/boards", record: true });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <BoardsHomeView />
      </Router>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  __resetBoardsThemeForTests();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  __resetBoardsThemeForTests();
});

describe("Boards dark mode toggle", () => {
  it("defaults to light: root has no `dark` class and nothing in localStorage", () => {
    renderHome();
    const root = screen.getByTestId("boards-home-view");
    expect(root.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("boards-theme")).toBeNull();
  });

  it("toggling adds `dark` class to the Boards root and persists to localStorage", () => {
    renderHome();
    const toggle = screen.getByTestId("button-toggle-boards-theme");
    act(() => {
      fireEvent.click(toggle);
    });
    const root = screen.getByTestId("boards-home-view");
    expect(root.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("boards-theme")).toBe("dark");
  });

  it("hydrates from localStorage on mount (persistence across reloads)", () => {
    window.localStorage.setItem("boards-theme", "dark");
    __resetBoardsThemeForTests();
    renderHome();
    const root = screen.getByTestId("boards-home-view");
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("toggling back to light removes `dark` class and stores 'light'", () => {
    window.localStorage.setItem("boards-theme", "dark");
    __resetBoardsThemeForTests();
    renderHome();
    const root = screen.getByTestId("boards-home-view");
    expect(root.classList.contains("dark")).toBe(true);
    act(() => {
      fireEvent.click(screen.getByTestId("button-toggle-boards-theme"));
    });
    expect(screen.getByTestId("boards-home-view").classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("boards-theme")).toBe("light");
  });
});
