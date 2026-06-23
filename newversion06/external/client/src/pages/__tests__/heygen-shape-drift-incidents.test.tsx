import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { invalidateQueriesMock } = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: invalidateQueriesMock },
  getQueryFn: () => async () => null,
}));

import { HeygenShapeDriftIncidentsPanel } from "@/components/dashboard/heygen-shape-drift-incidents";
import type { HeygenShapeDriftIncident } from "@shared/schema";

type QueryFnResult =
  | { kind: "data"; value: { incidents: HeygenShapeDriftIncident[] } }
  | { kind: "error"; message: string }
  | { kind: "pending" };

let queryResult: QueryFnResult = { kind: "pending" };

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => {
          if (queryResult.kind === "data") return queryResult.value;
          if (queryResult.kind === "error") throw new Error(queryResult.message);
          return new Promise(() => {});
        },
      },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <HeygenShapeDriftIncidentsPanel />
    </QueryClientProvider>,
  );
}

const fixedDate = new Date("2026-04-23T12:00:00Z");

function makeIncident(
  overrides: Partial<HeygenShapeDriftIncident> = {},
): HeygenShapeDriftIncident {
  return {
    id: "i1",
    endpoint: "/v3/voices",
    issuePaths: ["data.0.voice_id", "data.1.gender"],
    message: "HeygenResponseValidationError: voice_id must be a string",
    userId: "user-alpha",
    groupId: null,
    createdAt: fixedDate,
    ...overrides,
  } as HeygenShapeDriftIncident;
}

beforeEach(() => {
  invalidateQueriesMock.mockReset();
  queryResult = { kind: "pending" };
});
afterEach(() => cleanup());

describe("HeygenShapeDriftIncidentsPanel", () => {
  it("renders the loading skeleton while the incidents query is pending", async () => {
    queryResult = { kind: "pending" };
    renderPanel();
    expect(screen.getByTestId("loading-heygen-incidents")).not.toBeNull();
    expect(screen.queryByTestId("error-heygen-incidents")).toBeNull();
    expect(screen.queryByTestId("empty-heygen-incidents")).toBeNull();
  });

  it("renders the empty state when no incidents have been recorded", async () => {
    queryResult = { kind: "data", value: { incidents: [] } };
    renderPanel();
    const empty = await waitFor(() =>
      screen.getByTestId("empty-heygen-incidents"),
    );
    expect(empty.textContent).toMatch(/No HeyGen shape-drift incidents/i);
  });

  it("renders the error state when the request fails", async () => {
    queryResult = { kind: "error", message: "boom failed" };
    renderPanel();
    const err = await waitFor(() =>
      screen.getByTestId("error-heygen-incidents"),
    );
    expect(err.textContent).toMatch(/boom failed/);
  });

  it("renders rows for a populated incidents response and supports filtering and row expansion", async () => {
    const incidents: HeygenShapeDriftIncident[] = [
      makeIncident({
        id: "i-voices",
        endpoint: "/v3/voices",
        userId: "user-alpha",
        issuePaths: ["data.0.voice_id"],
        message: "voice_id must be a string",
      }),
      makeIncident({
        id: "i-looks",
        endpoint: "/v3/photo_avatars/abc/looks",
        userId: "user-bravo",
        groupId: "abc",
        issuePaths: ["data.0.id", "data.0.image_url"],
        message: "looks payload missing required fields",
      }),
      makeIncident({
        id: "i-anon",
        endpoint: "/v3/avatars",
        userId: null,
        issuePaths: [],
        message: "avatars list malformed",
      }),
    ];
    queryResult = { kind: "data", value: { incidents } };
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("row-heygen-incident-i-voices")).not.toBeNull();
      expect(screen.getByTestId("row-heygen-incident-i-looks")).not.toBeNull();
      expect(screen.getByTestId("row-heygen-incident-i-anon")).not.toBeNull();
    });

    // Endpoint filter narrows to the matching row.
    fireEvent.change(screen.getByTestId("input-filter-heygen-endpoint"), {
      target: { value: "looks" },
    });
    await waitFor(() => {
      expect(screen.queryByTestId("row-heygen-incident-i-voices")).toBeNull();
      expect(screen.queryByTestId("row-heygen-incident-i-anon")).toBeNull();
      expect(screen.getByTestId("row-heygen-incident-i-looks")).not.toBeNull();
    });

    // Clear endpoint filter; user-id filter narrows to alpha only and excludes
    // the anonymous (null userId) incident.
    fireEvent.change(screen.getByTestId("input-filter-heygen-endpoint"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("input-filter-heygen-user"), {
      target: { value: "alpha" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("row-heygen-incident-i-voices")).not.toBeNull();
      expect(screen.queryByTestId("row-heygen-incident-i-looks")).toBeNull();
      expect(screen.queryByTestId("row-heygen-incident-i-anon")).toBeNull();
    });

    // A filter combination that matches nothing surfaces the "no matches" empty copy.
    fireEvent.change(screen.getByTestId("input-filter-heygen-endpoint"), {
      target: { value: "nope-no-match" },
    });
    await waitFor(() => {
      const empty = screen.getByTestId("empty-heygen-incidents");
      expect(empty.textContent).toMatch(/No incidents match the current filters/i);
    });

    // Reset filters and expand the looks incident; issue paths + full message become visible.
    fireEvent.change(screen.getByTestId("input-filter-heygen-endpoint"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("input-filter-heygen-user"), {
      target: { value: "" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("row-heygen-incident-i-looks")).not.toBeNull();
    });

    expect(screen.queryByTestId("row-heygen-incident-details-i-looks")).toBeNull();
    fireEvent.click(
      screen.getByTestId("button-expand-heygen-incident-i-looks"),
    );

    const details = await waitFor(() =>
      screen.getByTestId("row-heygen-incident-details-i-looks"),
    );
    const scope = within(details);
    expect(
      scope.getByTestId("badge-heygen-incident-issue-i-looks-0").textContent,
    ).toBe("data.0.id");
    expect(
      scope.getByTestId("badge-heygen-incident-issue-i-looks-1").textContent,
    ).toBe("data.0.image_url");
    expect(
      scope.getByTestId("text-heygen-incident-message-i-looks").textContent,
    ).toBe("looks payload missing required fields");
  });
});
