import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

// The page imports `queryClient` from "@/lib/queryClient" at module load time
// and uses it for setQueryData / cancelQueries inside its mutations. We
// share a single QueryClient between the mock and the test's
// <QueryClientProvider> so optimistic cache writes inside mutations land on
// the same store useQuery is reading. Per-test queryFn/title differences
// are configured by reassigning the queryFn default before each render.
const { apiRequestMock, toastMock, sharedQueryClient } = vi.hoisted(() => {
  // Required to keep this require() inside the hoisted factory: vi.mock and
  // vi.hoisted both run before the file's top-level imports execute, so a
  // top-level `import { QueryClient } ...` would still be undefined here.
  const { QueryClient } = require("@tanstack/react-query") as typeof import("@tanstack/react-query");
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

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "owner" }, isAuthenticated: true }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null, send: vi.fn() }),
}));
vi.mock("@/hooks/useBoardsTheme", () => ({
  useBoardsTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));
vi.mock("@/components/boards/BoardCanvas", () => ({ BoardCanvas: () => null }));
vi.mock("@/components/boards/AssetToolbar", () => ({ AssetToolbar: () => null }));
vi.mock("@/components/boards/GroupAssetToolbar", () => ({
  GroupAssetToolbar: () => null,
}));
vi.mock("@/components/boards/ShareBoardDialog", () => ({
  ShareBoardDialog: () => null,
}));
vi.mock("@/components/boards/DrawingModal", () => ({ DrawingModal: () => null }));
vi.mock("@/components/boards/RecordModal", () => ({ RecordModal: () => null }));
vi.mock("@/components/boards/PresenceAvatars", () => ({
  PresenceAvatars: () => null,
}));
vi.mock("@/components/boards/NotificationsBell", () => ({
  NotificationsBell: () => null,
}));
vi.mock("@/components/boards/BoardBottomToolbar", () => ({
  BoardBottomToolbar: () => null,
}));
vi.mock("@/components/boards/ChatPanel", () => ({
  ChatPanel: ({ boardTitle }: { boardTitle: string }) => (
    <div data-testid="chat-stub" data-board-title={boardTitle} />
  ),
}));

import BoardDetailPage from "@/pages/board-detail";

const BOARD_ID = "board-rename";

function configureQueryClient(opts: { isOwner: boolean; title?: string }) {
  sharedQueryClient.clear();
  sharedQueryClient.setDefaultOptions({
    queries: {
      retry: false,
      queryFn: async ({ queryKey }) => {
        const [base, id, sub] = queryKey as [string, string, string?];
        if (base === "/api/boards" && id && !sub) {
          return {
            id,
            title: opts.title ?? "Original title",
            isShared: false,
            isOwner: opts.isOwner,
            userId: "owner",
            batches: [],
            assets: [],
          };
        }
        if (base === "/api/boards" && id && sub === "messages") {
          return { messages: [] };
        }
        if (base === "/api/boards/chat/health") {
          return { healthy: [], unhealthy: [], default: null };
        }
        return null;
      },
    },
    mutations: { retry: false },
  });
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  apiRequestMock.mockImplementation(async () => ({
    json: async () => ({ ok: true }),
  }));
  window.history.replaceState({}, "", "/");
});
afterEach(() => {
  cleanup();
});

function renderBoard(opts: { isOwner: boolean; title?: string }) {
  configureQueryClient(opts);
  const path = `/boards/${BOARD_ID}`;
  window.history.replaceState({}, "", path);
  const { hook } = memoryLocation({ path, record: true });
  const utils = render(
    <QueryClientProvider client={sharedQueryClient}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
  return { qc: sharedQueryClient, ...utils };
}

function patchCalls() {
  return apiRequestMock.mock.calls.filter(
    ([method, url]) =>
      method === "PATCH" &&
      typeof url === "string" &&
      url === `/api/boards/${BOARD_ID}`,
  );
}

describe("BoardDetailPage inline rename", () => {
  it("renders a clickable title button for owners and a static title for non-owners", async () => {
    const { unmount } = renderBoard({ isOwner: true });
    await waitFor(() => {
      expect(screen.queryByTestId("button-title")).not.toBeNull();
    });
    expect(screen.queryByTestId("text-board-title")).toBeNull();
    unmount();
    cleanup();

    renderBoard({ isOwner: false, title: "Read only" });
    await waitFor(() => {
      expect(screen.queryByTestId("text-board-title")).not.toBeNull();
    });
    expect(screen.queryByTestId("button-title")).toBeNull();
    expect(screen.queryByTestId("input-board-title")).toBeNull();
  });

  it("clicks owner title to enter edit mode prefilled with current title", async () => {
    renderBoard({ isOwner: true, title: "Original title" });
    const trigger = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(trigger);
    });
    const input = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;
    expect(input.value).toBe("Original title");
  });

  it("Enter commits the trimmed title via PATCH and applies it optimistically to the header", async () => {
    let resolvePatch!: () => void;
    apiRequestMock.mockImplementation(
      async (_method: string, _url: string, body: unknown) =>
        new Promise((resolve) => {
          resolvePatch = () =>
            resolve({
              json: async () => ({ id: BOARD_ID, ...((body as object) ?? {}) }),
            } as unknown as Response);
        }),
    );

    const { qc } = renderBoard({ isOwner: true, title: "Original title" });
    const initialTrigger = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(initialTrigger);
    });
    const input = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "  Coastal launch  " } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Edit mode collapses immediately and the optimistic title is reflected
    // in the header (uppercased per the existing render style). The
    // optimistic setQueryData runs inside an async onMutate, so we wait on
    // the next render cycle rather than asserting synchronously.
    await waitFor(() => {
      expect(screen.queryByTestId("input-board-title")).toBeNull();
    });
    await waitFor(() => {
      const cached = qc.getQueryData<{ title: string }>([
        "/api/boards",
        BOARD_ID,
      ]);
      expect(cached?.title).toBe("Coastal launch");
    });
    await waitFor(() => {
      const t = screen.getByTestId("button-title");
      expect(t.textContent ?? "").toMatch(/COASTAL/);
      expect(t.textContent ?? "").toMatch(/LAUNCH/);
    });

    // PATCH was issued exactly once with the trimmed value.
    const calls = patchCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[2]).toEqual({ title: "Coastal launch" });

    // ChatPanel receives the optimistic title too — the source of truth is
    // the same cached board object the header reads from.
    await waitFor(() => {
      expect(
        screen.getByTestId("chat-stub").getAttribute("data-board-title"),
      ).toBe("Coastal launch");
    });

    // Resolve the in-flight PATCH so React Query can settle without warning.
    act(() => {
      resolvePatch();
    });
    await waitFor(() => {
      expect(
        toastMock.mock.calls.some(
          ([arg]) => (arg as { title?: string })?.title === "Board renamed",
        ),
      ).toBe(true);
    });
  });

  it("Escape cancels editing without firing PATCH", async () => {
    renderBoard({ isOwner: true, title: "Original title" });
    const trigger0 = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(trigger0);
    });
    const input = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "Should not save" } });
      fireEvent.keyDown(input, { key: "Escape" });
    });
    await waitFor(() => {
      expect(screen.queryByTestId("input-board-title")).toBeNull();
    });
    const trigger = await screen.findByTestId("button-title");
    expect(trigger.textContent ?? "").toMatch(/ORIGINAL/);
    expect(patchCalls()).toHaveLength(0);
  });

  it("blurring with an unchanged or empty value does not call PATCH", async () => {
    renderBoard({ isOwner: true, title: "Original title" });
    const trigger0 = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(trigger0);
    });
    const input = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;

    // Unchanged blur: same value -> no PATCH.
    act(() => {
      fireEvent.blur(input);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("input-board-title")).toBeNull();
    });
    expect(patchCalls()).toHaveLength(0);

    // Empty blur: trims to empty -> no PATCH and title stays put.
    const trigger1 = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(trigger1);
    });
    const input2 = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;
    act(() => {
      fireEvent.change(input2, { target: { value: "   " } });
      fireEvent.blur(input2);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("input-board-title")).toBeNull();
    });
    expect(patchCalls()).toHaveLength(0);
    const trigger = await screen.findByTestId("button-title");
    expect(trigger.textContent ?? "").toMatch(/ORIGINAL/);
  });

  it("silently dismisses an over-cap (>200 char) draft on Enter without firing PATCH", async () => {
    renderBoard({ isOwner: true, title: "Original title" });
    const trigger0 = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(trigger0);
    });
    const input = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;

    // Build a 201-char draft. fireEvent.change bypasses the input's
    // maxLength enforcement (jsdom's keystroke-level cap), which is
    // exactly the way an automated/programmatic write or a paste-then-edit
    // could sneak past the guard. The silent-dismiss branch in
    // commitTitleEdit is what protects the server in that case.
    const overCap = "a".repeat(201);
    act(() => {
      fireEvent.change(input, { target: { value: overCap } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Edit mode collapses, no PATCH was issued, and the header still
    // shows the original title.
    await waitFor(() => {
      expect(screen.queryByTestId("input-board-title")).toBeNull();
    });
    expect(patchCalls()).toHaveLength(0);
    const trigger = await screen.findByTestId("button-title");
    expect(trigger.textContent ?? "").toMatch(/ORIGINAL/);
  });

  it("caps the input via maxLength so real keystrokes can't exceed BOARD_TITLE_MAX", async () => {
    renderBoard({ isOwner: true, title: "Original title" });
    const trigger0 = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(trigger0);
    });
    const input = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;

    // The native maxLength attribute is what stops a user typing more
    // than BOARD_TITLE_MAX (200) characters one keystroke at a time. If
    // this guard is removed, the silent-dismiss branch in
    // commitTitleEdit becomes unreachable from normal typing and over-
    // length drafts could start hitting the server.
    expect(input.maxLength).toBe(200);
  });

  it("rolls back the optimistic title and shows an error toast when PATCH fails", async () => {
    apiRequestMock.mockImplementationOnce(async () => {
      throw new Error("500: Internal Server Error");
    });

    renderBoard({ isOwner: true, title: "Original title" });
    const trigger0 = await screen.findByTestId("button-title");
    act(() => {
      fireEvent.click(trigger0);
    });
    const input = (await screen.findByTestId(
      "input-board-title",
    )) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "Will fail" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => {
      expect(
        toastMock.mock.calls.some(
          ([arg]) =>
            (arg as { title?: string })?.title === "Couldn't rename board",
        ),
      ).toBe(true);
    });
    // Header reverted to the original title after rollback.
    const trigger = await screen.findByTestId("button-title");
    expect(trigger.textContent ?? "").toMatch(/ORIGINAL/);
  });
});
