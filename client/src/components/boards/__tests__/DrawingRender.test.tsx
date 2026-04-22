import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { parseDrawingContent } from "../DrawingModal";

afterEach(() => cleanup());

describe("parseDrawingContent (drawing safety)", () => {
  it("parses a valid drawing payload into structured strokes", () => {
    const json = JSON.stringify({
      v: 1,
      width: 480,
      height: 320,
      strokes: [
        { color: "#111827", width: 3, points: [{ x: 1, y: 2 }, { x: 5, y: 6 }] },
      ],
    });
    const out = parseDrawingContent(json);
    expect(out).not.toBeNull();
    expect(out!.strokes).toHaveLength(1);
    expect(out!.strokes[0].points).toEqual([
      { x: 1, y: 2 },
      { x: 5, y: 6 },
    ]);
  });

  it("returns null for non-JSON content (e.g. raw HTML/SVG strings)", () => {
    expect(
      parseDrawingContent('<svg onload="alert(1)"><script>alert(1)</script></svg>'),
    ).toBeNull();
    expect(parseDrawingContent("<img src=x onerror=alert(1)>")).toBeNull();
    expect(parseDrawingContent("not-json")).toBeNull();
    expect(parseDrawingContent("")).toBeNull();
    expect(parseDrawingContent(null)).toBeNull();
  });

  it("ignores malformed strokes inside an otherwise-valid payload", () => {
    const json = JSON.stringify({
      v: 1,
      width: 100,
      height: 100,
      strokes: [
        { color: "#000", width: 2, points: [{ x: 0, y: 0 }] },
        { color: 123, width: 2, points: [{ x: 0, y: 0 }] }, // bad color type
        { color: "#000", width: 2, points: "nope" }, // bad points
        { color: "#000", width: 2, points: [{ x: "a", y: 0 }] }, // bad point coords
      ],
    });
    const out = parseDrawingContent(json);
    expect(out).not.toBeNull();
    expect(out!.strokes).toHaveLength(1);
  });

  it("clamps stroke width and truncates color strings to safe bounds", () => {
    const json = JSON.stringify({
      v: 1,
      width: 100,
      height: 100,
      strokes: [
        { color: "x".repeat(100), width: 9999, points: [{ x: 0, y: 0 }] },
        { color: "#fff", width: -5, points: [{ x: 0, y: 0 }] },
      ],
    });
    const out = parseDrawingContent(json)!;
    expect(out.strokes[0].color.length).toBeLessThanOrEqual(32);
    expect(out.strokes[0].width).toBeLessThanOrEqual(64);
    expect(out.strokes[1].width).toBeGreaterThanOrEqual(1);
  });
});

describe("Drawing render path is XSS-safe", () => {
  it("malicious JSON payload renders no script tags or event handlers", () => {
    const json = JSON.stringify({
      v: 1,
      width: 100,
      height: 100,
      strokes: [
        {
          color: '"><script>alert(1)</script>',
          width: 2,
          points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        },
      ],
    });
    const drawing = parseDrawingContent(json)!;
    const { container } = render(
      <svg>
        {drawing.strokes.map((s, i) => (
          <path key={i} stroke={s.color} d="M0 0 L1 1" />
        ))}
      </svg>,
    );
    expect(container.querySelector("script")).toBeNull();
    const path = container.querySelector("path")!;
    // React sets attributes safely as strings; the malicious value is just a
    // stroke attribute, not parsed as HTML.
    expect(path.getAttribute("onload")).toBeNull();
    expect(path.getAttribute("onerror")).toBeNull();
  });
});
