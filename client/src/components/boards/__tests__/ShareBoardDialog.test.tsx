import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const sharesRef: { current: Array<{ userId: string; name: string | null; email: string | null; sharedAt: string | null }> } = {
  current: [],
};
const candidatesRef: { current: Array<{ id: string; name: string | null; email: string | null; username: string | null }> } = {
  current: [],
};
const boardRef: { current: { id: string; notifyOnCollaboratorChange?: boolean } } = {
  current: { id: "board-1", notifyOnCollaboratorChange: true },
};
const queryClientRef: { current: QueryClient | null } = { current: null };
const apiRequestMock = vi.fn(async () => ({ json: async () => ({}) }));

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
    getQueryFn: () => async () => undefined,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { ShareBoardDialog } from "../ShareBoardDialog";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

function renderDialog() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        queryFn: async ({ queryKey }) => {
          const key = queryKey as unknown[];
          if (key[0] === "/api/boards" && key[2] === "shares") return sharesRef.current;
          if (key[0] === "/api/boards/share-candidates") return candidatesRef.current;
          if (key[0] === "/api/boards" && key.length === 2 && key[1] === "board-1") return boardRef.current;
          return undefined;
        },
      },
      mutations: { retry: false },
    },
  });
  queryClientRef.current = qc;
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmDialogProvider>
        <ShareBoardDialog boardId="board-1" open={true} onOpenChange={() => {}} />
      </ConfirmDialogProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  sharesRef.current = [];
  candidatesRef.current = [];
  boardRef.current = { id: "board-1", notifyOnCollaboratorChange: true };
  queryClientRef.current = null;
  apiRequestMock.mockClear();
});

describe("ShareBoardDialog remove confirmation", () => {
  beforeEach(() => {
    sharesRef.current = [
      { userId: "user-2", name: "Bob Smith", email: "bob@example.com", sharedAt: null },
    ];
    candidatesRef.current = [];
  });

  it("opens a confirmation prompt when clicking the X next to a collaborator", async () => {
    renderDialog();

    const removeBtn = await screen.findByTestId("button-unshare-user-2");
    fireEvent.click(removeBtn);

    const confirmDialog = await screen.findByTestId("confirm-dialog");
    expect(confirmDialog).toBeTruthy();
    expect(screen.getByTestId("confirm-dialog-title").textContent).toContain("Remove access");
    expect(screen.getByTestId("confirm-dialog-description").textContent).toContain("Bob Smith");
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("does not call the unshare API when the confirmation is cancelled", async () => {
    renderDialog();

    fireEvent.click(await screen.findByTestId("button-unshare-user-2"));
    fireEvent.click(await screen.findByTestId("confirm-dialog-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("calls DELETE /api/boards/:id/shares/:userId when the confirmation is accepted", async () => {
    renderDialog();

    fireEvent.click(await screen.findByTestId("button-unshare-user-2"));
    fireEvent.click(await screen.findByTestId("confirm-dialog-confirm"));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledTimes(1);
    });
    expect(apiRequestMock).toHaveBeenCalledWith(
      "DELETE",
      "/api/boards/board-1/shares/user-2",
    );
  });
});

describe("ShareBoardDialog notify-on-collaborator-change toggle", () => {
  beforeEach(() => {
    sharesRef.current = [];
    candidatesRef.current = [];
  });

  it("reflects the board's current notifyOnCollaboratorChange=true value", async () => {
    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: true };
    renderDialog();

    const toggle = (await screen.findByTestId("toggle-notify-collaborator-change")) as HTMLInputElement;
    await waitFor(() => {
      expect(toggle.checked).toBe(true);
    });
  });

  it("reflects the board's current notifyOnCollaboratorChange=false value (muted)", async () => {
    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: false };
    renderDialog();

    const toggle = (await screen.findByTestId("toggle-notify-collaborator-change")) as HTMLInputElement;
    await waitFor(() => {
      expect(toggle.checked).toBe(false);
    });
  });

  it("PATCHes the board with notifyOnCollaboratorChange=false when toggling off", async () => {
    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: true };
    renderDialog();

    const toggle = (await screen.findByTestId("toggle-notify-collaborator-change")) as HTMLInputElement;
    await waitFor(() => {
      expect(toggle.checked).toBe(true);
    });

    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: false };
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "PATCH",
        "/api/boards/board-1",
        { notifyOnCollaboratorChange: false },
      );
    });
  });

  it("PATCHes the board with notifyOnCollaboratorChange=true when toggling on", async () => {
    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: false };
    renderDialog();

    const toggle = (await screen.findByTestId("toggle-notify-collaborator-change")) as HTMLInputElement;
    await waitFor(() => {
      expect(toggle.checked).toBe(false);
    });

    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: true };
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "PATCH",
        "/api/boards/board-1",
        { notifyOnCollaboratorChange: true },
      );
    });
  });

  it("keeps the new value after the post-mutation refetch", async () => {
    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: true };
    renderDialog();

    const toggle = (await screen.findByTestId("toggle-notify-collaborator-change")) as HTMLInputElement;
    await waitFor(() => {
      expect(toggle.checked).toBe(true);
    });

    boardRef.current = { id: "board-1", notifyOnCollaboratorChange: false };
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const refreshed = screen.getByTestId("toggle-notify-collaborator-change") as HTMLInputElement;
      expect(refreshed.checked).toBe(false);
    });
  });
});
