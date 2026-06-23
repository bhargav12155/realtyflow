import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  downloadFile: vi.fn(),
  getQueryFn: () => async () => ({}),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isAuthenticated: true }),
}));
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({ isConnected: false, lastMessage: null }),
}));
vi.mock("@/lib/businessContext", () => ({
  useBusinessType: () => ({ businessType: "real_estate", terms: {} }),
}));
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => vi.fn(async () => true),
}));
vi.mock("heic2any", () => ({ default: vi.fn() }));

import { AvatarIVStudio } from "@/components/dashboard/avatar-iv-studio";

let originalLocation: Location;

beforeEach(() => {
  originalLocation = window.location;
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

function renderStudio(search: string) {
  Object.defineProperty(window, "location", {
    value: new URL(`http://localhost/dashboard${search}#photo-avatars`),
    writable: true,
    configurable: true,
  });
  const replaceSpy = vi
    .spyOn(window.history, "replaceState")
    .mockImplementation(() => {});
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: async () => ({}) },
      mutations: { retry: false },
    },
  });
  const { hook } = memoryLocation({ path: "/dashboard", record: true });
  const utils = render(
    <QueryClientProvider client={qc}>
      <Router hook={hook}>
        <AvatarIVStudio />
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, replaceSpy };
}

describe("AvatarIVStudio upload intent", () => {
  it("mounts on Step 1 with the Upload tab active when ?action=upload is present", async () => {
    renderStudio("?action=upload");

    const step1Content = await waitFor(() =>
      screen.getByTestId("step-1-content"),
    );
    expect(step1Content).toBeTruthy();

    // Upload tab should be the active tab variant (not the library tab).
    await waitFor(() => {
      const uploadTab = screen.getByTestId("tab-upload");
      expect(uploadTab.className).toContain("bg-[#D4AF37]");
    });
  });

  it("shows the library tab by default when no upload intent is present", async () => {
    renderStudio("");

    const step1Content = await waitFor(() =>
      screen.getByTestId("step-1-content"),
    );
    expect(step1Content).toBeTruthy();

    const libraryTab = screen.getByTestId("tab-library");
    expect(libraryTab.className).toContain("bg-[#D4AF37]");
  });
});
