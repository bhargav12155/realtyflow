import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiRequestMock = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  queryClient: { invalidateQueries: vi.fn() },
  getQueryFn:
    () =>
    async ({ queryKey }: { queryKey: unknown[] }) => {
      const [base] = queryKey as [string];
      if (base === "/api/ai-assistant/history") return { messages: [] };
      return null;
    },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }));

import AiAssistantPage from "@/pages/ai-assistant";

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ json: async () => ({}) });
  // jsdom does not implement scrollIntoView; the page calls it after every render.
  if (!(HTMLElement.prototype as any).scrollIntoView) {
    (HTMLElement.prototype as any).scrollIntoView = () => {};
  }
});
afterEach(() => cleanup());

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [base] = queryKey as [string];
          if (base === "/api/ai-assistant/history") return { messages: [] };
          return null;
        },
      },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AiAssistantPage />
    </QueryClientProvider>,
  );
}

describe("AI Assistant: self-avatar CTA short-circuit", () => {
  it("renders the Open Photo Avatars CTA and skips the chat POST", async () => {
    renderPage();
    const input = (await waitFor(() =>
      screen.getByTestId("input-message"),
    )) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "create an avatar of myself" } });
    const sendBtn = screen.getByTestId("button-send-message");
    fireEvent.click(sendBtn);

    const cta = await waitFor(() => screen.getByTestId("button-open-photo-avatars"));
    expect(cta.getAttribute("href")).toBe("/dashboard?action=upload#photo-avatars");
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      "POST",
      "/api/ai-assistant/chat",
      expect.anything(),
    );
  });

  it("clears local CTA messages when starting a new chat", async () => {
    renderPage();
    const input = (await waitFor(() =>
      screen.getByTestId("input-message"),
    )) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "create an avatar of myself" } });
    fireEvent.click(screen.getByTestId("button-send-message"));
    await waitFor(() => screen.getByTestId("button-open-photo-avatars"));
    fireEvent.click(screen.getByTestId("button-new-chat"));
    await waitFor(() => {
      expect(screen.queryByTestId("button-open-photo-avatars")).toBeNull();
    });
  });

  it("normal prompts still POST to /api/ai-assistant/chat", async () => {
    renderPage();
    const input = (await waitFor(() =>
      screen.getByTestId("input-message"),
    )) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "write a property description" } });
    fireEvent.click(screen.getByTestId("button-send-message"));
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalled();
    });
    const [method, url] = apiRequestMock.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/ai-assistant/chat");
  });
});
