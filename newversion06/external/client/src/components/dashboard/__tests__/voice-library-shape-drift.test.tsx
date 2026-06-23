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
  getQueryFn: () => async () => [],
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { VoiceLibraryManager } from "@/components/dashboard/voice-library-manager";

const realFetch = global.fetch;

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function renderManager() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: async () => [] },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <VoiceLibraryManager />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
});

describe("VoiceLibraryManager — HeyGen shape-drift alert", () => {
  it("renders the copy-pastable alert when /api/v3/voices returns heygen_shape_drift", async () => {
    const calls: FetchCall[] = [];
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      if (u.startsWith("/api/v3/voices")) {
        return new Response(
          JSON.stringify({
            error: "heygen_shape_drift",
            endpoint: "/v2/voices",
            message:
              "HeyGen returned an unexpected response shape for /v2/voices. Please retry. If this keeps happening, copy this whole message to support: ...",
            issuePaths: ["data.voices.0.voice_id", "data.voices.3.gender"],
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ) as unknown as Response;
      }
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response;
    }) as unknown as typeof fetch;

    renderManager();

    // Switch to the Browse tab — Radix activates on mousedown in jsdom.
    const browseTab = await waitFor(() => screen.getByTestId("tab-voice-browse"));
    fireEvent.mouseDown(browseTab);
    fireEvent.click(browseTab);

    const alert = await waitFor(() =>
      screen.getByTestId("alert-heygen-shape-drift-voices-browse"),
    );
    expect(alert).toBeTruthy();

    const details = screen.getByTestId(
      "text-heygen-shape-drift-details-voices-browse",
    );
    expect(details.textContent).toContain("heygen_shape_drift");
    expect(details.textContent).toContain("/v2/voices");
    expect(details.textContent).toContain("data.voices.0.voice_id");
    expect(details.textContent).toContain("data.voices.3.gender");

    expect(
      screen.getByTestId("button-copy-heygen-shape-drift-voices-browse"),
    ).toBeTruthy();
  });

  it("retries the /api/v3/voices query when the alert's Retry button is clicked", async () => {
    let voicesCallCount = 0;
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.startsWith("/api/v3/voices")) {
        voicesCallCount++;
        if (voicesCallCount === 1) {
          return new Response(
            JSON.stringify({
              error: "heygen_shape_drift",
              endpoint: "/v2/voices",
              message: "shape drift",
              issuePaths: ["data.voices.0.voice_id"],
            }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          ) as unknown as Response;
        }
        return new Response(
          JSON.stringify({ data: [], nextCursor: null }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ) as unknown as Response;
      }
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response;
    }) as unknown as typeof fetch;

    renderManager();

    const browseTab = await waitFor(() => screen.getByTestId("tab-voice-browse"));
    fireEvent.mouseDown(browseTab);
    fireEvent.click(browseTab);

    const retryBtn = await waitFor(() =>
      screen.getByTestId("button-retry-heygen-shape-drift-voices-browse"),
    );
    expect(voicesCallCount).toBe(1);

    fireEvent.click(retryBtn);

    await waitFor(() => expect(voicesCallCount).toBeGreaterThanOrEqual(2));
    await waitFor(() =>
      expect(
        screen.queryByTestId("alert-heygen-shape-drift-voices-browse"),
      ).toBeNull(),
    );
  });

  it("renders the alert in the Design tab when /api/v3/voices/design returns heygen_shape_drift", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      // Browse tab default fetch returns an empty page; we don't care
      // about it here but the component issues it on mount.
      return new Response(
        JSON.stringify({ data: [], nextCursor: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ) as unknown as Response;
    }) as unknown as typeof fetch;

    apiRequestMock.mockImplementationOnce(async () => {
      // Mirror what the real apiRequest helper throws on a non-2xx
      // response: `${status}: ${body}`.
      const body = JSON.stringify({
        error: "heygen_shape_drift",
        endpoint: "/v2/voices/design",
        message:
          "HeyGen returned an unexpected response shape for /v2/voices/design. Please retry. If this keeps happening, copy this whole message to support: ...",
        issuePaths: ["preview.voice_id"],
      });
      throw new Error(`502: ${body}`);
    });

    renderManager();

    const designTab = await waitFor(() =>
      screen.getByTestId("tab-voice-design"),
    );
    fireEvent.mouseDown(designTab);
    fireEvent.click(designTab);

    // Fill in a description so the Preview button enables.
    const description = await waitFor(() =>
      screen.getByTestId("textarea-design-description"),
    );
    fireEvent.change(description, {
      target: { value: "A warm contralto narrator with a slight rasp." },
    });

    const previewBtn = (await waitFor(() =>
      screen.getByTestId("button-preview-design-voice"),
    )) as HTMLButtonElement;
    await waitFor(() => expect(previewBtn.disabled).toBe(false));
    fireEvent.click(previewBtn);

    const alert = await waitFor(() =>
      screen.getByTestId("alert-heygen-shape-drift-voice-design"),
    );
    expect(alert).toBeTruthy();

    const details = screen.getByTestId(
      "text-heygen-shape-drift-details-voice-design",
    );
    expect(details.textContent).toContain("heygen_shape_drift");
    expect(details.textContent).toContain("/v2/voices/design");
    expect(details.textContent).toContain("preview.voice_id");

    // The friendly retry block should be hidden in favour of the alert.
    expect(screen.queryByTestId("card-design-preview-error")).toBeNull();
  });
});
