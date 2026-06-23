import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoardsHomeView } from "../BoardsHomeView";
import type { BoardSummary } from "../BoardCard";

// Locks the boards grid to the shared rename-board mutation: this test
// drives the rename UI on a card and asserts the same observable contract
// the dedicated `useRenameBoardMutation` test guarantees (PATCH +
// optimistic list-cache patch + success/error toast + rollback). If a
// future refactor bypasses the shared hook on the home grid, these
// assertions will fail and surface the drift.
const apiRequestMock = vi.fn();
const boardsListRef: { current: BoardSummary[] } = { current: [] };
const queryClientRef: { current: QueryClient | null } = { current: null };

vi.mock("@/lib/queryClient", () => {
  // Proxy mirrors the existing BoardsHomeView.test.tsx pattern: forward
  // every queryClient call to whichever QueryClient the current test set
  // up, so optimistic setQueryData inside the shared rename hook lands on
  // the same store useQuery in the view is reading.
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
    getQueryFn: () => async () => boardsListRef.current,
  };
});

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com", name: "Tester" },
  }),
}));

const BOARD_ID = "brd_owned_rename";
const ORIGINAL_TITLE = "Original board title";
const NEW_TITLE = "Renamed board title";

function seedBoard(): BoardSummary {
  return {
    id: BOARD_ID,
    title: ORIGINAL_TITLE,
    isOwner: true,
    updatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  boardsListRef.current = [seedBoard()];
});

afterEach(() => {
  cleanup();
  queryClientRef.current = null;
});

function renderHomeView() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        queryFn: async () => boardsListRef.current,
      },
      mutations: { retry: false },
    },
  });
  queryClientRef.current = qc;
  const { hook } = memoryLocation({ path: "/boards", record: true });
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Router hook={hook}>
          <BoardsHomeView />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { qc };
}

async function openRenameDialog() {
  await screen.findByTestId(`card-board-${BOARD_ID}`);
  // The inline pencil opens the rename Dialog directly. We deliberately
  // avoid the kebab menu → Rename path here because that path keeps the
  // DropdownMenu open at the same time as the Dialog (the menu item calls
  // e.preventDefault() on onSelect), which trips a focus-trap interaction
  // in JSDOM. Both paths funnel into the same dialog and the same
  // onRename → useRenameBoardMutation wire-up, so this still proves the
  // grid is using the shared mutation.
  const pencil = screen.getByTestId(`button-rename-inline-${BOARD_ID}`);
  fireEvent.click(pencil);
  return await screen.findByTestId(`input-rename-board-${BOARD_ID}`);
}

async function submitRename(newTitle: string) {
  const input = await openRenameDialog();
  fireEvent.change(input, { target: { value: newTitle } });
  const save = screen.getByTestId(`button-confirm-rename-${BOARD_ID}`);
  fireEvent.click(save);
}

describe("BoardsHomeView rename → shared useRenameBoardMutation", () => {
  it("PATCHes /api/boards/:id with the new title, optimistically patches the list cache while in flight, and toasts 'Board renamed' on success", async () => {
    // Hold the PATCH open with a deferred so we can observe the optimistic
    // list-cache write BEFORE the network call resolves. If the grid ever
    // bypassed the shared hook (e.g. a local non-optimistic mutation), the
    // cache title would still read ORIGINAL_TITLE here and this assertion
    // would fail.
    let resolvePatch: (value: Response) => void = () => {};
    const patchPromise = new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });
    apiRequestMock.mockImplementation(
      async (method: string, url: string) => {
        if (method === "PATCH" && url === `/api/boards/${BOARD_ID}`) {
          return patchPromise;
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );

    const { qc } = renderHomeView();
    await submitRename(NEW_TITLE);

    // PATCH is sent with the new title.
    await waitFor(() => {
      const patchCalls = apiRequestMock.mock.calls.filter(
        (c) => c[0] === "PATCH" && c[1] === `/api/boards/${BOARD_ID}`,
      );
      expect(patchCalls.length).toBe(1);
      expect(patchCalls[0][2]).toEqual({ title: NEW_TITLE });
    });

    // While the PATCH is still in flight the list cache must already
    // reflect the new title (proves the shared hook's onMutate ran).
    await waitFor(() => {
      const list = qc.getQueryData<BoardSummary[]>(["/api/boards"]);
      expect(list?.find((b) => b.id === BOARD_ID)?.title).toBe(NEW_TITLE);
    });

    // Resolve the PATCH; success toast must fire.
    resolvePatch(
      new Response(JSON.stringify({ id: BOARD_ID, title: NEW_TITLE }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await waitFor(() => {
      const successToasts = toastMock.mock.calls.filter(
        ([arg]) => (arg as { title?: string })?.title === "Board renamed",
      );
      expect(successToasts).toHaveLength(1);
    });
    // Failure toast must not have fired on the happy path.
    expect(
      toastMock.mock.calls.some(
        ([arg]) =>
          (arg as { title?: string })?.title === "Couldn't rename board",
      ),
    ).toBe(false);
  });

  it("rolls the list cache back to the original title and toasts 'Couldn't rename board' when the PATCH fails", async () => {
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method === "PATCH" && url === `/api/boards/${BOARD_ID}`) {
        throw new Error("500: server exploded");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { qc } = renderHomeView();
    await submitRename(NEW_TITLE);

    // Wait for the destructive error toast — proves the shared hook's
    // onError path ran (not a generic mutation we forgot to wire toasts
    // into).
    await waitFor(() => {
      const errorToasts = toastMock.mock.calls.filter(
        ([arg]) =>
          (arg as { title?: string })?.title === "Couldn't rename board",
      );
      expect(errorToasts.length).toBeGreaterThan(0);
      const [arg] = errorToasts[0] as [
        { description?: string; variant?: string },
      ];
      // Hook strips the "<status>: " prefix from the thrown message.
      expect(arg.description).toBe("server exploded");
      expect(arg.variant).toBe("destructive");
    });

    // Cache must be rolled back to the original title — the optimistic
    // write should not survive a failed PATCH.
    await waitFor(() => {
      const list = qc.getQueryData<BoardSummary[]>(["/api/boards"]);
      expect(list?.find((b) => b.id === BOARD_ID)?.title).toBe(
        ORIGINAL_TITLE,
      );
    });

    // Success toast must NOT have fired.
    expect(
      toastMock.mock.calls.some(
        ([arg]) => (arg as { title?: string })?.title === "Board renamed",
      ),
    ).toBe(false);
  });
});
