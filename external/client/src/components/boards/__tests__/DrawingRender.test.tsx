import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { parseDrawingContent, DrawingModal } from "../DrawingModal";
import {
  DRAWING_MAX_STROKES,
  DRAWING_SOFT_STROKE_WARN,
} from "@shared/schema";

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

afterEach(() => {
  cleanup();
  toastMock.mockClear();
});

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

// =====================================================
// Drawing budget meter & hard cap interaction tests
// =====================================================

function setupDrawingSurface() {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <DrawingModal open onCancel={onCancel} onSave={onSave} />,
  );
  const surface = utils.getByTestId("surface-drawing") as unknown as SVGSVGElement;
  // JSDOM doesn't implement these on SVG elements; stub so handlers don't throw.
  (surface as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
  (surface as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture = () => {};
  surface.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 480, bottom: 320, width: 480, height: 320, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return { surface, onSave, onCancel, ...utils };
}

function drawStrokes(surface: SVGSVGElement, count: number) {
  for (let i = 0; i < count; i++) {
    const x = (i % 100) + 1;
    const y = (i % 100) + 1;
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: x + 1, clientY: y + 1 });
  }
}

describe("DrawingModal budget meter", () => {
  it("switches to the warning style once the soft stroke threshold is crossed", () => {
    const { surface, getByTestId } = setupDrawingSurface();

    // Below the soft warning threshold: meter should be in the neutral style.
    drawStrokes(surface, DRAWING_SOFT_STROKE_WARN - 1);
    let meter = getByTestId("text-drawing-budget");
    expect(meter.className).toContain("text-neutral-500");
    expect(meter.className).not.toContain("text-amber-600");

    // Push past the soft warning threshold; meter should turn amber.
    drawStrokes(surface, 2);
    meter = getByTestId("text-drawing-budget");
    expect(meter.className).toContain("text-amber-600");
    expect(getByTestId("text-drawing-stroke-count").textContent).toContain(
      `${DRAWING_SOFT_STROKE_WARN + 1} / ${DRAWING_MAX_STROKES}`,
    );
  });
});

describe("DrawingModal hard stroke cap", () => {
  it("blocks new strokes and surfaces a destructive toast at the stroke limit", () => {
    const { surface, getByTestId } = setupDrawingSurface();

    drawStrokes(surface, DRAWING_MAX_STROKES);
    // Sanity: meter is now in the at-cap (red) style and exactly at the cap.
    const meter = getByTestId("text-drawing-budget");
    expect(meter.className).toContain("text-red-600");
    expect(getByTestId("text-drawing-stroke-count").textContent).toContain(
      `${DRAWING_MAX_STROKES} / ${DRAWING_MAX_STROKES}`,
    );
    // Drawing actions so far should not have triggered the limit toast.
    expect(toastMock).not.toHaveBeenCalled();

    // Attempt one more stroke beyond the cap; it must be blocked.
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 11, clientY: 11 });

    // Stroke count must not have grown beyond the cap.
    expect(getByTestId("text-drawing-stroke-count").textContent).toContain(
      `${DRAWING_MAX_STROKES} / ${DRAWING_MAX_STROKES}`,
    );
    // A destructive toast must have been raised exactly once.
    expect(toastMock).toHaveBeenCalledTimes(1);
    const toastArg = toastMock.mock.calls[0][0] as {
      title: string;
      description: string;
      variant: string;
    };
    expect(toastArg.variant).toBe("destructive");
    expect(toastArg.title).toMatch(/limit/i);
    expect(toastArg.description).toContain(String(DRAWING_MAX_STROKES));
  });
});
