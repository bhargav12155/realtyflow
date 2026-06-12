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
const invalidateMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: (...args: unknown[]) => invalidateMock(...args) },
  getQueryFn: () => async () => ({}),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { VoiceLibraryManager } from "@/components/dashboard/voice-library-manager";

const realFetch = global.fetch;

const SEED_VOICE = {
  id: "v_1",
  userId: "user-1",
  name: "Original Name",
  audioUrl: "https://s3/v.mp3",
  duration: null,
  fileSize: 1234,
  heygenAudioAssetId: "asset_x",
  heygenVoiceId: "voice_x",
  language: null,
  gender: null,
  sampleAudioUrl: null,
  status: "ready" as const,
  createdAt: new Date().toISOString(),
};

function setupFetch() {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/api/custom-voices") && !u.includes("/audio") && !u.includes("/api/v3/")) {
      return new Response(JSON.stringify([SEED_VOICE]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response;
    }
    if (u.includes("/audio")) {
      // Audio fetch isn't relevant to the rename flow under test.
      return new Response(null, { status: 204 }) as unknown as Response;
    }
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof fetch;
}

function renderManager() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = queryKey[0];
          if (key === "/api/custom-voices") return [SEED_VOICE];
          return {};
        },
      },
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
  invalidateMock.mockReset();
  setupFetch();
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:mock"),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
});

async function openRenameEditor() {
  await waitFor(() =>
    expect(screen.getByTestId("text-voice-name-v_1")).toBeTruthy(),
  );
  fireEvent.click(screen.getByTestId("button-rename-voice-v_1"));
  return (await waitFor(() =>
    screen.getByTestId("input-rename-voice-v_1"),
  )) as HTMLInputElement;
}

describe("VoiceLibraryManager — inline rename editor", () => {
  it("opens the editor when the pencil is clicked, prefilled with the current name", async () => {
    renderManager();
    const input = await openRenameEditor();
    expect(input.value).toBe("Original Name");
  });

  it("saves the new name on Enter, calls PATCH and invalidates the voices query", async () => {
    apiRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ ...SEED_VOICE, name: "Brand New" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    renderManager();
    const input = await openRenameEditor();
    fireEvent.change(input, { target: { value: "Brand New" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith("PATCH", "/api/custom-voices/v_1", {
      name: "Brand New",
    });
    await waitFor(() =>
      expect(invalidateMock).toHaveBeenCalledWith({ queryKey: ["/api/custom-voices"] }),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Voice Renamed" }),
      ),
    );
  });

  it("cancels the editor on Escape without calling PATCH", async () => {
    renderManager();
    const input = await openRenameEditor();
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("input-rename-voice-v_1")).toBeNull(),
    );
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("shows an error toast and does not PATCH when the name is empty/whitespace", async () => {
    renderManager();
    const input = await openRenameEditor();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Name Required",
          variant: "destructive",
        }),
      ),
    );
    expect(apiRequestMock).not.toHaveBeenCalled();
    // Editor stays open so the user can fix the name.
    expect(screen.getByTestId("input-rename-voice-v_1")).toBeTruthy();
  });

  it("shows an error toast and does not PATCH when the name exceeds 100 characters", async () => {
    renderManager();
    const input = await openRenameEditor();
    // The Input has maxLength=100, so we bypass it by setting the value
    // through fireEvent.change which doesn't enforce maxLength in jsdom.
    fireEvent.change(input, { target: { value: "a".repeat(101) } });
    // Click the explicit save button so we don't rely on Enter, which
    // also exercises the same submitRename path.
    fireEvent.click(screen.getByTestId("button-save-rename-v_1"));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Name Too Long",
          variant: "destructive",
        }),
      ),
    );
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("cancels via the X button without calling PATCH", async () => {
    renderManager();
    await openRenameEditor();
    fireEvent.click(screen.getByTestId("button-cancel-rename-v_1"));
    await waitFor(() =>
      expect(screen.queryByTestId("input-rename-voice-v_1")).toBeNull(),
    );
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});
