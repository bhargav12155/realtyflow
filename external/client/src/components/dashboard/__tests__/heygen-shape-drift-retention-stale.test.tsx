import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  downloadFile: vi.fn(),
  getQueryFn: () => async () => ({ runs: [] }),
}));

import {
  HeygenShapeDriftRetentionRunsPanel,
  STALE_RUN_THRESHOLD_MS,
} from "@/components/dashboard/heygen-shape-drift-incidents";

const realFetch = global.fetch;

function renderPanel(runs: Array<{ id: string; deletedCount: number; retentionDays: number; createdAt: string }>) {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.startsWith("/api/v3/admin/heygen-shape-drift-retention-runs")) {
      return new Response(JSON.stringify({ runs }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response;
    }
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof fetch;

  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const url = (queryKey as string[]).join("/");
          const res = await fetch(url);
          return res.json();
        },
      },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <HeygenShapeDriftRetentionRunsPanel />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
});

describe("HeygenShapeDriftRetentionRunsPanel — stale alert", () => {
  it("does not show the stale alert for a fresh run", async () => {
    const fresh = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    renderPanel([
      { id: "run-fresh", deletedCount: 2, retentionDays: 30, createdAt: fresh },
    ]);

    await waitFor(() =>
      expect(screen.getByTestId("text-heygen-retention-last-run")).toBeTruthy(),
    );
    expect(screen.queryByTestId("alert-heygen-retention-stale")).toBeNull();
  });

  it("shows the stale alert with a duration when the last run is older than ~36h", async () => {
    const ageMs = STALE_RUN_THRESHOLD_MS + 5 * 60 * 60 * 1000; // ~41h
    const stale = new Date(Date.now() - ageMs).toISOString();
    renderPanel([
      { id: "run-stale", deletedCount: 0, retentionDays: 30, createdAt: stale },
    ]);

    const alert = await waitFor(() =>
      screen.getByTestId("alert-heygen-retention-stale"),
    );
    expect(alert).toBeTruthy();

    const message = screen.getByTestId("text-heygen-retention-stale-message");
    expect(message.textContent).toContain("ago");
    expect(message.textContent).toMatch(/\d+[dh]/);
    expect(message.textContent).toContain("36h");
  });

  it("shows the stale alert with the no-run-recorded wording when there are zero runs", async () => {
    renderPanel([]);

    const alert = await waitFor(() =>
      screen.getByTestId("alert-heygen-retention-stale"),
    );
    expect(alert).toBeTruthy();

    const message = screen.getByTestId("text-heygen-retention-stale-message");
    expect(message.textContent).toContain("No retention sweep has been recorded yet");
  });
});
