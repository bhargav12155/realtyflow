import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { shouldAutoOpenUploadStep, clearUploadIntent } from "@/lib/uploadIntent";

describe("shouldAutoOpenUploadStep", () => {
  it("returns true when action=upload is present", () => {
    expect(shouldAutoOpenUploadStep("?action=upload")).toBe(true);
    expect(shouldAutoOpenUploadStep("action=upload")).toBe(true);
    expect(shouldAutoOpenUploadStep("?foo=bar&action=upload")).toBe(true);
  });

  it("returns false for other or missing actions", () => {
    expect(shouldAutoOpenUploadStep("")).toBe(false);
    expect(shouldAutoOpenUploadStep(null)).toBe(false);
    expect(shouldAutoOpenUploadStep(undefined)).toBe(false);
    expect(shouldAutoOpenUploadStep("?action=other")).toBe(false);
    expect(shouldAutoOpenUploadStep("?foo=bar")).toBe(false);
  });
});

describe("clearUploadIntent", () => {
  let replaceSpy: ReturnType<typeof vi.spyOn>;
  let originalHref: string;

  beforeEach(() => {
    originalHref = window.location.href;
    replaceSpy = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => {
    replaceSpy.mockRestore();
  });

  it("rewrites the URL without the action param while preserving pathname and hash", () => {
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/dashboard?action=upload#photo-avatars"),
      writable: true,
    });
    clearUploadIntent();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const target = String(replaceSpy.mock.calls[0][2]);
    expect(target).toBe("/dashboard#photo-avatars");
  });

  it("preserves other query params", () => {
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/dashboard?foo=bar&action=upload#photo-avatars"),
      writable: true,
    });
    clearUploadIntent();
    const target = String(replaceSpy.mock.calls[0][2]);
    expect(target).toBe("/dashboard?foo=bar#photo-avatars");
  });

  it("does nothing when no action param is present", () => {
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/dashboard#photo-avatars"),
      writable: true,
    });
    clearUploadIntent();
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
