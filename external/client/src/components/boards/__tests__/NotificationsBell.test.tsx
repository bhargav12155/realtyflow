import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Notification } from "@shared/schema";

const notificationsRef: { current: Notification[] } = { current: [] };
const snoozeResponseRef: { current: { until: string | null } } = {
  current: { until: null },
};
const queryClientRef: { current: QueryClient | null } = { current: null };
const apiRequestMock = vi.fn(async () => ({}));

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
    getQueryFn:
      () =>
      async ({ queryKey }: { queryKey: readonly unknown[] }) => {
        const key = String(queryKey[0]);
        if (key === "/api/notifications/admin-alert-snooze") {
          return snoozeResponseRef.current;
        }
        return notificationsRef.current;
      },
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u-admin", email: "a@b.c", name: "Admin" } }),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({}),
}));

import { NotificationsBell } from "../NotificationsBell";

function renderBell() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        queryFn: async ({ queryKey }) => {
          const key = String(queryKey[0]);
          if (key === "/api/notifications/admin-alert-snooze") {
            return snoozeResponseRef.current;
          }
          return notificationsRef.current;
        },
      },
      mutations: { retry: false },
    },
  });
  queryClientRef.current = qc;
  return render(
    <QueryClientProvider client={qc}>
      <NotificationsBell />
    </QueryClientProvider>,
  );
}

function makeAdminAlert(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n-1",
    userId: "u-admin",
    type: "admin_alert",
    isRead: false,
    createdAt: new Date().toISOString() as unknown as Date,
    data: {
      source: "heygen",
      severity: "error",
      title: "HeyGen response failed schema validation",
      message: "drift detected on /v2/avatar_group.list",
      context: { endpoint: "/v2/avatar_group.list" },
    },
    ...overrides,
  } as unknown as Notification;
}

afterEach(() => {
  cleanup();
  notificationsRef.current = [];
  snoozeResponseRef.current = { until: null };
  queryClientRef.current = null;
  apiRequestMock.mockClear();
});

function makeUnshare(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n-unshare",
    userId: "u-admin",
    type: "board_unshared",
    isRead: false,
    createdAt: new Date().toISOString() as unknown as Date,
    data: {
      boardId: "brd_42",
      boardTitle: "Quarterly Plan",
      removedByUserId: "owner-1",
      removedByName: "Owner Person",
    },
    ...overrides,
  } as unknown as Notification;
}

describe("NotificationsBell board_unshared rendering", () => {
  it("renders the remover name in the title and the board title in the subtitle", async () => {
    notificationsRef.current = [makeUnshare()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    const item = await screen.findByTestId("notification-n-unshare");
    expect(item.textContent).toContain("Owner Person removed your access to a board");
    expect(item.textContent).toContain("Quarterly Plan");
  });

  it("falls back to 'Someone' / 'Untitled board' when the payload omits names", async () => {
    notificationsRef.current = [
      makeUnshare({
        id: "n-bare",
        data: { boardId: "brd_99" },
      } as Partial<Notification>),
    ];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    const item = await screen.findByTestId("notification-n-bare");
    expect(item.textContent).toContain("Someone removed your access to a board");
    expect(item.textContent).toContain("Untitled board");
  });

  it("dismisses the entry on click by POSTing to the read endpoint (no deep-link nav)", async () => {
    notificationsRef.current = [makeUnshare()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    fireEvent.click(await screen.findByTestId("button-notification-open-n-unshare"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/notifications/n-unshare/read",
    );
  });

  it("dismisses the entry when the X dismiss button is clicked", async () => {
    notificationsRef.current = [makeUnshare()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    fireEvent.click(await screen.findByTestId("button-notification-dismiss-n-unshare"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/notifications/n-unshare/read",
    );
  });
});

function makeLeft(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n-left",
    userId: "u-admin",
    type: "board_left",
    isRead: false,
    createdAt: new Date().toISOString() as unknown as Date,
    data: {
      boardId: "brd_42",
      boardTitle: "Roadmap",
      leftByUserId: "rec-2",
      leftByName: "Recipient Person",
    },
    ...overrides,
  } as unknown as Notification;
}

describe("NotificationsBell board_left rendering", () => {
  it("renders the leaver name in the title and the board title in the subtitle", async () => {
    notificationsRef.current = [makeLeft()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    const item = await screen.findByTestId("notification-n-left");
    expect(item.textContent).toContain("Recipient Person left your shared board");
    expect(item.textContent).toContain("Roadmap");
  });

  it("falls back to 'Someone' / 'Untitled board' when the payload omits names", async () => {
    notificationsRef.current = [
      makeLeft({
        id: "n-left-bare",
        data: { boardId: "brd_99" },
      } as Partial<Notification>),
    ];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    const item = await screen.findByTestId("notification-n-left-bare");
    expect(item.textContent).toContain("Someone left your shared board");
    expect(item.textContent).toContain("Untitled board");
  });

  it("dismisses the entry on click by POSTing to the read endpoint", async () => {
    notificationsRef.current = [makeLeft()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    fireEvent.click(await screen.findByTestId("button-notification-open-n-left"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/notifications/n-left/read",
    );
  });

  it("dismisses the entry when the X dismiss button is clicked", async () => {
    notificationsRef.current = [makeLeft()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    fireEvent.click(await screen.findByTestId("button-notification-dismiss-n-left"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/notifications/n-left/read",
    );
  });
});

describe("NotificationsBell admin_alert rendering", () => {
  beforeEach(() => {
    notificationsRef.current = [makeAdminAlert()];
  });

  it("renders severity badge, source, title, message and the AlertTriangle icon", async () => {
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    const badge = await screen.findByTestId("badge-admin-alert-severity-n-1");
    expect(badge.textContent).toBe("Error");

    const source = screen.getByTestId("text-admin-alert-source-n-1");
    expect(source.textContent).toBe("heygen");

    const title = screen.getByTestId("text-admin-alert-title-n-1");
    expect(title.textContent).toBe("HeyGen response failed schema validation");

    const message = screen.getByTestId("text-admin-alert-message-n-1");
    expect(message.textContent).toBe("drift detected on /v2/avatar_group.list");

    const icon = screen.getByTestId("icon-admin-alert-n-1");
    // lucide-react renders an SVG; the AlertTriangle has the lucide class.
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("class") ?? "").toMatch(/lucide-(triangle-alert|alert-triangle)/);
  });

  it("uses the warning severity label/style when payload severity is warning", async () => {
    notificationsRef.current = [
      makeAdminAlert({
        id: "n-warn",
        data: {
          source: "heygen",
          severity: "warning",
          title: "soft drift",
          message: "non-fatal",
        },
      } as Partial<Notification>),
    ];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    const badge = await screen.findByTestId("badge-admin-alert-severity-n-warn");
    expect(badge.textContent).toBe("Warning");
  });

  it("falls back to a default title when the payload omits one and hides message when absent", async () => {
    notificationsRef.current = [
      makeAdminAlert({
        id: "n-bare",
        data: { source: "heygen", severity: "info" },
      } as Partial<Notification>),
    ];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    expect((await screen.findByTestId("text-admin-alert-title-n-bare")).textContent).toBe(
      "Admin alert",
    );
    expect(screen.queryByTestId("text-admin-alert-message-n-bare")).toBeNull();
  });
});

describe("NotificationsBell admin_alert clear + snooze controls", () => {
  it("hides the admin alert controls when no admin_alert notifications exist", async () => {
    notificationsRef.current = [makeUnshare()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    // Panel renders; the admin-only controls bar must not.
    await screen.findByTestId("panel-notifications");
    expect(screen.queryByTestId("panel-admin-alert-controls")).toBeNull();
    expect(screen.queryByTestId("button-clear-admin-alerts")).toBeNull();
    expect(screen.queryByTestId("button-admin-alert-snooze-1h")).toBeNull();
    expect(screen.queryByTestId("button-admin-alert-snooze-24h")).toBeNull();
  });

  it("shows the controls when at least one admin_alert exists, even if it's already read", async () => {
    notificationsRef.current = [
      makeAdminAlert({
        id: "n-read",
        isRead: true,
      } as Partial<Notification>),
    ];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    await screen.findByTestId("panel-admin-alert-controls");
    // The clear button is rendered but disabled because there are zero
    // unread admin_alert rows to dismiss.
    const clearBtn = screen.getByTestId(
      "button-clear-admin-alerts",
    ) as HTMLButtonElement;
    expect(clearBtn.disabled).toBe(true);
    expect(clearBtn.textContent).toBe("Clear admin alerts");
    // The two snooze buttons are visible (no active snooze).
    expect(screen.getByTestId("button-admin-alert-snooze-1h")).toBeTruthy();
    expect(screen.getByTestId("button-admin-alert-snooze-24h")).toBeTruthy();
  });

  it("Clear admin alerts POSTs to /api/notifications/clear-by-type with the admin_alert type", async () => {
    notificationsRef.current = [makeAdminAlert(), makeAdminAlert({ id: "n-2" })];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    const clearBtn = await screen.findByTestId("button-clear-admin-alerts");
    expect(clearBtn.textContent).toBe("Clear admin alerts (2)");
    fireEvent.click(clearBtn);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "POST",
        "/api/notifications/clear-by-type",
        { type: "admin_alert" },
      ),
    );
  });

  it("clicking 1h posts a 60-minute snooze and clicking 24h posts a 24h snooze", async () => {
    notificationsRef.current = [makeAdminAlert()];
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    fireEvent.click(await screen.findByTestId("button-admin-alert-snooze-1h"));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "POST",
        "/api/notifications/admin-alert-snooze",
        { minutes: 60 },
      ),
    );

    apiRequestMock.mockClear();
    fireEvent.click(screen.getByTestId("button-admin-alert-snooze-24h"));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "POST",
        "/api/notifications/admin-alert-snooze",
        { minutes: 24 * 60 },
      ),
    );
  });

  it("renders the snoozed-until label and an unsnooze button when the snooze query has a future until (i.e. survives a refresh)", async () => {
    notificationsRef.current = [makeAdminAlert()];
    snoozeResponseRef.current = {
      until: new Date(Date.now() + 60 * 60_000).toISOString(),
    };
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    // Snoozed UI replaces the 1h/24h buttons.
    await screen.findByTestId("text-admin-alert-snoozed-until");
    expect(screen.queryByTestId("button-admin-alert-snooze-1h")).toBeNull();
    expect(screen.queryByTestId("button-admin-alert-snooze-24h")).toBeNull();

    // Unsnooze posts a null/0 minute value to clear the window.
    fireEvent.click(screen.getByTestId("button-admin-alert-snooze-clear"));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "POST",
        "/api/notifications/admin-alert-snooze",
        { minutes: null },
      ),
    );
  });

  it("treats a past snooze 'until' as not snoozed and shows the 1h/24h options again", async () => {
    notificationsRef.current = [makeAdminAlert()];
    snoozeResponseRef.current = {
      until: new Date(Date.now() - 60_000).toISOString(),
    };
    renderBell();
    fireEvent.click(await screen.findByTestId("button-notifications"));

    await screen.findByTestId("button-admin-alert-snooze-1h");
    expect(screen.queryByTestId("text-admin-alert-snoozed-until")).toBeNull();
    expect(screen.queryByTestId("button-admin-alert-snooze-clear")).toBeNull();
  });
});
