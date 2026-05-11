import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import {
  HeygenShapeDriftAlert,
  parseShapeDriftFromApiError,
  shapeDriftToast,
  tryParseShapeDriftBody,
  type HeygenShapeDriftDetails,
} from "@/components/dashboard/heygen-shape-drift-alert";
import { HEYGEN_SHAPE_DRIFT_ERROR_CODE } from "@shared/heygenPhotoAvatarSchemas";

const v3Details: HeygenShapeDriftDetails = {
  endpoint: "/v3/photo_avatars/group-xyz/looks",
  message: "HeygenResponseValidationError: looks payload missing required fields",
  issuePaths: ["data.0.id", "data.0.image_url"],
};

beforeEach(() => {
  toastMock.mockReset();
});
afterEach(() => cleanup());

describe("tryParseShapeDriftBody (hidden-state gate)", () => {
  it("returns null for non-objects so callers do not surface the alert", () => {
    expect(tryParseShapeDriftBody(null)).toBeNull();
    expect(tryParseShapeDriftBody("not json")).toBeNull();
    expect(tryParseShapeDriftBody(42)).toBeNull();
  });

  it("returns null when the error code is missing or unrelated", () => {
    expect(tryParseShapeDriftBody({})).toBeNull();
    expect(
      tryParseShapeDriftBody({ error: "some_other_error", endpoint: "/v3/voices" }),
    ).toBeNull();
  });

  it("parses a v3 shape-drift envelope and normalises its fields", () => {
    const parsed = tryParseShapeDriftBody({
      error: HEYGEN_SHAPE_DRIFT_ERROR_CODE,
      endpoint: "/v3/voices",
      message: "voice_id must be a string",
      issuePaths: ["data.0.voice_id", 7, "data.1.gender"],
    });
    expect(parsed).toEqual({
      endpoint: "/v3/voices",
      message: "voice_id must be a string",
      issuePaths: ["data.0.voice_id", "data.1.gender"],
    });
  });

  it("falls back to placeholders when fields are blank or missing", () => {
    const parsed = tryParseShapeDriftBody({
      error: HEYGEN_SHAPE_DRIFT_ERROR_CODE,
      endpoint: "",
      message: "",
    });
    expect(parsed).toEqual({
      endpoint: "(unknown HeyGen endpoint)",
      message: "HeyGen returned an unexpected response shape.",
      issuePaths: [],
    });
  });
});

describe("parseShapeDriftFromApiError (hidden-state gate)", () => {
  it("returns null for non-Error inputs and unrelated bodies", () => {
    expect(parseShapeDriftFromApiError("oops")).toBeNull();
    expect(parseShapeDriftFromApiError(new Error("plain text only"))).toBeNull();
    expect(
      parseShapeDriftFromApiError(
        new Error('500: {"error":"some_other_error"}'),
      ),
    ).toBeNull();
  });

  it("extracts shape-drift details from a `${status}: ${body}` apiRequest error", () => {
    const body = JSON.stringify({
      error: HEYGEN_SHAPE_DRIFT_ERROR_CODE,
      endpoint: "/v3/avatars",
      message: "avatars list malformed",
      issuePaths: ["data.0.avatar_id"],
    });
    const parsed = parseShapeDriftFromApiError(new Error(`502: ${body}`));
    expect(parsed).toEqual({
      endpoint: "/v3/avatars",
      message: "avatars list malformed",
      issuePaths: ["data.0.avatar_id"],
    });
  });
});

describe("HeygenShapeDriftAlert (visible state)", () => {
  it("renders the v3 endpoint, scope line, and zod issue paths in the details block", () => {
    render(
      <HeygenShapeDriftAlert
        details={v3Details}
        scope="v3-looks"
        scopeLabel="group"
        scopeValue="group-xyz"
        action="loading the v3 looks panel"
      />,
    );

    const alert = screen.getByTestId("alert-heygen-shape-drift-v3-looks");
    expect(alert).not.toBeNull();
    const scoped = within(alert);

    expect(scoped.getByText(/HeyGen returned an unexpected response shape/i)).not.toBeNull();
    expect(
      scoped.getByText(/loading the v3 looks panel/i),
    ).not.toBeNull();

    const details = scoped.getByTestId("text-heygen-shape-drift-details-v3-looks");
    expect(details.textContent).toContain(`error:    ${HEYGEN_SHAPE_DRIFT_ERROR_CODE}`);
    expect(details.textContent).toContain("endpoint: /v3/photo_avatars/group-xyz/looks");
    expect(details.textContent).toContain("group   : group-xyz");
    expect(details.textContent).toContain("issues:   data.0.id, data.0.image_url");
    expect(details.textContent).toContain(
      "message:  HeygenResponseValidationError: looks payload missing required fields",
    );
  });

  it("omits the scope line when scopeLabel/scopeValue are not provided and shows '(none)' for empty issues", () => {
    render(
      <HeygenShapeDriftAlert
        details={{
          endpoint: "/v3/voices",
          message: "voices payload bad",
          issuePaths: [],
        }}
        scope="voices"
        action="loading voices"
      />,
    );
    const details = screen.getByTestId("text-heygen-shape-drift-details-voices");
    expect(details.textContent).toContain("issues:   (none)");
    expect(details.textContent).not.toMatch(/group\s*:/);
  });

  it("hides the retry button when no onRetry handler is supplied", () => {
    render(
      <HeygenShapeDriftAlert
        details={v3Details}
        scope="v3-looks"
        action="loading the v3 looks panel"
      />,
    );
    expect(
      screen.queryByTestId("button-retry-heygen-shape-drift-v3-looks"),
    ).toBeNull();
    expect(
      screen.getByTestId("button-copy-heygen-shape-drift-v3-looks"),
    ).not.toBeNull();
  });

  it("shows a retry button that invokes onRetry and renders a spinner while pending", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <HeygenShapeDriftAlert
        details={v3Details}
        scope="v3-looks"
        action="loading the v3 looks panel"
        onRetry={onRetry}
      />,
    );
    const retry = screen.getByTestId("button-retry-heygen-shape-drift-v3-looks");
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    expect(retry.textContent).toMatch(/Retry/);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <HeygenShapeDriftAlert
        details={v3Details}
        scope="v3-looks"
        action="loading the v3 looks panel"
        onRetry={onRetry}
        isRetrying
      />,
    );
    const retryPending = screen.getByTestId(
      "button-retry-heygen-shape-drift-v3-looks",
    );
    expect((retryPending as HTMLButtonElement).disabled).toBe(true);
    expect(retryPending.textContent).toMatch(/Retrying/);
  });

  it("copies a normalised details blob to the clipboard and toasts on success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <HeygenShapeDriftAlert
        details={v3Details}
        scope="v3-looks"
        scopeLabel="group"
        scopeValue="group-xyz"
        action="loading the v3 looks panel"
      />,
    );
    fireEvent.click(
      screen.getByTestId("button-copy-heygen-shape-drift-v3-looks"),
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const blob = writeText.mock.calls[0][0] as string;
    // Normalised blob collapses the column padding to a single space.
    expect(blob).toContain(`error: ${HEYGEN_SHAPE_DRIFT_ERROR_CODE}`);
    expect(blob).toContain("endpoint: /v3/photo_avatars/group-xyz/looks");
    // The scope line keeps its padded label ("group   :") because only the
    // leading column gets collapsed; we still want to see the value rendered.
    expect(blob).toContain("group-xyz");
    expect(blob).toContain("issues: data.0.id, data.0.image_url");
    expect(blob).not.toMatch(/error: {2,}/);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copied error details" }),
      ),
    );
  });

  it("falls back to a destructive toast when the clipboard write rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(global.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <HeygenShapeDriftAlert
        details={v3Details}
        scope="v3-looks"
        action="loading the v3 looks panel"
      />,
    );
    fireEvent.click(
      screen.getByTestId("button-copy-heygen-shape-drift-v3-looks"),
    );

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't copy automatically",
          variant: "destructive",
        }),
      ),
    );
  });
});

describe("shapeDriftToast", () => {
  it("packages a v3 endpoint and issue list into a forwardable description", () => {
    const t = shapeDriftToast(v3Details);
    expect(t.title).toMatch(/HeyGen returned an unexpected response shape/i);
    expect(t.description).toContain("endpoint: /v3/photo_avatars/group-xyz/looks");
    expect(t.description).toContain("issues: data.0.id, data.0.image_url");
    expect(t.description).toContain(v3Details.message);
  });

  it("shows '(none)' when no issue paths were captured", () => {
    const t = shapeDriftToast({
      endpoint: "/v3/voices",
      message: "boom",
      issuePaths: [],
    });
    expect(t.description).toContain("issues: (none)");
  });
});
