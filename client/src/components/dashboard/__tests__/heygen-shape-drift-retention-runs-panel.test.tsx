import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  downloadFile: vi.fn(),
  getQueryFn: () => async () => ({}),
}));

import { HeygenShapeDriftRetentionRunsPanel } from "@/components/dashboard/heygen-shape-drift-incidents";
import type { HeygenShapeDriftRetentionRun } from "@shared/schema";

const realFetch = global.fetch;

interface FetchedRunsResponse {
  runs: HeygenShapeDriftRetentionRun[];
}

function renderPanel(response: FetchedRunsResponse | { error: string }) {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/api/v3/admin/heygen-shape-drift-retention-runs")) {
      const isError = "error" in response;
      return new Response(JSON.stringify(response), {
        status: isError ? 500 : 200,
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
        // Mirror the app's default fetcher behaviour: GET the queryKey URL
        // and return its JSON body. Without this the panel would hang in
        // the loading state forever inside jsdom.
        queryFn: async ({ queryKey }) => {
          const url = Array.isArray(queryKey) ? String(queryKey[0]) : "";
          const r = await fetch(url);
          if (!r.ok) throw new Error(`${r.status}`);
          return await r.json();
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
});

describe("HeygenShapeDriftRetentionRunsPanel", () => {
  it("renders the table rows and the 'last run' summary when data loads", async () => {
    const runs: HeygenShapeDriftRetentionRun[] = [
      {
        id: "run-newest",
        deletedCount: 7,
        retentionDays: 30,
        createdAt: new Date("2026-04-22T12:34:56Z"),
      },
      {
        id: "run-older",
        deletedCount: 0,
        retentionDays: 30,
        createdAt: new Date("2026-04-21T12:34:56Z"),
      },
    ];

    renderPanel({ runs });

    // The "last run" summary should reflect the newest row (index 0).
    const lastRun = await waitFor(() =>
      screen.getByTestId("text-heygen-retention-last-run"),
    );
    expect(lastRun).toBeTruthy();
    const lastDeleted = screen.getByTestId("text-heygen-retention-last-deleted");
    expect(lastDeleted.textContent).toBe("7");

    // Both rows render with their per-row deleted/retention cells.
    expect(screen.getByTestId("row-heygen-retention-run-run-newest")).toBeTruthy();
    expect(screen.getByTestId("row-heygen-retention-run-run-older")).toBeTruthy();
    expect(
      screen.getByTestId("text-heygen-retention-deleted-run-newest").textContent,
    ).toBe("7");
    expect(
      screen.getByTestId("text-heygen-retention-deleted-run-older").textContent,
    ).toBe("0");
    expect(
      screen.getByTestId("text-heygen-retention-days-run-newest").textContent,
    ).toBe("30");

    // Empty-state placeholder must NOT be in the document when we have rows.
    expect(screen.queryByTestId("empty-heygen-retention-runs")).toBeNull();

    // Next sweep due = last run + 24h, formatted via toLocaleString().
    const nextDue = screen.getByTestId("text-heygen-retention-next-due");
    const expectedNext = new Date(
      new Date("2026-04-22T12:34:56Z").getTime() + 24 * 60 * 60 * 1000,
    ).toLocaleString();
    expect(nextDue.textContent).toBe(expectedNext);
  });

  it("renders the empty state when no retention sweeps have been recorded", async () => {
    renderPanel({ runs: [] });

    const empty = await waitFor(() =>
      screen.getByTestId("empty-heygen-retention-runs"),
    );
    expect(empty.textContent).toMatch(/no retention sweeps/i);
    // No "last run" summary when there's nothing to summarize.
    expect(screen.queryByTestId("text-heygen-retention-last-run")).toBeNull();
    // And no "next sweep due" timestamp either.
    expect(screen.queryByTestId("text-heygen-retention-next-due")).toBeNull();
  });

  it("renders an error banner when the GET endpoint fails", async () => {
    renderPanel({ error: "boom" });

    const err = await waitFor(() =>
      screen.getByTestId("error-heygen-retention-runs"),
    );
    expect(err.textContent).toMatch(/failed to load retention runs/i);
  });
});
