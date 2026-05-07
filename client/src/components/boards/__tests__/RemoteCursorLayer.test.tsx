import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RemoteCursorLayer } from "../BoardCanvas";
import {
  colorFor,
  colorHexFor,
  initialsFor,
  labelFor,
} from "@/lib/presence-colors";

afterEach(() => cleanup());

type CursorEntry = {
  x: number;
  y: number;
  name: string | null;
  email: string | null;
};

function makeCursors(
  entries: Array<[string, CursorEntry]>,
): Map<string, CursorEntry> {
  return new Map(entries);
}

describe("RemoteCursorLayer", () => {
  it("labels each cursor with the viewer's initials, not their full name", () => {
    const cursors = makeCursors([
      [
        "u-alice",
        { x: 10, y: 20, name: "Alice Anders", email: "alice@example.com" },
      ],
      [
        "u-bob",
        { x: 30, y: 40, name: "Bob Brown", email: "bob@example.com" },
      ],
    ]);
    render(<RemoteCursorLayer cursors={cursors} />);

    const aliceLabel = screen.getByTestId("remote-cursor-label-u-alice");
    const bobLabel = screen.getByTestId("remote-cursor-label-u-bob");

    expect(aliceLabel.textContent).toBe(
      initialsFor("Alice Anders", "alice@example.com"),
    );
    expect(aliceLabel.textContent).toBe("AA");
    expect(aliceLabel.textContent).not.toBe("Alice Anders");

    expect(bobLabel.textContent).toBe(
      initialsFor("Bob Brown", "bob@example.com"),
    );
    expect(bobLabel.textContent).toBe("BB");
    expect(bobLabel.textContent).not.toBe("Bob Brown");
  });

  it("uses the userId-based palette class for each label background", () => {
    const cursors = makeCursors([
      [
        "u-alice",
        { x: 10, y: 20, name: "Alice Anders", email: "alice@example.com" },
      ],
      [
        "u-bob",
        { x: 30, y: 40, name: "Bob Brown", email: "bob@example.com" },
      ],
    ]);
    render(<RemoteCursorLayer cursors={cursors} />);

    const aliceLabel = screen.getByTestId("remote-cursor-label-u-alice");
    const bobLabel = screen.getByTestId("remote-cursor-label-u-bob");

    const aliceBg = colorFor("u-alice");
    const bobBg = colorFor("u-bob");

    expect(aliceLabel.className).toContain(aliceBg);
    expect(bobLabel.className).toContain(bobBg);
  });

  it("exposes the full display label as the cursor label's title attribute", () => {
    const cursors = makeCursors([
      [
        "u-alice",
        { x: 10, y: 20, name: "Alice Anders", email: "alice@example.com" },
      ],
      [
        "u-charlie",
        { x: 50, y: 60, name: null, email: "charlie@example.com" },
      ],
    ]);
    render(<RemoteCursorLayer cursors={cursors} />);

    const aliceLabel = screen.getByTestId("remote-cursor-label-u-alice");
    const charlieLabel = screen.getByTestId("remote-cursor-label-u-charlie");

    expect(aliceLabel.getAttribute("title")).toBe(
      labelFor({ name: "Alice Anders", email: "alice@example.com" }),
    );
    expect(aliceLabel.getAttribute("title")).toContain("Alice Anders");

    // Falls back to email when no display name is provided.
    expect(charlieLabel.getAttribute("title")).toBe("charlie@example.com");
  });

  it("paints the SVG pointer with the same userId-based hex color", () => {
    const cursors = makeCursors([
      [
        "u-alice",
        { x: 10, y: 20, name: "Alice Anders", email: "alice@example.com" },
      ],
    ]);
    render(<RemoteCursorLayer cursors={cursors} />);

    const wrapper = screen.getByTestId("remote-cursor-u-alice");
    const path = wrapper.querySelector("svg path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("fill")).toBe(colorHexFor("u-alice"));
  });

  it("gives two different userIds visually distinct palette classes", () => {
    // u-alice and u-bob hash to different palette entries — assert that the
    // contract holds end-to-end: the rendered label classes differ and the
    // SVG fills differ, so two collaborators are never rendered identically.
    const cursors = makeCursors([
      [
        "u-alice",
        { x: 10, y: 20, name: "Alice Anders", email: "alice@example.com" },
      ],
      [
        "u-bob",
        { x: 30, y: 40, name: "Bob Brown", email: "bob@example.com" },
      ],
    ]);
    render(<RemoteCursorLayer cursors={cursors} />);

    const aliceBg = colorFor("u-alice");
    const bobBg = colorFor("u-bob");
    // Sanity-check the palette itself first so a future palette refactor
    // that collapses these two ids into the same color fails loudly here.
    expect(aliceBg).not.toBe(bobBg);

    const aliceLabel = screen.getByTestId("remote-cursor-label-u-alice");
    const bobLabel = screen.getByTestId("remote-cursor-label-u-bob");
    expect(aliceLabel.className).toContain(aliceBg);
    expect(bobLabel.className).toContain(bobBg);
    expect(aliceLabel.className).not.toContain(bobBg);
    expect(bobLabel.className).not.toContain(aliceBg);

    const aliceFill = screen
      .getByTestId("remote-cursor-u-alice")
      .querySelector("svg path")
      ?.getAttribute("fill");
    const bobFill = screen
      .getByTestId("remote-cursor-u-bob")
      .querySelector("svg path")
      ?.getAttribute("fill");
    expect(aliceFill).toBe(colorHexFor("u-alice"));
    expect(bobFill).toBe(colorHexFor("u-bob"));
    expect(aliceFill).not.toBe(bobFill);
  });

  it("renders nothing visible when the cursors map is empty", () => {
    const { container } = render(
      <RemoteCursorLayer cursors={makeCursors([])} />,
    );
    expect(container.querySelector("[data-testid^='remote-cursor-']")).toBeNull();
  });
});
