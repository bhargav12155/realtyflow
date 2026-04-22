import { useEffect, useRef, useState } from "react";

export interface DrawingStroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

interface DrawingModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: (content: string) => void;
}

export const DRAWING_CANVAS_WIDTH = 480;
export const DRAWING_CANVAS_HEIGHT = 320;
const CANVAS_WIDTH = DRAWING_CANVAS_WIDTH;
const CANVAS_HEIGHT = DRAWING_CANVAS_HEIGHT;
const PALETTE = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#f59e0b"];

export interface DrawingPayload {
  v: 1;
  width: number;
  height: number;
  strokes: DrawingStroke[];
}

export function parseDrawingContent(raw: string | null | undefined): DrawingPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DrawingPayload>;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.strokes) &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number"
    ) {
      const strokes: DrawingStroke[] = [];
      for (const s of parsed.strokes) {
        if (
          !s ||
          typeof s !== "object" ||
          typeof (s as DrawingStroke).color !== "string" ||
          typeof (s as DrawingStroke).width !== "number" ||
          !Array.isArray((s as DrawingStroke).points)
        ) {
          continue;
        }
        const color = (s as DrawingStroke).color.slice(0, 32);
        const w = Math.max(1, Math.min(64, (s as DrawingStroke).width));
        const points = (s as DrawingStroke).points
          .filter(
            (p) =>
              p &&
              typeof p === "object" &&
              typeof (p as { x: number }).x === "number" &&
              typeof (p as { y: number }).y === "number" &&
              Number.isFinite((p as { x: number }).x) &&
              Number.isFinite((p as { y: number }).y),
          )
          .map((p) => ({ x: (p as { x: number }).x, y: (p as { y: number }).y }));
        if (points.length === 0) continue;
        strokes.push({ color, width: w, points });
      }
      return {
        v: 1,
        width: parsed.width,
        height: parsed.height,
        strokes,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function drawingStrokeToPath(s: DrawingStroke): string {
  return s.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

export function DrawingModal({ open, onCancel, onSave }: DrawingModalProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [active, setActive] = useState<DrawingStroke | null>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(3);

  useEffect(() => {
    if (!open) {
      setStrokes([]);
      setActive(null);
    }
  }, [open]);

  if (!open) return null;

  const pointFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive({ color, width, points: [pointFromEvent(e)] });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    setActive({ ...active, points: [...active.points, pointFromEvent(e)] });
  };

  const handlePointerUp = () => {
    if (!active) return;
    setStrokes((s) => [...s, active]);
    setActive(null);
  };

  const renderStroke = (s: DrawingStroke, key: string) => {
    if (s.points.length === 0) return null;
    const d = s.points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    return (
      <path
        key={key}
        d={d}
        fill="none"
        stroke={s.color}
        strokeWidth={s.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  const handleSave = () => {
    const all = active ? [...strokes, active] : strokes;
    if (all.length === 0) {
      onCancel();
      return;
    }
    const payload: DrawingPayload = {
      v: 1,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      strokes: all,
    };
    onSave(JSON.stringify(payload));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="modal-drawing"
      role="dialog"
      aria-label="Draw on the board"
    >
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-[520px] max-w-full p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
            Draw on the board
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
            data-testid="button-drawing-close"
          >
            Close
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Use color ${c}`}
              data-testid={`button-drawing-color-${c.replace("#", "")}`}
              className={`w-5 h-5 rounded-full border-2 ${
                color === c ? "border-neutral-900 dark:border-white" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="ml-2 flex items-center gap-1">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Size</span>
            <input
              type="range"
              min={1}
              max={12}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              data-testid="input-drawing-width"
              className="w-24"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setStrokes([]);
              setActive(null);
            }}
            className="ml-auto text-[11px] text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            data-testid="button-drawing-clear"
          >
            Clear
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="w-full bg-neutral-50 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 touch-none"
          style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
          data-testid="surface-drawing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {strokes.map((s, i) => renderStroke(s, `s-${i}`))}
          {active ? renderStroke(active, "active") : null}
        </svg>
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[12px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            data-testid="button-drawing-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={strokes.length === 0 && !active}
            className="px-3 py-1.5 rounded-md text-[12px] bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            data-testid="button-drawing-save"
          >
            Add to board
          </button>
        </div>
      </div>
    </div>
  );
}
