import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { BoardSummary } from "@/components/boards/BoardCard";

const apiRequestMock = vi.fn();
const queryClientRef: { current: QueryClient | null } = { current: null };

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
  };
});

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

import { useDeleteBoardMutation } from "../use-delete-board";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      // NOTE: do not set `gcTime: 0` here — it immediately garbage-collects
      // observerless queries, which would wipe the list cache we seed via
      // `setQueryData` before any optimistic update can be observed.
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  queryClientRef.current = qc;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  queryClientRef.current = null;
});

afterEach(() => cleanup());

describe("useDeleteBoardMutation", () => {
  const initialList: BoardSummary[] = [
    { id: "brd_1", title: "Alpha", isOwner: true },
    { id: "brd_2", title: "Beta", isOwner: true },
    { id: "brd_3", title: "Gamma", isOwner: true },
  ];

  it("optimistically removes the board from the list cache before the request resolves", async () => {
    let resolveDelete: (value: Response) => void = () => {};
    apiRequestMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const { qc, wrapper } = makeWrapper();
    qc.setQueryData<BoardSummary[]>(["/api/boards"], initialList);

    const { result } = renderHook(() => useDeleteBoardMutation(), { wrapper });
    result.current.mutate("brd_2");

    await waitFor(() => {
      const cached = qc.getQueryData<BoardSummary[]>(["/api/boards"]);
      expect(cached?.map((b) => b.id)).toEqual(["brd_1", "brd_3"]);
    });

    resolveDelete(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("on success: shows the success toast, removes the per-board detail cache entry, and invalidates the list cache", async () => {
    apiRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { qc, wrapper } = makeWrapper();
    qc.setQueryData<BoardSummary[]>(["/api/boards"], initialList);
    qc.setQueryData(["/api/boards", "brd_2"], { id: "brd_2", title: "Beta" });

    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDeleteBoardMutation(), { wrapper });
    result.current.mutate("brd_2");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Board deleted",
        description: "The board and its assets have been removed.",
      }),
    );

    // Detail cache for the deleted board should be removed entirely (not just
    // invalidated) — refetching it would 404.
    expect(qc.getQueryData(["/api/boards", "brd_2"])).toBeUndefined();

    // onSettled invalidates the list cache.
    expect(
      invalidateSpy.mock.calls.some(
        (c) =>
          Array.isArray((c[0] as { queryKey?: unknown[] })?.queryKey) &&
          ((c[0] as { queryKey: unknown[] }).queryKey[0] as string) ===
            "/api/boards" &&
          (c[0] as { queryKey: unknown[] }).queryKey.length === 1,
      ),
    ).toBe(true);

    expect(apiRequestMock).toHaveBeenCalledWith("DELETE", "/api/boards/brd_2");
  });

  it("on error: rolls back the list cache, shows the destructive error toast, and still invalidates onSettled", async () => {
    apiRequestMock.mockRejectedValue(new Error("500: server exploded"));

    const { qc, wrapper } = makeWrapper();
    qc.setQueryData<BoardSummary[]>(["/api/boards"], initialList);

    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDeleteBoardMutation(), { wrapper });
    result.current.mutate("brd_2");

    await waitFor(() => expect(result.current.isError).toBe(true));

    // List cache restored to the pre-mutation snapshot.
    const cached = qc.getQueryData<BoardSummary[]>(["/api/boards"]);
    expect(cached?.map((b) => b.id)).toEqual(["brd_1", "brd_2", "brd_3"]);

    // Error toast: correct title, destructive variant, and the leading
    // "<status>:" prefix has been stripped from the description.
    const errorToasts = toastMock.mock.calls.filter(
      (c) => (c[0] as { variant?: string } | undefined)?.variant === "destructive",
    );
    expect(errorToasts.length).toBe(1);
    expect(errorToasts[0][0]).toEqual(
      expect.objectContaining({
        title: "Couldn't delete board",
        description: "server exploded",
        variant: "destructive",
      }),
    );

    // onSettled still runs on error, invalidating the list cache.
    expect(
      invalidateSpy.mock.calls.some(
        (c) =>
          Array.isArray((c[0] as { queryKey?: unknown[] })?.queryKey) &&
          ((c[0] as { queryKey: unknown[] }).queryKey[0] as string) ===
            "/api/boards" &&
          (c[0] as { queryKey: unknown[] }).queryKey.length === 1,
      ),
    ).toBe(true);
  });
});
