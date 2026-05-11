import { useEffect, useMemo, useRef, useState } from "react";
import {
  DRAWING_MAX_STROKES,
  DRAWING_MAX_POINTS_PER_STROKE,
  DRAWING_MAX_CONTENT_BYTES,
  DRAWING_SOFT_STROKE_WARN,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const limitToastedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setStrokes([]);
      setActive(null);
      limitToastedRef.current = false;
    }
  }, [open]);

  // Estimated payload size for the budget meter. We don't need exact byte
  // counts — just enough to warn before the user hits the server cap.
  const estimatedBytes = useMemo(() => {
    const all = active ? [...strokes, active] : strokes;
    let total = 32; // wrapper {v,width,height,strokes:[]}
    for (const s of all) {
      // ~"#rrggbb" + width digits + "[{x:..,y:..},...]"
      total += 24 + s.points.length * 28;
    }
    return total;
  }, [strokes, active]);

  if (!open) return null;

  const strokeCount = strokes.length + (active ? 1 : 0);
  const atStrokeCap = strokeCount >= DRAWING_MAX_STROKES;
  const overByteCap = estimatedBytes >= DRAWING_MAX_CONTENT_BYTES;
  const softWarn =
    strokeCount >= DRAWING_SOFT_STROKE_WARN ||
    estimatedBytes >= DRAWING_MAX_CONTENT_BYTES * 0.75;

  const showLimitToast = (description: string) => {
    if (limitToastedRef.current) return;
    limitToastedRef.current = true;
    toast({
      title: "Drawing is at its limit",
      description,
      variant: "destructive",
    });
    // Allow another toast once the user clears or saves and reopens.
    window.setTimeout(() => {
      limitToastedRef.current = false;
    }, 4000);
  };

  const pointFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (atStrokeCap) {
      showLimitToast(
        `You've reached the ${DRAWING_MAX_STROKES}-stroke limit. Save what you have or clear the drawing to keep going.`,
      );
      return;
    }
    if (overByteCap) {
      showLimitToast(
        "This drawing is too dense to keep adding to. Save it or clear it before drawing more.",
      );
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive({ color, width, points: [pointFromEvent(e)] });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    if (active.points.length >= DRAWING_MAX_POINTS_PER_STROKE) {
      // Auto-end the stroke at the per-stroke point cap so a single endless
      // drag can't single-handedly blow the payload budget.
      setStrokes((s) => [...s, active]);
      setActive(null);
      showLimitToast(
        `That stroke hit the ${DRAWING_MAX_POINTS_PER_STROKE}-point limit. Lift the pen and start a new stroke to continue.`,
      );
      return;
    }
    if (estimatedBytes >= DRAWING_MAX_CONTENT_BYTES) {
      // Same idea for the byte budget: stop growing the active stroke so a
      // long drag doesn't push the payload past what the server will accept.
      setStrokes((s) => [...s, active]);
      setActive(null);
      showLimitToast(
        "This drawing is at its size budget. Save it or clear it before drawing more.",
      );
      return;
    }
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
              limitToastedRef.current = false;
            }}
            className="ml-auto text-[11px] text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            data-testid="button-drawing-clear"
          >
            Clear
          </button>
        </div>
        <div
          className={`flex items-center justify-between text-[11px] mb-1 ${
            atStrokeCap || overByteCap
              ? "text-red-600 dark:text-red-400"
              : softWarn
              ? "text-amber-600 dark:text-amber-400"
              : "text-neutral-500 dark:text-neutral-400"
          }`}
          data-testid="text-drawing-budget"
          aria-live="polite"
        >
          <span data-testid="text-drawing-stroke-count">
            {strokeCount} / {DRAWING_MAX_STROKES} strokes
          </span>
          <span data-testid="text-drawing-size-budget">
            ~{Math.min(100, Math.round((estimatedBytes / DRAWING_MAX_CONTENT_BYTES) * 100))}% of size budget
          </span>
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
