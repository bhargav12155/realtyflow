import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";

// Mock apiRequest before importing the component so the mutations use our spy.
const apiRequestMock = vi.fn();
vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>(
    "@/lib/queryClient",
  );
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  };
});

import { queryClient } from "@/lib/queryClient";

// Toast hook: capture invocations so we can assert on them and avoid
// pulling in the real toaster's side-effects.
const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
}));

import { VoiceLibraryManager } from "@/components/dashboard/voice-library-manager";

function renderUnderQueryClient() {
  // Use the same exported queryClient the component reaches for when it
  // calls invalidateQueries — otherwise post-save refetches go to a
  // different cache than the one we render with.
  return render(
    <QueryClientProvider client={queryClient}>
      <VoiceLibraryManager />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  queryClient.clear();

  // Default fetch stub: empty voice library, empty browse page, empty audio blobs.
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.startsWith("/api/custom-voices")) return jsonResponse([]);
    if (u.startsWith("/api/v3/voices")) return jsonResponse({ data: [], nextCursor: null });
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);

  // Radix UI internals occasionally call these; jsdom doesn't implement them.
  if (!("hasPointerCapture" in Element.prototype)) {
    Object.defineProperty(Element.prototype, "hasPointerCapture", {
      value: () => false,
      configurable: true,
    });
  }
  if (!("scrollIntoView" in Element.prototype)) {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: () => {},
      configurable: true,
    });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function switchToDesignTab() {
  const tab = await screen.findByTestId("tab-voice-design");
  // Radix Tabs activates on pointerdown then click.
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
  await screen.findByTestId("card-voice-design");
}

function fillDescription(value: string) {
  const ta = screen.getByTestId("textarea-design-description") as HTMLTextAreaElement;
  fireEvent.change(ta, { target: { value } });
}

function fillName(value: string) {
  const input = screen.getByTestId("input-design-name") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

describe("VoiceLibraryManager — Design tab", () => {
  it("clicking Preview shows the audio player and the save/try-again controls", async () => {
    apiRequestMock.mockResolvedValueOnce(
      jsonResponse({
        preview: {
          heygenVoiceId: "voice_preview_1",
          previewUrl: "https://heygen/preview-1.mp3",
          language: null,
          gender: null,
        },
      }),
    );

    renderUnderQueryClient();
    await switchToDesignTab();

    fillDescription("warm friendly female narrator");
    fireEvent.click(screen.getByTestId("button-preview-design-voice"));

    // Preview card + audio element show up after the mutation resolves.
    const previewCard = await screen.findByTestId("card-design-preview");
    expect(previewCard).toBeTruthy();
    const audio = await screen.findByTestId("audio-design-preview") as HTMLAudioElement;
    expect(audio.getAttribute("src")).toBe("https://heygen/preview-1.mp3");

    // Save + try-again controls are now visible; the original Preview button is gone.
    expect(screen.getByTestId("button-save-design-voice")).toBeTruthy();
    expect(screen.getByTestId("button-try-again-design-voice")).toBeTruthy();
    expect(screen.queryByTestId("button-preview-design-voice")).toBeNull();

    // The preview-only call MUST send save:false and the description.
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [method, url, body] = apiRequestMock.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/v3/voices/design");
    expect(body).toMatchObject({
      description: "warm friendly female narrator",
      save: false,
    });
  });

  it("Try again clears the preview and returns to the Preview button", async () => {
    apiRequestMock.mockResolvedValueOnce(
      jsonResponse({
        preview: {
          heygenVoiceId: "voice_preview_2",
          previewUrl: "https://heygen/preview-2.mp3",
          language: null,
          gender: null,
        },
      }),
    );

    renderUnderQueryClient();
    await switchToDesignTab();

    fillDescription("calm british male");
    fireEvent.click(screen.getByTestId("button-preview-design-voice"));
    await screen.findByTestId("audio-design-preview");

    fireEvent.click(screen.getByTestId("button-try-again-design-voice"));

    // Preview card + audio go away; Preview button comes back.
    await waitFor(() => {
      expect(screen.queryByTestId("audio-design-preview")).toBeNull();
      expect(screen.queryByTestId("card-design-preview")).toBeNull();
      expect(screen.getByTestId("button-preview-design-voice")).toBeTruthy();
    });
  });

  it("rate-limited preview shows a friendly toast + inline retry block; Retry re-fires the request", async () => {
    // First call fails with a typed 429; second call succeeds.
    apiRequestMock.mockRejectedValueOnce(
      new Error(
        '429: ' +
          JSON.stringify({
            error: "voice_design_rate_limited",
            message: "rate limit exceeded",
          }),
      ),
    );
    apiRequestMock.mockResolvedValueOnce(
      jsonResponse({
        preview: {
          heygenVoiceId: "voice_after_retry",
          previewUrl: "https://heygen/after-retry.mp3",
          language: null,
          gender: null,
        },
      }),
    );

    renderUnderQueryClient();
    await switchToDesignTab();

    fillDescription("warm friendly female narrator");
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-preview-design-voice"));
    });

    // Inline error block appears with friendly copy + a Retry button.
    const errCard = await screen.findByTestId("card-design-preview-error");
    expect(errCard).toBeTruthy();
    expect(
      screen.getByTestId("text-design-preview-error-title").textContent,
    ).toBe("Too many requests");
    expect(
      screen.getByTestId("text-design-preview-error-message").textContent,
    ).toContain("rate-limiting");
    expect(screen.getByTestId("button-retry-design-preview")).toBeTruthy();

    // Form selections must still be intact (so the retry uses them).
    expect(
      (screen.getByTestId("textarea-design-description") as HTMLTextAreaElement)
        .value,
    ).toBe("warm friendly female narrator");

    // Toast was fired with the friendly title/description.
    expect(toastMock).toHaveBeenCalled();
    const lastToast = toastMock.mock.calls[toastMock.mock.calls.length - 1][0];
    expect(lastToast.title).toBe("Too many requests");
    expect(lastToast.variant).toBe("destructive");

    // Click Retry — fires another preview call and the success path
    // replaces the error block with the audio preview.
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-retry-design-preview"));
    });
    await screen.findByTestId("audio-design-preview");
    expect(screen.queryByTestId("card-design-preview-error")).toBeNull();
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it("invalid-description error maps to 'Description not accepted' copy", async () => {
    apiRequestMock.mockRejectedValueOnce(
      new Error(
        '400: ' +
          JSON.stringify({
            error: "voice_design_invalid_description",
            message: "moderation rejected the description",
          }),
      ),
    );

    renderUnderQueryClient();
    await switchToDesignTab();
    fillDescription("anything");
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-preview-design-voice"));
    });

    await screen.findByTestId("card-design-preview-error");
    expect(
      screen.getByTestId("text-design-preview-error-title").textContent,
    ).toBe("Description not accepted");
    expect(
      screen.getByTestId("text-design-preview-error-message").textContent,
    ).toMatch(/reword/i);
    const lastToast = toastMock.mock.calls[toastMock.mock.calls.length - 1][0];
    expect(lastToast.title).toBe("Description not accepted");
  });

  it("voice quota exceeded error maps to 'Voice quota reached' copy", async () => {
    apiRequestMock.mockRejectedValueOnce(
      new Error(
        '402: ' +
          JSON.stringify({
            error: "voice_design_quota_exceeded",
            message: "quota exhausted",
          }),
      ),
    );

    renderUnderQueryClient();
    await switchToDesignTab();
    fillDescription("anything");
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-preview-design-voice"));
    });

    await screen.findByTestId("card-design-preview-error");
    expect(
      screen.getByTestId("text-design-preview-error-title").textContent,
    ).toBe("Voice quota reached");
    expect(
      screen.getByTestId("text-design-preview-error-message").textContent,
    ).toMatch(/quota/i);
  });

  it("save error surfaces the friendly toast title (not the generic 'Save Failed')", async () => {
    // 1) preview ok
    apiRequestMock.mockResolvedValueOnce(
      jsonResponse({
        preview: {
          heygenVoiceId: "voice_p",
          previewUrl: "https://heygen/p.mp3",
          language: null,
          gender: null,
        },
      }),
    );
    // 2) save fails with a typed quota error
    apiRequestMock.mockRejectedValueOnce(
      new Error(
        '402: ' +
          JSON.stringify({
            error: "voice_design_quota_exceeded",
            message: "quota exhausted",
          }),
      ),
    );

    renderUnderQueryClient();
    await switchToDesignTab();
    fillDescription("anything");
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-preview-design-voice"));
    });
    await screen.findByTestId("audio-design-preview");

    fillName("My Voice");
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-save-design-voice"));
    });

    await waitFor(() => {
      const lastToast = toastMock.mock.calls[toastMock.mock.calls.length - 1][0];
      expect(lastToast.title).toBe("Voice quota reached");
      expect(lastToast.variant).toBe("destructive");
    });
  });

  it("Save to library calls the API with a name and the previewed voice id, and refreshes the library", async () => {
    // 1) preview call
    apiRequestMock.mockResolvedValueOnce(
      jsonResponse({
        preview: {
          heygenVoiceId: "voice_preview_3",
          previewUrl: "https://heygen/preview-3.mp3",
          language: null,
          gender: null,
        },
      }),
    );
    // 2) save call returns the persisted voice row
    apiRequestMock.mockResolvedValueOnce(
      jsonResponse({
        id: "row-1",
        name: "My Saved Voice",
        heygenVoiceId: "voice_preview_3",
      }),
    );

    renderUnderQueryClient();
    await switchToDesignTab();

    fillDescription("warm friendly female narrator");
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-preview-design-voice"));
    });
    await screen.findByTestId("audio-design-preview");

    fillName("My Saved Voice");
    await act(async () => {
      fireEvent.click(screen.getByTestId("button-save-design-voice"));
    });

    // The save call should send the previewed voice id back so the
    // server can persist it without re-synthesising.
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledTimes(2);
    });
    const [method, url, body] = apiRequestMock.mock.calls[1];
    expect(method).toBe("POST");
    expect(url).toBe("/api/v3/voices/design");
    expect(body).toMatchObject({
      name: "My Saved Voice",
      previewVoiceId: "voice_preview_3",
      previewUrl: "https://heygen/preview-3.mp3",
    });
    // Crucially, the save call must NOT include save:false.
    expect((body as { save?: unknown }).save).toBeUndefined();

    // The library is re-fetched after a successful save.
    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: [string][] } })
        .mock.calls;
      const customVoiceFetches = calls.filter(([u]) =>
        u.startsWith("/api/custom-voices"),
      );
      // At least one initial fetch + one re-fetch after invalidation.
      expect(customVoiceFetches.length).toBeGreaterThanOrEqual(2);
    });

    // Form is reset back to the empty state with the Preview button visible.
    await waitFor(() => {
      expect(screen.queryByTestId("audio-design-preview")).toBeNull();
      expect(screen.getByTestId("button-preview-design-voice")).toBeTruthy();
      expect(
        (screen.getByTestId("input-design-name") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByTestId("textarea-design-description") as HTMLTextAreaElement).value,
      ).toBe("");
    });
  });
});
