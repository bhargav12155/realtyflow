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

import { PhotoAvatarManager } from "@/components/dashboard/photo-avatar-manager";

interface FetchCall {
  url: string;
  init?: RequestInit;
}
let fetchCalls: FetchCall[];
const realFetch = global.fetch;

function setupFetch() {
  fetchCalls = [];
  global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    fetchCalls.push({ url: u, init });

    if (u.endsWith("/api/photo-avatars/upload")) {
      return new Response(
        JSON.stringify({
          imageKey: "img_key_123",
          s3Url: "https://s3/img.jpg",
          imageHash: "hash_xyz",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ) as unknown as Response;
    }
    if (u.endsWith("/api/v3/photo-avatars") && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          success: true,
          groupId: "grp_xyz",
          apiVersion: "v3",
          consentStatus: "pending",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ) as unknown as Response;
    }
    // Default: empty response so the various tanstack queries don't blow up.
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof fetch;
}

function renderManager() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: async () => ({}) },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PhotoAvatarManager />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  setupFetch();
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL.
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

async function gotoUploadTabAndAddFile() {
  // Radix Tabs.Trigger activates on `mousedown`, so fireEvent.click alone
  // does not switch tabs in jsdom.
  fireEvent.mouseDown(screen.getByTestId("tab-upload"));
  fireEvent.click(screen.getByTestId("tab-upload"));
  await waitFor(() => expect(screen.getByTestId("label-upload")).toBeTruthy());

  // Add one file via the hidden file input.
  const fileInput = document.getElementById("photo-upload") as HTMLInputElement;
  expect(fileInput).toBeTruthy();
  const file = new File(["hello"], "headshot.jpg", { type: "image/jpeg" });
  Object.defineProperty(fileInput, "files", {
    value: [file],
    configurable: true,
  });
  fireEvent.change(fileInput);
  return file;
}

describe("PhotoAvatarManager — upload tab consent gate", () => {
  it("disables the Upload & Create button until the consent checkbox is checked", async () => {
    renderManager();
    await gotoUploadTabAndAddFile();

    const submitBtn = (await waitFor(() =>
      screen.getByTestId("button-upload-files"),
    )) as HTMLButtonElement;
    // Initially: consent NOT checked → button must be disabled.
    expect(submitBtn.disabled).toBe(true);

    // Check the consent box.
    const checkbox = screen.getByTestId("checkbox-consent-acknowledged");
    fireEvent.click(checkbox);

    await waitFor(() => expect(submitBtn.disabled).toBe(false));
  });

  it("submits to /api/v3/photo-avatars with the right payload after consent + group name are provided", async () => {
    renderManager();
    await gotoUploadTabAndAddFile();

    fireEvent.click(screen.getByTestId("checkbox-consent-acknowledged"));

    // Optional consent video URL field.
    fireEvent.change(screen.getByTestId("input-consent-video-url"), {
      target: { value: "https://videos/consent.mp4" },
    });

    // Click the upload submit button — opens the group-name dialog.
    const submitBtn = (await waitFor(() =>
      screen.getByTestId("button-upload-files"),
    )) as HTMLButtonElement;
    await waitFor(() => expect(submitBtn.disabled).toBe(false));
    fireEvent.click(submitBtn);

    // Type the group name in the dialog and confirm.
    const dialog = await waitFor(() => screen.getByTestId("dialog-group-name"));
    const nameInput = dialog.querySelector(
      'input[placeholder^="e.g.,"]',
    ) as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    fireEvent.change(nameInput, { target: { value: "Studio Headshots" } });

    // Find the confirm button inside the dialog (rendered as the only
    // primary button in the dialog body).
    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => /create avatar|create/i.test(b.textContent || ""),
    ) as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn);

    // Wait for the v3 endpoint to be hit.
    await waitFor(() =>
      expect(
        fetchCalls.some(
          (c) =>
            c.url.endsWith("/api/v3/photo-avatars") &&
            (c.init?.method ?? "GET") === "POST",
        ),
      ).toBe(true),
    );

    const photoUpload = fetchCalls.find((c) =>
      c.url.endsWith("/api/photo-avatars/upload"),
    );
    expect(photoUpload).toBeTruthy();

    const v3Call = fetchCalls.find(
      (c) =>
        c.url.endsWith("/api/v3/photo-avatars") &&
        (c.init?.method ?? "GET") === "POST",
    )!;
    const body = JSON.parse(String(v3Call.init?.body));
    expect(body).toEqual(
      expect.objectContaining({
        name: "Studio Headshots",
        imageKey: "img_key_123",
        s3ImageUrl: "https://s3/img.jpg",
        imageHash: "hash_xyz",
        consentAcknowledged: true,
        consentVideoUrl: "https://videos/consent.mp4",
      }),
    );
    expect((v3Call.init?.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(v3Call.init?.credentials).toBe("include");
  });

  it("surfaces a destructive toast with endpoint + issuePaths when /api/v3/photo-avatars returns heygen_shape_drift", async () => {
    // Replace the default fetch mock with one that returns the
    // shape-drift envelope from the v3 create endpoint.
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      fetchCalls.push({ url: u, init });
      if (u.endsWith("/api/photo-avatars/upload")) {
        return new Response(
          JSON.stringify({
            imageKey: "img_key_123",
            s3Url: "https://s3/img.jpg",
            imageHash: "hash_xyz",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ) as unknown as Response;
      }
      if (u.endsWith("/api/v3/photo-avatars") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            error: "heygen_shape_drift",
            endpoint: "/v2/photo_avatar/photo/generate",
            message:
              "HeyGen returned an unexpected response shape for /v2/photo_avatar/photo/generate. Please retry.",
            issuePaths: ["data.image_key_list.0"],
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ) as unknown as Response;
      }
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response;
    }) as unknown as typeof fetch;

    const toast = (await import("@/hooks/use-toast")).useToast()
      .toast as unknown as ReturnType<typeof vi.fn>;

    renderManager();
    await gotoUploadTabAndAddFile();
    fireEvent.click(screen.getByTestId("checkbox-consent-acknowledged"));

    const submitBtn = (await waitFor(() =>
      screen.getByTestId("button-upload-files"),
    )) as HTMLButtonElement;
    await waitFor(() => expect(submitBtn.disabled).toBe(false));
    fireEvent.click(submitBtn);

    const dialog = await waitFor(() => screen.getByTestId("dialog-group-name"));
    const nameInput = dialog.querySelector(
      'input[placeholder^="e.g.,"]',
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Studio Headshots" } });
    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => /create avatar|create/i.test(b.textContent || ""),
    ) as HTMLButtonElement;
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(
        toast.mock.calls.some((args) => {
          const arg = args[0] as { description?: string; variant?: string };
          return (
            arg?.variant === "destructive" &&
            typeof arg?.description === "string" &&
            arg.description.includes("/v2/photo_avatar/photo/generate") &&
            arg.description.includes("data.image_key_list.0")
          );
        }),
      ).toBe(true),
    );
  });
});
