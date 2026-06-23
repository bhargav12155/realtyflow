import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const apiRequestMock = vi.fn();
const uploadFileToBoardMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  getQueryFn:
    () =>
    async ({ queryKey }: { queryKey: unknown[] }) => {
      const [base, id] = queryKey as [string, string];
      if (base === "/api/boards" && id) {
        return { id, title: "B", isShared: false, isOwner: true, batches: [], assets: [] };
      }
      return null;
    },
}));

vi.mock("@/lib/boardUpload", () => ({
  uploadFileToBoard: (...args: unknown[]) => uploadFileToBoardMock(...args),
  uploadFilesToBoard: vi.fn(),
  isBoardUploadCancelled: (err: unknown) =>
    err instanceof Error && err.name === "AbortError",
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isAuthenticated: true }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null }),
}));
vi.mock("@/hooks/useBoardsTheme", () => ({
  useBoardsTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));
vi.mock("@/components/boards/BoardCanvas", () => ({ BoardCanvas: () => null }));
vi.mock("@/components/boards/AssetToolbar", () => ({ AssetToolbar: () => null }));
vi.mock("@/components/boards/ShareBoardDialog", () => ({ ShareBoardDialog: () => null }));
vi.mock("@/components/boards/ChatPanel", () => ({ ChatPanel: () => null }));

import BoardDetailPage from "@/pages/board-detail";

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ json: async () => ({}) });
  uploadFileToBoardMock.mockReset();
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());

function renderBoard() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base, id] = queryKey as [string, string];
          if (base === "/api/boards" && id) {
            return { id, title: "B", isShared: false, isOwner: true, batches: [], assets: [] };
          }
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  window.history.replaceState({}, "", "/boards/b1");
  const { hook } = memoryLocation({ path: "/boards/b1", record: true });
  return render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <Route path="/boards/:id" component={BoardDetailPage} />
      </Router>
    </QueryClientProvider>,
  );
}

/** Returns a Promise plus its resolve/reject so the test can stage when the
 * upload helper finishes. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("BoardDetailPage upload progress chips + retry", () => {
  it("picking a file inserts an upload chip; failure converts it to an error chip; Retry calls the upload helper again with the same File", async () => {
    renderBoard();

    // Wait for the page to render so the bottom toolbar's hidden file input is
    // mounted.
    const input = (await waitFor(() =>
      screen.getByTestId("input-toolbar-bottom-image"),
    )) as HTMLInputElement;

    // First call: stage a deferred upload that we'll fail later.
    const firstCall = deferred<null>();
    uploadFileToBoardMock.mockImplementationOnce(
      (_boardId: string, _file: File, _opts: { onProgress?: (n: number) => void }) =>
        firstCall.promise,
    );

    const file = new File([new Uint8Array(8)], "trip.png", {
      type: "image/png",
    });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // The page should immediately render a single uploading chip.
    const list = await waitFor(() => screen.getByTestId("list-board-uploads"));
    const chips = list.querySelectorAll('[data-testid^="chip-upload-"]');
    expect(chips).toHaveLength(1);
    const chipId = chips[0]
      .getAttribute("data-testid")!
      .replace(/^chip-upload-/, "");
    expect(
      screen.getByTestId(`text-upload-name-${chipId}`).textContent,
    ).toBe("trip.png");
    expect(screen.getByTestId(`text-upload-percent-${chipId}`)).toBeTruthy();

    // First call should have been invoked with our File and a real onProgress
    // callback that the helper can pump into the chip.
    expect(uploadFileToBoardMock).toHaveBeenCalledTimes(1);
    const [boardArg, fileArg, optsArg] = uploadFileToBoardMock.mock.calls[0];
    expect(boardArg).toBe("b1");
    expect(fileArg).toBe(file);
    expect(typeof optsArg.onProgress).toBe("function");

    // Pump a progress update through to confirm the chip reflects it.
    await act(async () => {
      optsArg.onProgress(57);
    });
    expect(
      screen.getByTestId(`text-upload-percent-${chipId}`).textContent,
    ).toBe("57%");

    // Now fail the upload — chip should flip to error state with Retry/Dismiss.
    await act(async () => {
      firstCall.reject(new Error("Upload failed: 500 boom"));
    });

    await waitFor(() => {
      expect(screen.getByTestId(`button-upload-retry-${chipId}`)).toBeTruthy();
    });
    expect(
      screen.getByTestId(`text-upload-error-${chipId}`).textContent,
    ).toContain("500 boom");
    expect(screen.queryByTestId(`text-upload-percent-${chipId}`)).toBeNull();

    // Retry: stage a successful second call and click Retry. The helper must
    // be invoked a second time with the SAME File object (this is the part
    // task #154 is easy to regress — losing the File reference).
    const secondCall = deferred<{ id: string; assetUrl: string; kind: "image" }>();
    uploadFileToBoardMock.mockImplementationOnce(
      (_boardId: string, _file: File) => secondCall.promise,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId(`button-upload-retry-${chipId}`));
    });

    expect(uploadFileToBoardMock).toHaveBeenCalledTimes(2);
    const [, retryFileArg] = uploadFileToBoardMock.mock.calls[1];
    expect(retryFileArg).toBe(file);

    // The chip should be back in uploading state (no Retry button while
    // it's in flight).
    expect(screen.queryByTestId(`button-upload-retry-${chipId}`)).toBeNull();
    expect(screen.getByTestId(`text-upload-percent-${chipId}`)).toBeTruthy();

    // Resolve the retry — the chip should disappear once the upload settles.
    await act(async () => {
      secondCall.resolve({
        id: "asset-9",
        assetUrl: "https://cdn.example/trip.png",
        kind: "image",
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`chip-upload-${chipId}`)).toBeNull();
    });
  });

  it("Dismiss removes an errored chip without re-invoking the upload helper", async () => {
    renderBoard();
    const input = (await waitFor(() =>
      screen.getByTestId("input-toolbar-bottom-image"),
    )) as HTMLInputElement;

    const failed = deferred<null>();
    uploadFileToBoardMock.mockImplementationOnce(() => failed.promise);

    const file = new File([new Uint8Array(4)], "oops.png", {
      type: "image/png",
    });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => screen.getByTestId("list-board-uploads"));
    await act(async () => {
      failed.reject(new Error("nope"));
    });

    const dismissBtn = await waitFor(() => {
      const btns = screen.queryAllByTestId(/^button-upload-dismiss-/);
      expect(btns.length).toBe(1);
      return btns[0];
    });

    await act(async () => {
      fireEvent.click(dismissBtn);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("list-board-uploads")).toBeNull();
    });
    // Dismiss must NOT trigger a second upload attempt.
    expect(uploadFileToBoardMock).toHaveBeenCalledTimes(1);
  });
});
