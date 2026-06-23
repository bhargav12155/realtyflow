import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  within,
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
vi.mock("../avatar-photo-gallery", () => ({
  AvatarPhotoGallery: () => null,
}));
vi.mock("../voice-library-manager", () => ({
  VoiceLibraryManager: () => (
    <div data-testid="mock-voice-library">Voice Library Mock</div>
  ),
}));
vi.mock("heic2any", () => ({ default: vi.fn() }));

import { PhotoAvatarManager } from "@/components/dashboard/photo-avatar-manager";

interface SeededGroup {
  group_id: string;
  name: string;
  status: string;
  train_status?: string;
  avatar_count?: number;
  num_looks?: number;
  preview_image?: string;
  created_at: number | string;
}

const realFetch = global.fetch;

function setupFetch() {
  // The Manage tab tests don't go through the upload flow; the only fetch
  // calls that fire come from the Generate tab's polling (started by
  // setInterval), which we don't wait on. Return an empty body so any
  // stray call doesn't blow up.
  global.fetch = vi.fn(
    async () =>
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as Response,
  ) as unknown as typeof fetch;
}

function makeJsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  };
}

function renderManager(seedGroups: SeededGroup[] = []) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async ({ queryKey }) => {
          const key = String(queryKey[0]);
          if (key === "/api/photo-avatars/groups") {
            return { avatar_group_list: seedGroups };
          }
          if (key === "/api/photo-avatars/all-looks") {
            return { looks: [] };
          }
          return {};
        },
      },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PhotoAvatarManager />
    </QueryClientProvider>,
  );
}

function activateTab(testId: string) {
  // Radix Tabs.Trigger activates on `mousedown`, so fireEvent.click alone
  // does not switch tabs in jsdom.
  const trigger = screen.getByTestId(testId);
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
}

beforeEach(() => {
  apiRequestMock.mockReset();
  toastMock.mockReset();
  // Default: any apiRequest call resolves to a Response-like object whose
  // `.json()` returns an empty object. Individual tests can override.
  apiRequestMock.mockResolvedValue(makeJsonResponse({}));
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

// -----------------------------------------------------------------
// Generate tab
// -----------------------------------------------------------------
describe("PhotoAvatarManager — Generate tab", () => {
  it("renders the generate form and triggers /api/photo-avatars/generate-photos when clicked", async () => {
    apiRequestMock.mockResolvedValueOnce(
      makeJsonResponse({ generation_id: "gen_1" }),
    );

    renderManager();

    // The Generate tab is the default selection.
    expect(screen.getByTestId("input-avatar-name")).toBeTruthy();
    expect(screen.getByTestId("textarea-appearance")).toBeTruthy();

    const btn = screen.getByTestId("button-generate") as HTMLButtonElement;
    fireEvent.click(btn);

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    const generateCall = apiRequestMock.mock.calls.find(
      (c) => c[1] === "/api/photo-avatars/generate-photos",
    );
    expect(generateCall).toBeTruthy();
    expect(generateCall![0]).toBe("POST");
    expect(generateCall![2]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        age: expect.any(String),
        gender: expect.any(String),
        appearance: expect.any(String),
      }),
    );
  });
});

// -----------------------------------------------------------------
// Voice Recording tab
// -----------------------------------------------------------------
describe("PhotoAvatarManager — Voice Recording tab", () => {
  it("shows the recording controls and the avatar-group picker when groups exist", async () => {
    renderManager([
      {
        group_id: "g_voice",
        name: "Voice Group",
        status: "ready",
        train_status: "ready",
        avatar_count: 4,
        num_looks: 5,
        created_at: 1700000000,
      },
    ]);

    activateTab("tab-voice");

    await waitFor(() =>
      expect(screen.getByTestId("button-start-recording")).toBeTruthy(),
    );
    // Group picker is rendered when there is at least one group.
    expect(screen.getByTestId("select-avatar-group-voice")).toBeTruthy();
  });
});

// -----------------------------------------------------------------
// Voice Library tab
// -----------------------------------------------------------------
describe("PhotoAvatarManager — Voice Library tab", () => {
  it("mounts the VoiceLibraryManager when the Voice Library tab is selected", async () => {
    renderManager();

    activateTab("tab-voice-library");

    await waitFor(() =>
      expect(screen.getByTestId("mock-voice-library")).toBeTruthy(),
    );
  });
});

// -----------------------------------------------------------------
// Manage Groups tab
// -----------------------------------------------------------------
describe("PhotoAvatarManager — Manage Groups tab", () => {
  // One group needs training (status=completed, untrained), one is fully
  // trained (so the looks/outfit/motion buttons are visible).
  const groups: SeededGroup[] = [
    {
      group_id: "g_untrained",
      name: "Untrained Group",
      status: "completed",
      // train_status intentionally undefined so the auto-train effect (which
      // only fires on "empty") does not run during the test.
      avatar_count: 4,
      num_looks: 0,
      preview_image: "https://img/u.jpg",
      created_at: 1700000000,
    },
    {
      group_id: "g_trained",
      name: "Trained Group",
      status: "ready",
      train_status: "ready",
      // num_looks >= 3 prevents the auto-look-generation effect from firing.
      avatar_count: 4,
      num_looks: 5,
      preview_image: "https://img/t.jpg",
      created_at: 1700000000,
    },
  ];

  function clearAfterMount() {
    // Drop any apiRequest calls fired by mount-time effects so each test
    // can assert just on the calls produced by the click it performs.
    apiRequestMock.mockClear();
  }

  it("clicking 'Train Avatar' on an untrained group POSTs to .../train", async () => {
    renderManager(groups);
    activateTab("tab-manage");

    const trainBtn = await waitFor(() =>
      screen.getByTestId("button-train-g_untrained"),
    );
    clearAfterMount();
    fireEvent.click(trainBtn);

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/photo-avatars/groups/g_untrained/train",
      undefined,
    );
  });

  it("clicking 'Generate 4 Looks' on a trained group POSTs 4x to .../proxy-generate-look", async () => {
    renderManager(groups);
    activateTab("tab-manage");

    const looksBtn = await waitFor(() =>
      screen.getByTestId("button-looks-g_trained"),
    );
    clearAfterMount();
    fireEvent.click(looksBtn);

    await waitFor(() =>
      expect(
        apiRequestMock.mock.calls.filter(
          (c) =>
            c[1] === "/api/photo-avatars/groups/g_trained/proxy-generate-look",
        ).length,
      ).toBe(4),
    );
    // Each call uses the proxy-look payload shape the hook builds.
    const sample = apiRequestMock.mock.calls.find(
      (c) =>
        c[1] === "/api/photo-avatars/groups/g_trained/proxy-generate-look",
    )!;
    expect(sample[0]).toBe("POST");
    expect(sample[2]).toEqual(
      expect.objectContaining({
        prompt: expect.any(String),
        orientation: "square",
        pose: "half_body",
        style: "Realistic",
      }),
    );
  });

  it("'Change Outfit' opens the dialog and submitting it POSTs to .../proxy-generate-look", async () => {
    renderManager(groups);
    activateTab("tab-manage");

    const outfitBtn = await waitFor(() =>
      screen.getByTestId("button-change-outfit-g_trained"),
    );
    clearAfterMount();
    fireEvent.click(outfitBtn);

    const promptInput = await waitFor(() =>
      screen.getByTestId("textarea-edit-prompt"),
    );
    fireEvent.change(promptInput, {
      target: { value: "Navy blazer with white shirt" },
    });

    const generateBtn = screen.getByTestId(
      "button-generate-edit",
    ) as HTMLButtonElement;
    await waitFor(() => expect(generateBtn.disabled).toBe(false));
    fireEvent.click(generateBtn);

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    const editCall = apiRequestMock.mock.calls.find(
      (c) =>
        c[1] === "/api/photo-avatars/groups/g_trained/proxy-generate-look",
    );
    expect(editCall).toBeTruthy();
    expect(editCall![0]).toBe("POST");
    expect(editCall![2]).toEqual(
      expect.objectContaining({
        prompt: "Navy blazer with white shirt",
        orientation: "square",
        pose: "half_body",
        style: "Realistic",
        numLooks: 1,
      }),
    );
  });

  it("'Add Motion' opens the dialog and submitting it POSTs to .../add-motion", async () => {
    renderManager(groups);
    activateTab("tab-manage");

    const motionBtn = await waitFor(() =>
      screen.getByTestId("button-motion-g_trained"),
    );
    clearAfterMount();
    fireEvent.click(motionBtn);

    const addBtn = await waitFor(() => screen.getByTestId("button-add-motion"));
    fireEvent.click(addBtn);

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/photo-avatars/g_trained/add-motion",
      expect.objectContaining({ motionType: "consistent" }),
    );
  });

  it("'Delete' from the group dropdown DELETEs the group after confirm", async () => {
    renderManager(groups);
    activateTab("tab-manage");

    const menuTrigger = await waitFor(() =>
      screen.getByTestId("button-menu-group-g_trained"),
    );
    clearAfterMount();
    // Radix dropdown menu opens on pointerdown; click also works in jsdom.
    fireEvent.pointerDown(menuTrigger, { button: 0 });
    fireEvent.click(menuTrigger);

    const deleteItem = await waitFor(() =>
      screen.getByTestId("button-menu-delete-g_trained"),
    );
    fireEvent.click(deleteItem);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "DELETE",
        "/api/photo-avatars/groups/g_trained",
      ),
    );
  });

  it("avoids `within` warnings — group cards are rendered with stable test ids", async () => {
    renderManager(groups);
    activateTab("tab-manage");
    const card = await waitFor(() =>
      screen.getByTestId("card-group-g_trained"),
    );
    expect(within(card).getByTestId("button-looks-g_trained")).toBeTruthy();
  });
});
