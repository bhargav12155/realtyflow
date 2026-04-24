import { describe, it, expect } from "vitest";
import {
  colorFor,
  colorHexFor,
  initialsFor,
  labelFor,
} from "../presence-colors";

describe("presence-colors", () => {
  describe("colorFor / colorHexFor", () => {
    it("is deterministic for the same id", () => {
      expect(colorFor("u-alice")).toBe(colorFor("u-alice"));
      expect(colorHexFor("u-alice")).toBe(colorHexFor("u-alice"));
    });

    it("returns Tailwind bg utility classes", () => {
      expect(colorFor("u-alice")).toMatch(/^bg-[a-z]+-500$/);
    });

    it("returns CSS hex strings", () => {
      expect(colorHexFor("u-alice")).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("colorFor and colorHexFor agree on the palette index for the same id", () => {
      // The bg class and the hex must come from the same palette entry,
      // otherwise the cursor SVG fill would not match the cursor label
      // background and the avatar circle.
      const ids = ["a", "u-bob", "long-id-1234567890", "x"];
      for (const id of ids) {
        const bg = colorFor(id); // e.g. "bg-rose-500"
        const family = bg.replace(/^bg-/, "").replace(/-500$/, ""); // "rose"
        const hex = colorHexFor(id);
        const expectedHexByFamily: Record<string, string> = {
          rose: "#f43f5e",
          amber: "#f59e0b",
          emerald: "#10b981",
          sky: "#0ea5e9",
          violet: "#8b5cf6",
          pink: "#ec4899",
          teal: "#14b8a6",
          indigo: "#6366f1",
        };
        expect(hex).toBe(expectedHexByFamily[family]);
      }
    });

    it("distributes across the palette for varied ids", () => {
      const ids = Array.from({ length: 50 }, (_, i) => `user-${i}`);
      const distinct = new Set(ids.map(colorFor));
      // With 50 ids and an 8-color palette we expect more than 1 bucket used.
      expect(distinct.size).toBeGreaterThan(1);
    });
  });

  describe("initialsFor", () => {
    it("uses the first two name parts when a full name is present", () => {
      expect(initialsFor("Alice Anders", "alice@example.com")).toBe("AA");
    });

    it("uses the first two letters of a single-word name", () => {
      expect(initialsFor("Cher", null)).toBe("CH");
    });

    it("falls back to email-derived initials when name is missing", () => {
      // "casey@example.com" splits on @/. into ["casey","example","com"]
      // → first letters of the first two parts.
      expect(initialsFor(null, "casey@example.com")).toBe("CE");
    });

    it("treats whitespace-only names as missing", () => {
      expect(initialsFor("   ", "bob@example.com")).toBe("BE");
    });

    it("returns '?' when both name and email are absent", () => {
      expect(initialsFor(null, null)).toBe("?");
      expect(initialsFor(undefined, undefined)).toBe("?");
    });

    it("uppercases the result regardless of input casing", () => {
      expect(initialsFor("dana diaz", null)).toBe("DD");
    });
  });

  describe("labelFor", () => {
    it("prefers display name when present", () => {
      expect(
        labelFor({ name: "Alice Anders", email: "alice@example.com" }),
      ).toBe("Alice Anders");
    });

    it("falls back to email when name is missing or blank", () => {
      expect(labelFor({ name: null, email: "alice@example.com" })).toBe(
        "alice@example.com",
      );
      expect(labelFor({ name: "   ", email: "alice@example.com" })).toBe(
        "alice@example.com",
      );
    });

    it("falls back to 'Viewer' when both are absent", () => {
      expect(labelFor({ name: null, email: null })).toBe("Viewer");
      expect(labelFor({ name: undefined, email: undefined })).toBe("Viewer");
    });
  });
});
