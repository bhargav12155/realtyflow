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

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
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
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => vi.fn(async () => true),
}));
vi.mock("./avatar-photo-gallery", () => ({
  AvatarPhotoGallery: () => null,
}));
vi.mock("./voice-library-manager", () => ({
  VoiceLibraryManager: () => null,
}));
vi.mock("heic2any", () => ({ default: vi.fn() }));

import { V3LooksPanel } from "@/components/dashboard/photo-avatars/V3LooksPanel";

type FetchCall = { url: string; init?: RequestInit };
let fetchCalls: FetchCall[];
let fetchResponses: Array<{
  data: Array<Record<string, unknown>>;
  nextCursor: string | null;
}>;
const realFetch = global.fetch;

function setupFetch() {
  fetchCalls = [];
  fetchResponses = [];
  global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    const next = fetchResponses.shift();
    if (!next) {
      throw new Error(`unexpected fetch call: ${String(url)}`);
    }
    return new Response(JSON.stringify(next), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof fetch;
}

function renderPanel(consent: string | null = "approved") {
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
  setupFetch();
});

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
});

describe("V3LooksPanel", () => {
  it("loads the first page of looks and shows the consent status", async () => {
    fetchResponses.push({
      data: [
        { id: "look_a", name: "Look A", image_url: "https://img/a.jpg" },
      ],
      nextCursor: "cursor_b",
    });

    renderPanel("approved");

    await waitFor(() =>
      expect(screen.getByTestId("card-v3-look-look_a")).toBeTruthy(),
    );
    expect(screen.getByTestId("text-consent-status-grp_xyz").textContent).toBe(
      "approved",
    );
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("/api/v3/photo-avatars/grp_xyz/looks");
  });

  it("paginates with cursor history (Next pushes, Previous pops)", async () => {
    // Page 1
    fetchResponses.push({
      data: [{ id: "look_a", name: "Look A", image_url: "https://img/a.jpg" }],
      nextCursor: "cursor_b",
    });
    // Page 2
    fetchResponses.push({
      data: [{ id: "look_b", name: "Look B", image_url: "https://img/b.jpg" }],
      nextCursor: "cursor_c",
    });
    // Back to page 1 (history pop) — re-fetched because the cursor changes
    fetchResponses.push({
      data: [{ id: "look_a", name: "Look A", image_url: "https://img/a.jpg" }],
      nextCursor: "cursor_b",
    });

    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId("card-v3-look-look_a")).toBeTruthy(),
    );

    // Previous is disabled at the start.
    const prevBtn = screen.getByTestId(
      "button-looks-prev-grp_xyz",
    ) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);

    // Click Next: history grows, cursor becomes 'cursor_b'.
    fireEvent.click(screen.getByTestId("button-looks-next-grp_xyz"));
    await waitFor(() =>
      expect(screen.getByTestId("card-v3-look-look_b")).toBeTruthy(),
    );
    expect(fetchCalls[1].url).toBe(
      "/api/v3/photo-avatars/grp_xyz/looks?cursor=cursor_b",
    );

    // Now Previous is enabled.
    expect(
      (screen.getByTestId("button-looks-prev-grp_xyz") as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    // Click Previous: history pops back to the original (no cursor) page.
    fireEvent.click(screen.getByTestId("button-looks-prev-grp_xyz"));
    await waitFor(() =>
      expect(screen.getByTestId("card-v3-look-look_a")).toBeTruthy(),
    );
    expect(fetchCalls[2].url).toBe("/api/v3/photo-avatars/grp_xyz/looks");

    // Previous is disabled again because history is empty.
    await waitFor(() =>
      expect(
        (screen.getByTestId("button-looks-prev-grp_xyz") as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    );
  });

  it("calls /api/avatar-iv/use-look-image with the chosen look's image when 'Use for Video' is clicked", async () => {
    fetchResponses.push({
      data: [
        {
          id: "look_a",
          name: "Boardroom Look",
          image_url: "https://img/a.jpg",
        },
      ],
      nextCursor: null,
    });
    apiRequestMock.mockResolvedValue({
      json: async () => ({ ok: true, avatarId: "av_1" }),
    });

    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId("button-use-v3-look-look_a")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("button-use-v3-look-look_a"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/avatar-iv/use-look-image",
      { imageUrl: "https://img/a.jpg", lookName: "Boardroom Look" },
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Look Ready for Video!" }),
      ),
    );
  });

  it("renders a copy-pastable shape-drift alert when the looks endpoint returns heygen_shape_drift", async () => {
    // Override the global fetch stub for this case so we can return a
    // 502 carrying the shape-drift envelope the server now emits.
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      fetchCalls.push({ url: String(url) });
      return new Response(
        JSON.stringify({
          error: "heygen_shape_drift",
          endpoint: "/v3/photo_avatars/grp_xyz/looks",
          message:
            "HeyGen returned an unexpected response shape for /v3/photo_avatars/grp_xyz/looks. Please retry. If this keeps happening, copy this whole message to support: ...",
          issuePaths: ["items"],
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      ) as unknown as Response;
    }) as unknown as typeof fetch;

    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId("alert-heygen-shape-drift-grp_xyz")).toBeTruthy(),
    );
    const details = screen.getByTestId(
      "text-heygen-shape-drift-details-grp_xyz",
    );
    expect(details.textContent).toContain("heygen_shape_drift");
    expect(details.textContent).toContain("/v3/photo_avatars/grp_xyz/looks");
    expect(details.textContent).toContain("grp_xyz");
    expect(details.textContent).toContain("items");
    // Generic "still training" fallback must NOT render alongside the
    // specific shape-drift alert.
    expect(screen.queryByText(/still be training/i)).toBeNull();
    // The copy button is wired up so operators can paste into a ticket.
    expect(
      screen.getByTestId("button-copy-heygen-shape-drift-grp_xyz"),
    ).toBeTruthy();
  });

  it("falls back through the available image fields when picking the look's image", async () => {
    fetchResponses.push({
      data: [
        {
          id: "look_b",
          name: "Cover Look",
          // image_url missing — should fall back to preview_image_url
          preview_image_url: "https://img/preview.jpg",
        },
      ],
      nextCursor: null,
    });
    apiRequestMock.mockResolvedValue({
      json: async () => ({ ok: true }),
    });

    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId("button-use-v3-look-look_b")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("button-use-v3-look-look_b"));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock.mock.calls[0][2]).toEqual({
      imageUrl: "https://img/preview.jpg",
      lookName: "Cover Look",
    });
  });
});
