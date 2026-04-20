import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn() },
  getQueryFn: () => async () => [],
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com", name: "Tester" },
    isAuthenticated: true,
  }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null }),
}));
vi.mock("@/lib/businessContext", () => ({
  useBusinessType: () => ({
    businessType: "default",
    terms: {
      dashboardSubtitle: "subtitle",
      features: { aiContentGenerator: true, propertyTours: true },
    },
  }),
}));
vi.mock("@/lib/version", () => ({ VERSION_DISPLAY: "test" }));

const { Stub } = vi.hoisted(() => ({
  Stub: (name: string) => () => null,
}));
void Stub;

vi.mock("@/components/onboarding/onboarding-dialog", () => ({ OnboardingDialog: Stub("onboarding") }));
vi.mock("@/components/dashboard/ai-content-generator", () => ({ AIContentGenerator: Stub("ai-content") }));
vi.mock("@/components/dashboard/ai-search-optimizer", () => ({ AISearchOptimizer: Stub("ai-search") }));
vi.mock("@/components/dashboard/api-key-manager", () => ({ APIKeyManager: Stub("api-key") }));
vi.mock("@/components/dashboard/avatar-iv-studio", () => ({ AvatarIVStudio: Stub("avatar-iv") }));
vi.mock("@/components/dashboard/brand-settings", () => ({ BrandSettings: Stub("brand-settings") }));
vi.mock("@/components/dashboard/content-calendar", () => ({ ContentCalendar: Stub("calendar") }));
vi.mock("@/components/dashboard/local-market-tools", () => ({ LocalMarketTools: Stub("market") }));
vi.mock("@/components/dashboard/overview-cards", () => ({
  OverviewCards: Stub("overview-cards"),
  RecentPostActivity: Stub("recent-activity"),
}));
vi.mock("@/components/dashboard/photo-avatar-manager", () => ({ PhotoAvatarManager: Stub("photo-avatar") }));
vi.mock("@/components/dashboard/scheduled-posts-manager", () => ({ ScheduledPostsManager: Stub("scheduled-posts") }));
vi.mock("@/components/dashboard/seo-optimizer", () => ({ SEOOptimizer: Stub("seo") }));
vi.mock("@/components/dashboard/social-links-prompt", () => ({ SocialLinksPrompt: Stub("social-links") }));
vi.mock("@/components/dashboard/social-media-manager", () => ({ SocialMediaManager: Stub("social") }));
vi.mock("@/components/dashboard/streaming-avatar", () => ({ StreamingAvatarComponent: Stub("streaming-avatar") }));
vi.mock("@/components/dashboard/template-manager", () => ({ TemplateManager: Stub("template-manager") }));
vi.mock("@/components/dashboard/video-avatar-manager", () => ({ default: Stub("video-avatar-manager") }));
vi.mock("@/components/dashboard/video-generation-manager", () => ({ VideoGenerationManager: Stub("video-generation-manager") }));
vi.mock("@/components/dashboard/video-generator", () => ({ VideoGenerator: Stub("video-generator") }));
vi.mock("@/components/dashboard/video-studio", () => ({ VideoStudio: Stub("video-studio") }));
vi.mock("@/components/dashboard/video-templates", () => ({ VideoTemplates: Stub("video-templates") }));
vi.mock("@/components/dashboard/property-tour-studio", () => ({ PropertyTourStudio: Stub("property-tour") }));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: Stub("sidebar") }));
vi.mock("@/components/notifications/notification-panel", () => ({ NotificationPanel: Stub("notifications") }));
vi.mock("@/components/UserMenu", () => ({ default: Stub("user-menu") }));
vi.mock("@/components/boards/BoardsSidebar", () => ({ BoardsSidebar: Stub("boards-sidebar") }));

import Dashboard from "@/pages/dashboard";

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockImplementation((method: string, url: string) => {
    if (method === "POST" && url === "/api/boards") {
      return Promise.resolve(
        new Response(JSON.stringify({ id: "board-123", title: "New board", isShared: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
  });
});
afterEach(() => cleanup());

function renderDashboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const { hook, history } = memoryLocation({ path: "/dashboard", record: true });
  const utils = render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Dashboard />
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, history };
}

describe("Dashboard → Boards overlay flow", () => {
  it("opens overlay on Generate Content, creates a board on Enter, closes overlay and navigates to /boards/:id", async () => {
    const { history } = renderDashboard();

    expect(screen.queryByTestId("boards-overlay-content")).toBeNull();

    fireEvent.click(screen.getByTestId("button-generate-content"));

    const promptInput = (await screen.findByTestId("input-prompt")) as HTMLInputElement;
    expect(screen.getByTestId("boards-overlay-content")).toBeTruthy();

    fireEvent.change(promptInput, { target: { value: "make me a board" } });
    fireEvent.keyDown(promptInput, { key: "Enter", code: "Enter" });

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("POST", "/api/boards", {
        title: "make me a board",
        seedPrompt: "make me a board",
        seedMode: "plan",
      }),
    );

    await waitFor(() =>
      expect(history[history.length - 1]).toBe(`/boards/board-123?seed=make+me+a+board&chatMode=plan`),
    );
    await waitFor(() => expect(screen.queryByTestId("boards-overlay-content")).toBeNull());
  });

  it("opens overlay on Generate Content, clicking the Image quick-action chip creates a board with intent and navigates with intent param", async () => {
    const { history } = renderDashboard();

    fireEvent.click(screen.getByTestId("button-generate-content"));

    const chip = await screen.findByTestId("chip-intent-image");
    fireEvent.click(chip);

    await waitFor(() => {
      const postCalls = apiRequestMock.mock.calls.filter((c) => c[0] === "POST" && c[1] === "/api/boards");
      expect(postCalls.length).toBe(1);
      const body = postCalls[0][2] as Record<string, unknown>;
      expect(body.seedIntent).toBe("image");
      expect((body.seedPrompt as string).startsWith("Create an image of")).toBe(true);
    });

    await waitFor(() => {
      const last = history[history.length - 1] ?? "";
      expect(last.startsWith("/boards/board-123?")).toBe(true);
      expect(last).toContain("intent=image");
    });
    await waitFor(() => expect(screen.queryByTestId("boards-overlay-content")).toBeNull());
  });
});
