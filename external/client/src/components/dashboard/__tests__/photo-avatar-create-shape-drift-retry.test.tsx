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
  fetchCalls = [];
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
  fireEvent.mouseDown(screen.getByTestId("tab-upload"));
  fireEvent.click(screen.getByTestId("tab-upload"));
  await waitFor(() => expect(screen.getByTestId("label-upload")).toBeTruthy());

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

describe("PhotoAvatarManager — create dialog HeyGen shape-drift retry", () => {
  it("shows the inline alert on shape-drift, preserves the form, and re-issues the create call when Retry is clicked", async () => {
    let createCallCount = 0;
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
        createCallCount++;
        if (createCallCount === 1) {
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
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response;
    }) as unknown as typeof fetch;

    renderManager();
    await gotoUploadTabAndAddFile();

    fireEvent.click(screen.getByTestId("checkbox-consent-acknowledged"));
    fireEvent.change(screen.getByTestId("input-consent-video-url"), {
      target: { value: "https://videos/consent.mp4" },
    });

    const submitBtn = (await waitFor(() =>
      screen.getByTestId("button-upload-files"),
    )) as HTMLButtonElement;
    await waitFor(() => expect(submitBtn.disabled).toBe(false));
    fireEvent.click(submitBtn);

    const dialog = await waitFor(() =>
      screen.getByTestId("dialog-group-name"),
    );
    const nameInput = screen.getByTestId(
      "input-group-name",
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Studio Headshots" } });

    fireEvent.click(screen.getByTestId("button-confirm-group"));

    // The inline shape-drift alert appears inside the dialog.
    const alert = await waitFor(() =>
      screen.getByTestId("alert-heygen-shape-drift-photo-avatar-create"),
    );
    expect(alert).toBeTruthy();

    const details = screen.getByTestId(
      "text-heygen-shape-drift-details-photo-avatar-create",
    );
    expect(details.textContent).toContain("heygen_shape_drift");
    expect(details.textContent).toContain("/v2/photo_avatar/photo/generate");
    expect(details.textContent).toContain("data.image_key_list.0");

    // Dialog stays open and the form inputs are preserved.
    expect(screen.getByTestId("dialog-group-name")).toBeTruthy();
    expect(
      (screen.getByTestId("input-group-name") as HTMLInputElement).value,
    ).toBe("Studio Headshots");
    expect(
      (screen.getByTestId("input-consent-video-url") as HTMLInputElement).value,
    ).toBe("https://videos/consent.mp4");
    expect(
      (screen.getByTestId("checkbox-consent-acknowledged") as HTMLInputElement)
        .getAttribute("data-state"),
    ).toBe("checked");
    // Selected file is still showing in the upload preview grid.
    expect(screen.getByTestId("button-remove-0")).toBeTruthy();

    expect(createCallCount).toBe(1);
    const uploadCallsBeforeRetry = fetchCalls.filter((c) =>
      c.url.endsWith("/api/photo-avatars/upload"),
    ).length;

    // Click Retry — should re-issue the create call without re-asking
    // for the form inputs and clear the alert on success.
    const retryBtn = screen.getByTestId(
      "button-retry-heygen-shape-drift-photo-avatar-create",
    );
    fireEvent.click(retryBtn);

    await waitFor(() => expect(createCallCount).toBeGreaterThanOrEqual(2));

    // The retry should send the same payload (group name, consent, etc.)
    const v3Calls = fetchCalls.filter(
      (c) =>
        c.url.endsWith("/api/v3/photo-avatars") &&
        (c.init?.method ?? "GET") === "POST",
    );
    expect(v3Calls.length).toBeGreaterThanOrEqual(2);
    const retryBody = JSON.parse(String(v3Calls[1].init?.body));
    expect(retryBody).toEqual(
      expect.objectContaining({
        name: "Studio Headshots",
        imageKey: "img_key_123",
        s3ImageUrl: "https://s3/img.jpg",
        imageHash: "hash_xyz",
        consentAcknowledged: true,
        consentVideoUrl: "https://videos/consent.mp4",
      }),
    );

    // Alert should clear after a successful retry.
    await waitFor(() =>
      expect(
        screen.queryByTestId("alert-heygen-shape-drift-photo-avatar-create"),
      ).toBeNull(),
    );

    // Sanity: a successful retry re-uploads and re-creates rather than
    // leaving the form half-submitted (uploads happen again because the
    // create handler runs end-to-end).
    const uploadCallsAfterRetry = fetchCalls.filter((c) =>
      c.url.endsWith("/api/photo-avatars/upload"),
    ).length;
    expect(uploadCallsAfterRetry).toBeGreaterThan(uploadCallsBeforeRetry);
  });
});
