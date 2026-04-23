import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { Notification } from "@shared/schema";

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isAuthenticated: true }),
}));
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: () => <div data-testid="stub-sidebar" />,
}));

import AdminAlertsPage from "@/pages/admin-alerts";

type Responses = {
  isAdmin: boolean;
  notifications?: Notification[];
};

function renderPage(responses: Responses) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        queryFn: async ({ queryKey }) => {
          const [base] = queryKey as [string];
          if (base === "/api/user/is-admin") return { isAdmin: responses.isAdmin };
          if (base === "/api/notifications") return responses.notifications ?? [];
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  const { hook } = memoryLocation({ path: "/admin/alerts", record: true });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/admin/alerts" component={AdminAlertsPage} />
        <Route path="/dashboard">
          <div data-testid="stub-dashboard">dashboard</div>
        </Route>
      </Router>
    </QueryClientProvider>,
  );
}

function makeAlert(
  id: string,
  data: Record<string, unknown>,
  type = "admin_alert",
): Notification {
  return {
    id,
    userId: "u1",
    type,
    isRead: false,
    createdAt: new Date("2026-04-23T12:00:00Z").toISOString() as unknown as Date,
    data,
  } as unknown as Notification;
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
});

afterEach(() => cleanup());

describe("AdminAlertsPage", () => {
  it("shows the 'Admins only' forbidden block when the user isn't an admin", async () => {
    renderPage({ isAdmin: false });
    await waitFor(() => {
      expect(screen.getByTestId("text-admin-alerts-forbidden")).not.toBeNull();
    });
    expect(screen.queryByTestId("page-admin-alerts")).toBeNull();
    expect(screen.queryByTestId("list-admin-alerts")).toBeNull();
  });

  it("filters alerts by severity and source", async () => {
    renderPage({
      isAdmin: true,
      notifications: [
        makeAlert("a1", { source: "heygen", severity: "error", title: "HeyGen down" }),
        makeAlert("a2", { source: "heygen", severity: "warning", title: "HeyGen drift" }),
        makeAlert("a3", { source: "luma", severity: "error", title: "Luma down" }),
        makeAlert("ignored", { source: "heygen", severity: "error", title: "Other" }, "board_invite"),
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId("list-admin-alerts")).not.toBeNull();
    });

    expect(screen.getByTestId("row-admin-alert-a1")).not.toBeNull();
    expect(screen.getByTestId("row-admin-alert-a2")).not.toBeNull();
    expect(screen.getByTestId("row-admin-alert-a3")).not.toBeNull();
    expect(screen.queryByTestId("row-admin-alert-ignored")).toBeNull();

    const severityTrigger = screen.getByTestId("select-admin-alerts-severity");
    await act(async () => {
      fireEvent.keyDown(severityTrigger, { key: "Enter" });
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId("option-severity-error"));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("row-admin-alert-a2")).toBeNull();
    });
    expect(screen.getByTestId("row-admin-alert-a1")).not.toBeNull();
    expect(screen.getByTestId("row-admin-alert-a3")).not.toBeNull();

    const sourceTrigger = screen.getByTestId("select-admin-alerts-source");
    await act(async () => {
      fireEvent.keyDown(sourceTrigger, { key: "Enter" });
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId("option-source-heygen"));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("row-admin-alert-a3")).toBeNull();
    });
    expect(screen.getByTestId("row-admin-alert-a1")).not.toBeNull();
    expect(screen.getByTestId("badge-admin-alerts-count").textContent).toContain("1");
  });

  it("expands the context JSON block when present and omits it when absent", async () => {
    renderPage({
      isAdmin: true,
      notifications: [
        makeAlert("with-ctx", {
          source: "heygen",
          severity: "error",
          title: "with context",
          context: { endpoint: "/v2/avatar_group.list", attempt: 3 },
        }),
        makeAlert("no-ctx", {
          source: "heygen",
          severity: "error",
          title: "no context",
        }),
      ],
    });

    const toggle = await screen.findByTestId("toggle-admin-alert-context-with-ctx");
    expect(screen.queryByTestId("toggle-admin-alert-context-no-ctx")).toBeNull();

    const details = toggle.closest("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });

    const pre = screen.getByTestId("text-admin-alert-context-with-ctx");
    expect(pre.textContent).toContain("/v2/avatar_group.list");
    expect(pre.textContent).toContain("\"attempt\": 3");
  });

  it("renders the empty state when no alerts match the filters", async () => {
    renderPage({
      isAdmin: true,
      notifications: [
        makeAlert("a1", { source: "heygen", severity: "warning", title: "HeyGen drift" }),
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId("row-admin-alert-a1")).not.toBeNull();
    });

    const severityTrigger = screen.getByTestId("select-admin-alerts-severity");
    await act(async () => {
      fireEvent.keyDown(severityTrigger, { key: "Enter" });
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId("option-severity-error"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("text-admin-alerts-empty")).not.toBeNull();
    });
    expect(screen.queryByTestId("list-admin-alerts")).toBeNull();
    expect(screen.getByTestId("badge-admin-alerts-count").textContent).toContain("0");
  });
});
