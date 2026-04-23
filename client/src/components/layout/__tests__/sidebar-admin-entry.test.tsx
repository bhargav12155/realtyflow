import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Test User", email: "test@example.com", type: "user" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/businessContext", () => ({
  useBusinessType: () => ({ businessType: "general", setBusinessType: vi.fn() }),
  BUSINESS_TYPE_OPTIONS: [
    { value: "general", label: "General", icon: "🏢" },
    { value: "real_estate", label: "Real Estate", icon: "🏠" },
  ],
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn() },
  getQueryFn: () => async () => ({}),
}));

import { Sidebar } from "@/components/layout/sidebar";

function renderSidebar(isAdmin: boolean) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = queryKey[0];
          if (key === "/api/user/is-admin") return { isAdmin };
          return {};
        },
      },
      mutations: { retry: false },
    },
  });
  const memLoc = memoryLocation({ path: "/dashboard", record: true });
  const utils = render(
    <QueryClientProvider client={qc}>
      <Router hook={memLoc.hook}>
        <Sidebar activeView="dashboard" />
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, memLoc };
}

beforeEach(() => {
  // jsdom doesn't implement matchMedia; some shadcn components may use it.
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  }
});

afterEach(() => {
  cleanup();
});

describe("Sidebar — Admin entry visibility", () => {
  it("renders the Admin entry for admin users and routes to /admin/settings", async () => {
    const { memLoc } = renderSidebar(true);

    const adminButtons = await waitFor(() => {
      const found = screen.getAllByTestId("nav-admin");
      expect(found.length).toBeGreaterThan(0);
      return found;
    });

    const desktopAdmin = adminButtons[adminButtons.length - 1];
    fireEvent.click(desktopAdmin);

    await waitFor(() => {
      expect(memLoc.history?.[memLoc.history.length - 1]).toBe("/admin/settings");
    });
  });

  it("hides the Admin entry when /api/user/is-admin returns false", async () => {
    renderSidebar(false);

    // Wait for a non-admin nav item to appear so we know the sidebar rendered.
    await waitFor(() => {
      expect(screen.getAllByTestId("nav-dashboard").length).toBeGreaterThan(0);
    });

    expect(screen.queryByTestId("nav-admin")).toBeNull();
  });

  it("renders all admin-only nav entries for admin users", async () => {
    renderSidebar(true);

    await waitFor(() => {
      expect(screen.getAllByTestId("nav-heygen-shape-drift").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByTestId("nav-heygen-shape-drift").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("nav-infrastructure-alerts").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("nav-admin").length).toBeGreaterThan(0);
  });

  it("hides all admin-only nav entries for non-admin users", async () => {
    renderSidebar(false);

    // Wait for a non-admin nav item to appear so we know the sidebar rendered.
    await waitFor(() => {
      expect(screen.getAllByTestId("nav-dashboard").length).toBeGreaterThan(0);
    });

    expect(screen.queryByTestId("nav-heygen-shape-drift")).toBeNull();
    expect(screen.queryByTestId("nav-infrastructure-alerts")).toBeNull();
    expect(screen.queryByTestId("nav-admin")).toBeNull();
  });
});
