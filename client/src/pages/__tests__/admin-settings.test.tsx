import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();
const toastMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueriesMock(...args),
    setQueryData: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isAuthenticated: true }),
}));
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: () => <div data-testid="stub-sidebar" />,
}));

import AdminSettingsPage from "@/pages/admin-settings";

type QueryResponses = {
  isAdmin: boolean;
  settings?: {
    enabled: boolean;
    webhookUrl: string | null;
  };
  source?: "admin" | "env" | "default";
  envFallbackConfigured?: boolean;
};

function renderPage(responses: QueryResponses) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base] = queryKey as [string];
          if (base === "/api/user/is-admin") {
            return { isAdmin: responses.isAdmin };
          }
          if (base === "/api/admin/heygen-alerts/settings") {
            return {
              settings: responses.settings ?? {
                enabled: false,
                webhookUrl: null,
              },
              source: responses.source ?? "default",
              envFallbackConfigured: responses.envFallbackConfigured ?? false,
            };
          }
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  const { hook, history } = memoryLocation({ path: "/admin/settings", record: true });
  const utils = render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/admin/settings" component={AdminSettingsPage} />
        <Route path="/dashboard">
          <div data-testid="stub-dashboard">dashboard</div>
        </Route>
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, history };
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  invalidateQueriesMock.mockReset();
  apiRequestMock.mockResolvedValue({ json: async () => ({}) });
});
afterEach(() => cleanup());

describe("AdminSettingsPage", () => {
  it("redirects non-admin users away to /dashboard", async () => {
    renderPage({ isAdmin: false });
    await waitFor(() => {
      expect(screen.queryByTestId("stub-dashboard")).not.toBeNull();
    });
    // The HeyGen alerts panel must NOT have rendered for non-admins.
    expect(screen.queryByTestId("card-heygen-alerts-settings")).toBeNull();
  });

  it("pre-fills the form from the GET response and shows the source label", async () => {
    renderPage({
      isAdmin: true,
      settings: { enabled: true, webhookUrl: "https://hooks.slack.com/services/T/B/C" },
      source: "admin",
      envFallbackConfigured: true,
    });

    const input = (await waitFor(() =>
      screen.getByTestId("input-heygen-webhook-url"),
    )) as HTMLInputElement;
    expect(input.value).toBe("https://hooks.slack.com/services/T/B/C");

    const switchEl = screen.getByTestId("switch-heygen-alerts-enabled");
    expect(switchEl.getAttribute("aria-checked") ?? switchEl.getAttribute("data-state")).toMatch(
      /true|checked/,
    );

    expect(screen.getByTestId("badge-heygen-alerts-source").textContent).toContain(
      "Admin-configured",
    );
    expect(screen.getByTestId("text-heygen-alerts-env-note")).not.toBeNull();
  });

  it("'Test & save' sends skipTest: false to the PUT endpoint", async () => {
    renderPage({
      isAdmin: true,
      settings: { enabled: false, webhookUrl: "https://hooks.slack.com/services/A/B/C" },
      source: "admin",
    });

    const saveBtn = await waitFor(() => screen.getByTestId("button-save-heygen-alerts"));
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    const [method, url, body] = apiRequestMock.mock.calls[0];
    expect(method).toBe("PUT");
    expect(url).toBe("/api/admin/heygen-alerts/settings");
    expect(body).toEqual({
      enabled: false,
      webhookUrl: "https://hooks.slack.com/services/A/B/C",
      skipTest: false,
    });
  });

  it("'Save without test' sends skipTest: true and uses the current form values", async () => {
    renderPage({
      isAdmin: true,
      settings: { enabled: false, webhookUrl: null },
      source: "default",
    });

    const input = (await waitFor(() =>
      screen.getByTestId("input-heygen-webhook-url"),
    )) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://hooks.slack.com/services/X/Y/Z" },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("switch-heygen-alerts-enabled"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-save-heygen-alerts-skip-test"));
    });

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    const [method, url, body] = apiRequestMock.mock.calls[0];
    expect(method).toBe("PUT");
    expect(url).toBe("/api/admin/heygen-alerts/settings");
    expect(body).toEqual({
      enabled: true,
      webhookUrl: "https://hooks.slack.com/services/X/Y/Z",
      skipTest: true,
    });
  });
});
