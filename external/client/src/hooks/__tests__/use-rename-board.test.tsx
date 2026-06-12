import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { BoardSummary } from "@/components/boards/BoardCard";

// Mirror the pattern used by board-detail-inline-rename.test.tsx: share a
// single QueryClient between the mocked "@/lib/queryClient" module and the
// <QueryClientProvider> wrapping the hook so optimistic setQueryData /
// rollback writes inside the mutation hit the same store the test inspects.
const { apiRequestMock, toastMock, sharedQueryClient } = vi.hoisted(() => {
  const { QueryClient } =
    require("@tanstack/react-query") as typeof import("@tanstack/react-query");
  return {
    apiRequestMock: vi.fn(),
    toastMock: vi.fn(),
    sharedQueryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
  };
});

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: sharedQueryClient,
  getQueryFn: () => async () => null,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { useRenameBoardMutation } from "@/hooks/use-rename-board";

const BOARD_ID = "board-1";
const OTHER_ID = "board-2";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={sharedQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

function seedList(): BoardSummary[] {
  return [
    { id: BOARD_ID, title: "Original", isOwner: true },
    { id: OTHER_ID, title: "Untouched", isOwner: true },
  ];
}

function seedDetail() {
  return { id: BOARD_ID, title: "Original", isOwner: true, extra: "keep" };
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  sharedQueryClient.clear();
  // Default invalidate-on-settle would otherwise refetch with the default
  // (jsdom-network) queryFn and noisily warn. Stub it to a no-op that
  // simply echoes the cached title back for any board key.
  sharedQueryClient.setDefaultOptions({
    queries: {
      retry: false,
      queryFn: async ({ queryKey }) => {
        const [base, id] = queryKey as [string, string?];
        if (base === "/api/boards" && !id) {
          return sharedQueryClient.getQueryData(["/api/boards"]) ?? [];
        }
        if (base === "/api/boards" && id) {
          return sharedQueryClient.getQueryData(["/api/boards", id]) ?? null;
        }
        return null;
      },
    },
    mutations: { retry: false },
  });
});

afterEach(() => {
  cleanup();
});

describe("useRenameBoardMutation", () => {
  it("optimistically patches both the list and detail caches when both are populated", async () => {
    apiRequestMock.mockImplementation(async () => ({
      json: async () => ({ id: BOARD_ID, title: "New title" }),
    }));
    sharedQueryClient.setQueryData<BoardSummary[]>(["/api/boards"], seedList());
    sharedQueryClient.setQueryData(["/api/boards", BOARD_ID], seedDetail());

    const { result } = renderHook(() => useRenameBoardMutation(), { wrapper });

    result.current.mutate({ boardId: BOARD_ID, title: "New title" });

    // Optimistic writes land synchronously after onMutate resolves: wait for
    // the patched title in both caches before the PATCH promise settles.
    await waitFor(() => {
      const list = sharedQueryClient.getQueryData<BoardSummary[]>([
        "/api/boards",
      ]);
      expect(list?.find((b) => b.id === BOARD_ID)?.title).toBe("New title");
      // Sibling entry is untouched.
      expect(list?.find((b) => b.id === OTHER_ID)?.title).toBe("Untouched");
      const detail = sharedQueryClient.getQueryData<{
        title: string;
        extra: string;
      }>(["/api/boards", BOARD_ID]);
      expect(detail?.title).toBe("New title");
      // Other detail fields are preserved through the optimistic merge.
      expect(detail?.extra).toBe("keep");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Success path emits the "Board renamed" toast exactly once.
    const successToasts = toastMock.mock.calls.filter(
      ([arg]) => (arg as { title?: string })?.title === "Board renamed",
    );
    expect(successToasts).toHaveLength(1);
  });

  it("skips the optimistic write for whichever cache is empty", async () => {
    apiRequestMock.mockImplementation(async () => ({
      json: async () => ({ id: BOARD_ID, title: "Detail only" }),
    }));
    // Only the detail cache is populated; the list cache is intentionally
    // left empty (e.g. user navigated straight to /boards/:id).
    sharedQueryClient.setQueryData(["/api/boards", BOARD_ID], seedDetail());

    const { result, unmount } = renderHook(() => useRenameBoardMutation(), {
      wrapper,
    });

    result.current.mutate({ boardId: BOARD_ID, title: "Detail only" });
    await waitFor(() => {
      const detail = sharedQueryClient.getQueryData<{ title: string }>([
        "/api/boards",
        BOARD_ID,
      ]);
      expect(detail?.title).toBe("Detail only");
    });
    // The hook must NOT seed an empty list cache with the optimistic value.
    expect(sharedQueryClient.getQueryData(["/api/boards"])).toBeUndefined();
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    unmount();
    cleanup();

    // Reverse case: list populated, detail empty.
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async () => ({
      json: async () => ({ id: BOARD_ID, title: "List only" }),
    }));
    sharedQueryClient.clear();
    sharedQueryClient.setQueryData<BoardSummary[]>(["/api/boards"], seedList());

    const { result: result2 } = renderHook(() => useRenameBoardMutation(), {
      wrapper,
    });
    result2.current.mutate({ boardId: BOARD_ID, title: "List only" });
    await waitFor(() => {
      const list = sharedQueryClient.getQueryData<BoardSummary[]>([
        "/api/boards",
      ]);
      expect(list?.find((b) => b.id === BOARD_ID)?.title).toBe("List only");
    });
    expect(
      sharedQueryClient.getQueryData(["/api/boards", BOARD_ID]),
    ).toBeUndefined();
    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });
  });

  it("rolls both caches back and toasts an error message when PATCH fails", async () => {
    apiRequestMock.mockImplementation(async () => {
      throw new Error("500: Internal Server Error");
    });
    const originalList = seedList();
    const originalDetail = seedDetail();
    sharedQueryClient.setQueryData<BoardSummary[]>(
      ["/api/boards"],
      originalList,
    );
    sharedQueryClient.setQueryData(["/api/boards", BOARD_ID], originalDetail);

    const { result } = renderHook(() => useRenameBoardMutation(), { wrapper });
    result.current.mutate({ boardId: BOARD_ID, title: "Will fail" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Both caches are restored to the pre-mutation snapshot.
    const list = sharedQueryClient.getQueryData<BoardSummary[]>([
      "/api/boards",
    ]);
    expect(list?.find((b) => b.id === BOARD_ID)?.title).toBe("Original");
    const detail = sharedQueryClient.getQueryData<{
      title: string;
      extra: string;
    }>(["/api/boards", BOARD_ID]);
    expect(detail?.title).toBe("Original");
    expect(detail?.extra).toBe("keep");

    // Error toast strips the "<status>: " prefix from the thrown message.
    const errorToast = toastMock.mock.calls.find(
      ([arg]) =>
        (arg as { title?: string })?.title === "Couldn't rename board",
    );
    expect(errorToast).toBeDefined();
    const arg = errorToast?.[0] as {
      description?: string;
      variant?: string;
    };
    expect(arg?.description).toBe("Internal Server Error");
    expect(arg?.variant).toBe("destructive");
    // Success toast must not have fired.
    expect(
      toastMock.mock.calls.some(
        ([a]) => (a as { title?: string })?.title === "Board renamed",
      ),
    ).toBe(false);
  });

  it("toasts 'Board renamed' and invalidates both caches on success", async () => {
    apiRequestMock.mockImplementation(async () => ({
      json: async () => ({ id: BOARD_ID, title: "Renamed" }),
    }));
    sharedQueryClient.setQueryData<BoardSummary[]>(["/api/boards"], seedList());
    sharedQueryClient.setQueryData(["/api/boards", BOARD_ID], seedDetail());

    const invalidateSpy = vi.spyOn(sharedQueryClient, "invalidateQueries");

    const { result } = renderHook(() => useRenameBoardMutation(), { wrapper });
    result.current.mutate({ boardId: BOARD_ID, title: "Renamed" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(
      toastMock.mock.calls.some(
        ([arg]) => (arg as { title?: string })?.title === "Board renamed",
      ),
    ).toBe(true);

    // onSettled invalidates BOTH the list cache and the per-board detail
    // cache so the home grid and the detail page reconcile with the server.
    const invalidatedKeys = invalidateSpy.mock.calls.map(
      ([arg]) => (arg as { queryKey: unknown[] })?.queryKey,
    );
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ["/api/boards"],
        ["/api/boards", BOARD_ID],
      ]),
    );

    invalidateSpy.mockRestore();
  });
});
