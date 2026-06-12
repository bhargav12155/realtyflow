import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  downloadFile: vi.fn(),
  getQueryFn: () => async () => ({ runs: [] }),
}));

import { HeygenShapeDriftRetentionRunsPanel } from "@/components/dashboard/heygen-shape-drift-incidents";

const realFetch = global.fetch;

function makeClient(queryFn: (url: string) => Promise<unknown>) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const url = (queryKey as string[]).join("/");
          return queryFn(url);
        },
      },
      mutations: { retry: false },
    },
  });
}

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
});

describe("HeygenShapeDriftRetentionRunsPanel — render states", () => {
  it("shows the loading skeleton while the runs query is in flight", async () => {
    let resolveQuery: (value: unknown) => void = () => {};
    const pending = new Promise<unknown>((resolve) => {
      resolveQuery = resolve;
    });
    const qc = makeClient(() => pending as Promise<unknown>);

    render(
      <QueryClientProvider client={qc}>
        <HeygenShapeDriftRetentionRunsPanel />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("loading-heygen-retention-runs")).toBeTruthy();
    expect(screen.queryByTestId("error-heygen-retention-runs")).toBeNull();
    expect(screen.queryByTestId("empty-heygen-retention-runs")).toBeNull();
    expect(screen.queryByTestId("alert-heygen-retention-stale")).toBeNull();

    resolveQuery({ runs: [] });
    await waitFor(() =>
      expect(screen.queryByTestId("loading-heygen-retention-runs")).toBeNull(),
    );
  });

  it("shows the error state with the upstream error text when the request fails", async () => {
    const qc = makeClient(async () => {
      throw new Error("HTTP 500: upstream boom");
    });

    render(
      <QueryClientProvider client={qc}>
        <HeygenShapeDriftRetentionRunsPanel />
      </QueryClientProvider>,
    );

    const err = await waitFor(() =>
      screen.getByTestId("error-heygen-retention-runs"),
    );
    expect(err.textContent).toContain("Failed to load retention runs");
    expect(err.textContent).toContain("HTTP 500: upstream boom");
    expect(screen.queryByTestId("loading-heygen-retention-runs")).toBeNull();
    expect(screen.queryByTestId("empty-heygen-retention-runs")).toBeNull();
  });

  it("shows the empty state copy and the no-run stale alert when zero runs are returned", async () => {
    const qc = makeClient(async () => ({ runs: [] }));

    render(
      <QueryClientProvider client={qc}>
        <HeygenShapeDriftRetentionRunsPanel />
      </QueryClientProvider>,
    );

    const empty = await waitFor(() =>
      screen.getByTestId("empty-heygen-retention-runs"),
    );
    expect(empty.textContent).toContain(
      "No retention sweeps recorded yet",
    );

    const alert = screen.getByTestId("alert-heygen-retention-stale");
    expect(alert).toBeTruthy();
    const message = screen.getByTestId("text-heygen-retention-stale-message");
    expect(message.textContent).toContain(
      "No retention sweep has been recorded yet",
    );
  });
});
