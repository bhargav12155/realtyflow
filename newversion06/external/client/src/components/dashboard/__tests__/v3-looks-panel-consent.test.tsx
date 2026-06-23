import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiRequestMock = vi.fn();
const toastMock = vi.fn();
const invalidateQueriesMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueriesMock(...args),
    setQueryData: vi.fn(),
  },
  downloadFile: vi.fn(),
  getQueryFn: () => async () => ({}),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isAuthenticated: true }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null }),
}));

import { V3LooksPanel } from "@/components/dashboard/photo-avatars/V3LooksPanel";

const realFetch = global.fetch;

function setupFetch() {
  global.fetch = vi.fn(async () => {
    return new Response(
      JSON.stringify({ data: [], nextCursor: null }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ) as unknown as Response;
  }) as unknown as typeof fetch;
}

function renderPanel(consent: string | null) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: async () => ({}) },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <V3LooksPanel heygenGroupId="grp_xyz" consentStatus={consent} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  invalidateQueriesMock.mockReset();
  setupFetch();
});

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
});

describe("V3LooksPanel — consent badge colors", () => {
  it("uses the green badge when consent is approved and hides the Approve button", () => {
    renderPanel("approved");
    const badge = screen.getByTestId("text-consent-status-grp_xyz");
    expect(badge.textContent).toBe("approved");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-700");
    expect(screen.queryByTestId("button-approve-consent-grp_xyz")).toBeNull();
    expect(
      screen.getByTestId("button-revoke-consent-grp_xyz"),
    ).toBeTruthy();
  });

  it("uses the yellow badge when consent is pending and shows both Approve and Revoke", () => {
    renderPanel("pending");
    const badge = screen.getByTestId("text-consent-status-grp_xyz");
    expect(badge.textContent).toBe("pending");
    expect(badge.className).toContain("bg-yellow-100");
    expect(badge.className).toContain("text-yellow-700");
    expect(screen.getByTestId("button-approve-consent-grp_xyz")).toBeTruthy();
    expect(screen.getByTestId("button-revoke-consent-grp_xyz")).toBeTruthy();
  });

  it("uses the red badge when consent is revoked and hides the Revoke button", () => {
    renderPanel("revoked");
    const badge = screen.getByTestId("text-consent-status-grp_xyz");
    expect(badge.textContent).toBe("revoked");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-700");
    expect(screen.getByTestId("button-approve-consent-grp_xyz")).toBeTruthy();
    expect(screen.queryByTestId("button-revoke-consent-grp_xyz")).toBeNull();
  });

  it("falls back to the gray 'unknown' badge when consent is null", () => {
    renderPanel(null);
    const badge = screen.getByTestId("text-consent-status-grp_xyz");
    expect(badge.textContent).toBe("unknown");
    expect(badge.className).toContain("bg-gray-100");
  });
});

describe("V3LooksPanel — approve flow", () => {
  it("opens the approve dialog when Approve is clicked", async () => {
    renderPanel("pending");
    expect(screen.queryByTestId("dialog-approve-consent-grp_xyz")).toBeNull();
    fireEvent.click(screen.getByTestId("button-approve-consent-grp_xyz"));
    await waitFor(() =>
      expect(
        screen.getByTestId("dialog-approve-consent-grp_xyz"),
      ).toBeTruthy(),
    );
    // Confirm button is disabled until the user supplies a URL or signature.
    const confirm = screen.getByTestId(
      "button-confirm-approve-grp_xyz",
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it("POSTs the right payload to the consent endpoint when the dialog is confirmed", async () => {
    apiRequestMock.mockResolvedValue({
      json: async () => ({ status: "approved", consent_id: "c_1" }),
    });
    renderPanel("pending");
    fireEvent.click(screen.getByTestId("button-approve-consent-grp_xyz"));
    await waitFor(() =>
      expect(
        screen.getByTestId("dialog-approve-consent-grp_xyz"),
      ).toBeTruthy(),
    );

    fireEvent.change(
      screen.getByTestId("input-approve-video-url-grp_xyz"),
      { target: { value: "https://videos/c.mp4" } },
    );
    fireEvent.change(
      screen.getByTestId("input-approve-signature-grp_xyz"),
      { target: { value: "Jane Doe" } },
    );
    fireEvent.click(screen.getByTestId("button-confirm-approve-grp_xyz"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/v3/photo-avatars/grp_xyz/consent",
      {
        action: "approve",
        consentVideoUrl: "https://videos/c.mp4",
        signature: "Jane Doe",
      },
    );

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Consent recorded" }),
      ),
    );
  });

  it("omits empty fields from the approve payload (signature only)", async () => {
    apiRequestMock.mockResolvedValue({
      json: async () => ({ status: "approved", consent_id: "c_1" }),
    });
    renderPanel("pending");
    fireEvent.click(screen.getByTestId("button-approve-consent-grp_xyz"));
    await waitFor(() =>
      expect(
        screen.getByTestId("dialog-approve-consent-grp_xyz"),
      ).toBeTruthy(),
    );

    fireEvent.change(
      screen.getByTestId("input-approve-signature-grp_xyz"),
      { target: { value: "Jane" } },
    );
    fireEvent.click(screen.getByTestId("button-confirm-approve-grp_xyz"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock.mock.calls[0][2]).toEqual({
      action: "approve",
      consentVideoUrl: undefined,
      signature: "Jane",
    });
  });
});

describe("V3LooksPanel — revoke flow", () => {
  it("POSTs action='revoke' immediately when Revoke is clicked (no dialog, no consent video URL)", async () => {
    apiRequestMock.mockResolvedValue({
      json: async () => ({ status: "revoked" }),
    });
    renderPanel("approved");

    fireEvent.click(screen.getByTestId("button-revoke-consent-grp_xyz"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/v3/photo-avatars/grp_xyz/consent",
      { action: "revoke" },
    );

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Consent revoked" }),
      ),
    );
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["/api/photo-avatars/groups"],
    });
  });

  it("surfaces an error toast when the consent endpoint fails", async () => {
    apiRequestMock.mockRejectedValue(new Error("server exploded"));
    renderPanel("approved");
    fireEvent.click(screen.getByTestId("button-revoke-consent-grp_xyz"));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't update consent",
          variant: "destructive",
        }),
      ),
    );
  });
});
