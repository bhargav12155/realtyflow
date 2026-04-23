import { useEffect, useRef, useState } from "react";
import { Flag, Tag, Plus, Minus as MinusIcon, Crown, Sparkles, History } from "lucide-react";
import type { BoardAssetEvalHistoryEntry } from "@shared/schema";
import { parseDrawingContent, drawingStrokeToPath } from "./DrawingModal";

export interface SelectAssetOptions {
  /** True for shift/cmd/ctrl-click — toggle this id in the existing selection. */
  additive?: boolean;
}

export interface CanvasAsset {
  id: string;
  assetUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  status: string;
  rejectionReason?: string | null;
  kind: string;
  content?: string | null;
  evalHistory?: BoardAssetEvalHistoryEntry[] | null;
  sourceAssetId?: string | null;
  width?: number | null;
  height?: number | null;
  positionX?: number | null;
  positionY?: number | null;
}

export interface AssetMove {
  id: string;
  positionX: number;
  positionY: number;
}

const RESIZABLE_KINDS = new Set([
  "drawing",
  "audio",
  "image",
  "video",
  "sticky",
  "text",
  "frame",
]);
const RESIZE_DEFAULTS: Record<string, { width: number; height: number }> = {
  drawing: { width: 360, height: 240 },
  audio: { width: 320, height: 90 },
  image: { width: 150, height: 110 },
  video: { width: 150, height: 110 },
  sticky: { width: 150, height: 110 },
  text: { width: 150, height: 110 },
  frame: { width: 150, height: 110 },
};
const RESIZE_MIN_DEFAULT = { width: 160, height: 80 };
const RESIZE_MIN_BY_KIND: Record<string, { width: number; height: number }> = {
  image: { width: 80, height: 60 },
  video: { width: 80, height: 60 },
  sticky: { width: 80, height: 60 },
  text: { width: 80, height: 60 },
  frame: { width: 80, height: 60 },
};
const RESIZE_MAX = { width: 800, height: 600 };

export interface CanvasBatch {
  batchId: string;
  batchLabel: string | null;
  assets: CanvasAsset[];
}

export type ReEvalModel = "openai" | "gemini";

interface BoardCanvasProps {
  batches: CanvasBatch[];
  selectedAssetIds: Set<string>;
  onSelectAsset: (id: string | null, opts?: SelectAssetOptions) => void;
  /** Replace the selection with the given ids (used by marquee drag). */
  onSelectMany?: (ids: string[]) => void;
  /** Cmd/Ctrl+A → select every asset on the board. */
  onSelectAll?: () => void;
  onDeleteAsset: (id: string) => void;
  onClearRejection: (id: string) => void;
  onSetWinner?: (batchId: string, assetId: string) => void;
  onReEvaluate?: (
    batchId: string,
    payload: { modelHint: ReEvalModel; extraCriteria?: string },
  ) => void;
  onResizeAsset?: (assetId: string, width: number, height: number) => void;
  /** Persist new positions for one or more tiles after a drag completes. */
  onMoveAssets?: (moves: AssetMove[]) => void;
  reEvalPendingBatchId?: string | null;
  setWinnerPendingAssetId?: string | null;
  onUpdateAssetContent?: (assetId: string, content: string) => void;
}

interface MarqueeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MARQUEE_THRESHOLD_PX = 4;
const TILE_DRAG_THRESHOLD_PX = 4;
/** ms after a tile drag during which the trailing click is suppressed. */
const TILE_DRAG_CLICK_SUPPRESS_MS = 250;

export function BoardCanvas({
  batches,
  selectedAssetIds,
  onSelectAsset,
  onSelectMany,
  onSelectAll,
  onDeleteAsset,
  onClearRejection,
  onSetWinner,
  onReEvaluate,
  onResizeAsset,
  onMoveAssets,
  reEvalPendingBatchId,
  setWinnerPendingAssetId,
  onUpdateAssetContent,
}: BoardCanvasProps) {
  // Build a quick lookup so each tile can resolve its source-asset thumbnail
  // (used for the before/after preview on edited image tiles) without a prop
  // drill from the page level.
  const assetsById = new Map<string, CanvasAsset>();
  for (const b of batches) {
    for (const a of b.assets) assetsById.set(a.id, a);
  }

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);

  // Tile drag state: when the user mouse-downs on a tile and moves past the
  // threshold, every tile in the drag set follows the cursor. If the tile is
  // part of a multi-selection, the whole selection moves together; otherwise
  // just the pressed tile moves. On release, persist the new positions.
  const tileDragRef = useRef<{
    startX: number;
    startY: number;
    ids: string[];
    starts: Map<string, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);
  const [activeTileDrag, setActiveTileDrag] = useState<{
    ids: Set<string>;
    delta: { x: number; y: number };
  } | null>(null);
  const suppressTileClickUntilRef = useRef(0);

  const beginTileDrag = (assetId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Shift / cmd / ctrl-click is reserved for additive multi-select; don't
    // hijack it for a drag.
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;
    if (!onMoveAssets) return;
    const ids =
      selectedAssetIds.has(assetId) && selectedAssetIds.size > 1
        ? Array.from(selectedAssetIds)
        : [assetId];
    const starts = new Map<string, { x: number; y: number }>();
    for (const id of ids) {
      const a = assetsById.get(id);
      starts.set(id, {
        x: typeof a?.positionX === "number" ? a.positionX : 0,
        y: typeof a?.positionY === "number" ? a.positionY : 0,
      });
    }
    tileDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ids,
      starts,
      moved: false,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = tileDragRef.current;
      if (!s) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (!s.moved) {
        if (Math.abs(dx) < TILE_DRAG_THRESHOLD_PX && Math.abs(dy) < TILE_DRAG_THRESHOLD_PX) {
          return;
        }
        s.moved = true;
      }
      setActiveTileDrag({ ids: new Set(s.ids), delta: { x: dx, y: dy } });
    };
    const onUp = (e: MouseEvent) => {
      const s = tileDragRef.current;
      if (!s) return;
      tileDragRef.current = null;
      setActiveTileDrag(null);
      if (!s.moved) return;
      // Suppress the click that fires immediately after the drag's mouseup
      // so it doesn't toggle/clear the selection.
      suppressTileClickUntilRef.current = Date.now() + TILE_DRAG_CLICK_SUPPRESS_MS;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      const moves: AssetMove[] = s.ids.map((id) => {
        const start = s.starts.get(id) ?? { x: 0, y: 0 };
        return {
          id,
          positionX: Math.round(start.x + dx),
          positionY: Math.round(start.y + dy),
        };
      });
      onMoveAssets?.(moves);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onMoveAssets]);

  const consumeTileClickAfterDrag = () => {
    if (Date.now() < suppressTileClickUntilRef.current) {
      suppressTileClickUntilRef.current = 0;
      return true;
    }
    return false;
  };

  // Marquee selection: when the user mouse-downs on the canvas background
  // (not on a tile or popover), drag a rectangle. On release, replace the
  // current selection with every tile whose bounding box intersects.
  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: MouseEvent) => {
      const start = marqueeStartRef.current;
      if (!start) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > MARQUEE_THRESHOLD_PX || dy > MARQUEE_THRESHOLD_PX) {
        draggedRef.current = true;
      }
      setMarquee({
        x: Math.min(start.x, e.clientX),
        y: Math.min(start.y, e.clientY),
        w: Math.abs(e.clientX - start.x),
        h: Math.abs(e.clientY - start.y),
      });
    };
    const onUp = (e: MouseEvent) => {
      const start = marqueeStartRef.current;
      const wasDrag = draggedRef.current;
      marqueeStartRef.current = null;
      draggedRef.current = false;
      setMarquee(null);
      if (!start) return;
      if (!wasDrag) {
        // Treat as a background click — let the existing onClick handler
        // clear the selection. (Browsers fire click only when no drag.)
        return;
      }
      const box = {
        left: Math.min(start.x, e.clientX),
        right: Math.max(start.x, e.clientX),
        top: Math.min(start.y, e.clientY),
        bottom: Math.max(start.y, e.clientY),
      };
      const root = scrollerRef.current;
      if (!root) return;
      const tiles = root.querySelectorAll<HTMLElement>("[data-asset-id]");
      const hits: string[] = [];
      tiles.forEach((el) => {
        const id = el.getAttribute("data-asset-id");
        if (!id) return;
        const r = el.getBoundingClientRect();
        if (r.right >= box.left && r.left <= box.right && r.bottom >= box.top && r.top <= box.bottom) {
          hits.push(id);
        }
      });
      onSelectMany?.(hits);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [marquee, onSelectMany]);

  // Esc clears, Cmd/Ctrl+A selects every asset on the board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        if (selectedAssetIds.size > 0) {
          onSelectAsset(null);
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
        if (!onSelectAll) return;
        e.preventDefault();
        onSelectAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedAssetIds, onSelectAsset, onSelectAll]);

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Skip when the press lands on (or inside) something interactive — tiles,
    // buttons, links, form fields, contenteditable surfaces, or popups.
    // Anything else inside the scroller (batch wrappers, padding, gaps) is
    // treated as canvas background so the user can start a marquee from there.
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        '[data-asset-id], button, a, input, textarea, select, [role="dialog"], [contenteditable="true"]',
      )
    ) {
      return;
    }
    marqueeStartRef.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
    setMarquee({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };

  return (
    <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)] dark:bg-[radial-gradient(circle,_rgba(255,255,255,0.06)_1px,_transparent_1px)] [background-size:18px_18px] bg-neutral-100 dark:bg-neutral-950">
      <div
        ref={scrollerRef}
        className="absolute inset-0 overflow-auto px-8 py-6"
        onMouseDown={onCanvasMouseDown}
        onClick={() => onSelectAsset(null)}
        data-testid="canvas-scroller"
      >
        {batches.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[12px] text-neutral-400 dark:text-neutral-500" data-testid="text-empty-canvas">
            No assets yet — send a prompt in the chat to start a batch.
          </div>
        ) : (
          batches.map((b) => (
            <BatchGroup
              key={b.batchId}
              batch={b}
              assetsById={assetsById}
              selectedAssetIds={selectedAssetIds}
              onSelectAsset={onSelectAsset}
              onDeleteAsset={onDeleteAsset}
              onClearRejection={onClearRejection}
              onSetWinner={onSetWinner}
              onReEvaluate={onReEvaluate}
              onResizeAsset={onResizeAsset}
              reEvalPending={reEvalPendingBatchId === b.batchId}
              setWinnerPendingAssetId={setWinnerPendingAssetId}
              onUpdateAssetContent={onUpdateAssetContent}
              activeTileDrag={activeTileDrag}
              onTileDragStart={onMoveAssets ? beginTileDrag : undefined}
              consumeTileClickAfterDrag={consumeTileClickAfterDrag}
            />
          ))
        )}
      </div>
      {marquee && (marquee.w > 0 || marquee.h > 0) && (
        <div
          className="fixed pointer-events-none border border-blue-500 bg-blue-500/10 z-30"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
          }}
          data-testid="marquee-rect"
        />
      )}
      <ZoomControls />
    </main>
  );
}

function BatchGroup({
  batch,
  assetsById,
  selectedAssetIds,
  onSelectAsset,
  onDeleteAsset,
  onClearRejection,
  onSetWinner,
  onReEvaluate,
  onResizeAsset,
  reEvalPending,
  setWinnerPendingAssetId,
  onUpdateAssetContent,
  activeTileDrag,
  onTileDragStart,
  consumeTileClickAfterDrag,
}: {
  batch: CanvasBatch;
  assetsById: Map<string, CanvasAsset>;
  selectedAssetIds: Set<string>;
  onSelectAsset: (id: string | null, opts?: SelectAssetOptions) => void;
  onDeleteAsset: (id: string) => void;
  onClearRejection: (id: string) => void;
  onSetWinner?: (batchId: string, assetId: string) => void;
  onReEvaluate?: (
    batchId: string,
    payload: { modelHint: ReEvalModel; extraCriteria?: string },
  ) => void;
  onResizeAsset?: (assetId: string, width: number, height: number) => void;
  reEvalPending?: boolean;
  setWinnerPendingAssetId?: string | null;
  onUpdateAssetContent?: (assetId: string, content: string) => void;
  activeTileDrag: { ids: Set<string>; delta: { x: number; y: number } } | null;
  onTileDragStart?: (assetId: string, e: React.MouseEvent) => void;
  consumeTileClickAfterDrag: () => boolean;
}) {
  const [reEvalOpen, setReEvalOpen] = useState(false);
  const winnerId = pickWinnerId(batch.assets);
  const canReEval = batch.assets.some(
    (a) => !!a.assetUrl && (a.status === "ready" || a.status === "rejected"),
  );
  return (
    <div className="mb-5" data-testid={`batch-${batch.batchId}`}>
      <div className="flex items-center justify-between mb-1.5 ml-1">
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{batch.batchLabel || "Batch"}</div>
        {onReEvaluate && canReEval && (
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setReEvalOpen((o) => !o)}
              disabled={reEvalPending}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800/60 disabled:opacity-50"
              data-testid={`button-re-evaluate-${batch.batchId}`}
            >
              <Sparkles className="w-3 h-3" />
              {reEvalPending ? "Re-evaluating…" : "Re-evaluate this batch"}
            </button>
            {reEvalOpen && (
              <ReEvalPopover
                batchId={batch.batchId}
                onCancel={() => setReEvalOpen(false)}
                onSubmit={(payload) => {
                  setReEvalOpen(false);
                  onReEvaluate(batch.batchId, payload);
                }}
              />
            )}
          </div>
        )}
      </div>
      <div className="bg-white/70 backdrop-blur-sm border border-neutral-200/80 rounded-lg p-2.5 dark:bg-neutral-900/70 dark:border-neutral-800">
        <div className="flex flex-wrap gap-2">
          {batch.assets.map((a) => {
            const source = a.sourceAssetId ? assetsById.get(a.sourceAssetId) ?? null : null;
            const isDragging = activeTileDrag?.ids.has(a.id) ?? false;
            const baseX = typeof a.positionX === "number" ? a.positionX : 0;
            const baseY = typeof a.positionY === "number" ? a.positionY : 0;
            const offsetX = baseX + (isDragging ? activeTileDrag!.delta.x : 0);
            const offsetY = baseY + (isDragging ? activeTileDrag!.delta.y : 0);
            return (
              <AssetTile
                key={a.id}
                asset={a}
                sourceAsset={source}
                selected={selectedAssetIds.has(a.id)}
                isWinner={a.id === winnerId}
                onSelect={(opts) => onSelectAsset(a.id, opts)}
                onSelectSource={source ? () => onSelectAsset(source.id) : undefined}
                onDelete={() => onDeleteAsset(a.id)}
                onClearRejection={() => onClearRejection(a.id)}
                onSetWinner={
                  onSetWinner ? () => onSetWinner(batch.batchId, a.id) : undefined
                }
                onResize={
                  onResizeAsset
                    ? (w, h) => onResizeAsset(a.id, w, h)
                    : undefined
                }
                setWinnerPending={setWinnerPendingAssetId === a.id}
                onUpdateContent={
                  onUpdateAssetContent
                    ? (next) => onUpdateAssetContent(a.id, next)
                    : undefined
                }
                offsetX={offsetX}
                offsetY={offsetY}
                isDragging={isDragging}
                onDragStart={
                  onTileDragStart ? (e) => onTileDragStart(a.id, e) : undefined
                }
                consumeClickAfterDrag={consumeTileClickAfterDrag}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReEvalPopover({
  batchId,
  onSubmit,
  onCancel,
}: {
  batchId: string;
  onSubmit: (payload: { modelHint: ReEvalModel; extraCriteria?: string }) => void;
  onCancel: () => void;
}) {
  const [model, setModel] = useState<ReEvalModel>("openai");
  const [criteria, setCriteria] = useState("");
  return (
    <div
      className="absolute right-0 top-6 z-30 w-[280px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-3 space-y-2"
      data-testid={`popover-re-evaluate-${batchId}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
        Re-evaluate batch
      </div>
      <label className="block">
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Model</span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ReEvalModel)}
          className="mt-0.5 w-full text-[12px] px-2 py-1 rounded border border-neutral-300 bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100"
          data-testid={`select-re-evaluate-model-${batchId}`}
        >
          <option value="openai">OpenAI (GPT-4o)</option>
          <option value="gemini">Gemini</option>
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Extra criteria (optional)</span>
        <textarea
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder="e.g. Prefer warm lighting, avoid text overlays"
          className="mt-0.5 w-full text-[12px] px-2 py-1 rounded border border-neutral-300 bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 resize-none"
          data-testid={`textarea-re-evaluate-criteria-${batchId}`}
        />
      </label>
      <div className="flex justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 rounded text-[11px] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          data-testid={`button-re-evaluate-cancel-${batchId}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            onSubmit({
              modelHint: model,
              extraCriteria: criteria.trim() || undefined,
            })
          }
          className="px-2.5 py-1 rounded text-[11px] font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          data-testid={`button-re-evaluate-submit-${batchId}`}
        >
          Re-evaluate
        </button>
      </div>
    </div>
  );
}

function AssetTile({
  asset,
  sourceAsset,
  selected,
  isWinner,
  onSelect,
  onSelectSource,
  onDelete,
  onClearRejection,
  onSetWinner,
  onResize,
  setWinnerPending,
  onUpdateContent,
  offsetX,
  offsetY,
  isDragging,
  onDragStart,
  consumeClickAfterDrag,
}: {
  asset: CanvasAsset;
  sourceAsset?: CanvasAsset | null;
  selected: boolean;
  isWinner: boolean;
  onSelect: (opts?: SelectAssetOptions) => void;
  onSelectSource?: () => void;
  onDelete: () => void;
  onClearRejection: () => void;
  onSetWinner?: () => void;
  onResize?: (width: number, height: number) => void;
  setWinnerPending?: boolean;
  onUpdateContent?: (content: string) => void;
  offsetX: number;
  offsetY: number;
  isDragging: boolean;
  onDragStart?: (e: React.MouseEvent) => void;
  consumeClickAfterDrag: () => boolean;
}) {
  const flagged = asset.status === "rejected";
  const generating = asset.status === "queued" || asset.status === "generating";
  const src = asset.thumbnailUrl || asset.assetUrl;
  const isSticky = asset.kind === "sticky";
  const isText = asset.kind === "text";
  const isFrame = asset.kind === "frame";
  const isDrawing = asset.kind === "drawing";
  const isAudio = asset.kind === "audio";
  const sourceSrc = sourceAsset ? sourceAsset.thumbnailUrl || sourceAsset.assetUrl : null;
  const history = Array.isArray(asset.evalHistory) ? asset.evalHistory : [];
  const [historyOpen, setHistoryOpen] = useState(false);
  const [beforeOpen, setBeforeOpen] = useState(false);
  const canPromote =
    !!onSetWinner &&
    !isWinner &&
    !!asset.assetUrl &&
    (asset.status === "ready" || asset.status === "rejected");
  const isEditableKind = isSticky || isText || isFrame;
  const canEdit = isEditableKind && !!onUpdateContent;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(asset.content ?? "");
  const editRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  // When the canonical content changes from outside (e.g. WS push from
  // another collaborator), keep our draft in sync as long as we're not
  // mid-edit ourselves.
  useEffect(() => {
    if (!editing) setDraft(asset.content ?? "");
  }, [asset.content, editing]);
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);
  const startEdit = () => {
    if (!canEdit) return;
    setDraft(asset.content ?? "");
    setEditing(true);
  };
  const commitEdit = () => {
    if (!editing) return;
    setEditing(false);
    const next = isFrame ? draft.replace(/\n+/g, " ").trim() : draft;
    if (next !== (asset.content ?? "")) {
      onUpdateContent?.(next);
    }
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft(asset.content ?? "");
  };

  const isResizable = RESIZABLE_KINDS.has(asset.kind) && !!onResize;
  const fallbackSize = RESIZE_DEFAULTS[asset.kind] ?? { width: 150, height: 110 };
  const storedWidth =
    typeof asset.width === "number" && asset.width > 0
      ? asset.width
      : fallbackSize.width;
  const storedHeight =
    typeof asset.height === "number" && asset.height > 0
      ? asset.height
      : fallbackSize.height;
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: storedWidth,
    height: storedHeight,
  });
  const tileRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  // Re-sync when the persisted size changes (e.g. after the PATCH succeeds
  // and the cached board is refreshed, or another collaborator resizes).
  useEffect(() => {
    if (!isResizable) return;
    if (resizeRef.current) return;
    setSize({ width: storedWidth, height: storedHeight });
  }, [isResizable, storedWidth, storedHeight]);

  const tileWidth = isResizable ? size.width : 150;
  const tileHeight = isResizable ? size.height : 110;

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isResizable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  };
  const minSize = RESIZE_MIN_BY_KIND[asset.kind] ?? RESIZE_MIN_DEFAULT;
  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    const dw = e.clientX - r.startX;
    const dh = e.clientY - r.startY;
    const w = Math.max(minSize.width, Math.min(RESIZE_MAX.width, r.startW + dw));
    const h = Math.max(minSize.height, Math.min(RESIZE_MAX.height, r.startH + dh));
    setSize({ width: Math.round(w), height: Math.round(h) });
  };
  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    resizeRef.current = null;
    if (size.width !== r.startW || size.height !== r.startH) {
      onResize?.(size.width, size.height);
    }
  };

  return (
    <div
      ref={tileRef}
      style={{
        width: tileWidth,
        height: tileHeight,
        transform:
          offsetX || offsetY ? `translate(${offsetX}px, ${offsetY}px)` : undefined,
        zIndex: isDragging ? 20 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
      className={`relative group flex-shrink-0 ${
        isWinner ? "ring-2 ring-amber-400 rounded-md" : ""
      }`}
      onMouseLeave={() => {
        setHistoryOpen(false);
        setBeforeOpen(false);
      }}
      data-asset-id={asset.id}
      data-tile-offset-x={offsetX || undefined}
      data-tile-offset-y={offsetY || undefined}
    >
      <div
        className={`relative w-full h-full rounded-md overflow-hidden ${
          isSticky
            ? "bg-yellow-200 dark:bg-yellow-300"
            : isFrame
              ? "bg-transparent border-2 border-dashed border-neutral-400 dark:border-neutral-500"
              : isText
                ? "bg-transparent"
                : "bg-neutral-200 dark:bg-neutral-800"
        } cursor-pointer ${selected ? "ring-2 ring-blue-500" : ""}`}
        onMouseDown={(e) => {
          // Prevent the canvas-level mousedown from starting a marquee when
          // the user clicks (or shift-clicks) directly on a tile.
          e.stopPropagation();
          if (!onDragStart) return;
          // Don't start a tile drag from interactive controls inside the
          // tile (delete button, resize handle, the inline editor, etc.).
          const target = e.target as HTMLElement | null;
          if (
            target &&
            target.closest(
              'button, a, input, textarea, select, [contenteditable="true"], [data-resize-handle="true"]',
            )
          ) {
            return;
          }
          if (editing) return;
          onDragStart(e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          // If the click was the tail end of a drag, swallow it so we don't
          // toggle / clear the selection on drop.
          if (consumeClickAfterDrag()) return;
          const additive = e.shiftKey || e.metaKey || e.ctrlKey;
          onSelect({ additive });
        }}
        onDoubleClick={(e) => {
          if (!canEdit) return;
          e.stopPropagation();
          startEdit();
        }}
        data-testid={`asset-${asset.id}`}
      >
        {isSticky ? (
          editing ? (
            <textarea
              ref={(el) => (editRef.current = el)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full p-2 text-[11px] leading-snug text-neutral-900 bg-transparent resize-none outline-none focus:ring-2 focus:ring-blue-500 rounded"
              data-testid={`input-edit-sticky-${asset.id}`}
            />
          ) : (
            <div
              className="w-full h-full p-2 text-[11px] leading-snug text-neutral-900 whitespace-pre-wrap break-words overflow-hidden"
              data-testid={`sticky-content-${asset.id}`}
            >
              {asset.content || "Sticky note"}
            </div>
          )
        ) : isText ? (
          editing ? (
            <textarea
              ref={(el) => (editRef.current = el)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full p-1.5 text-[12px] leading-snug text-neutral-900 dark:text-neutral-100 bg-transparent resize-none outline-none focus:ring-2 focus:ring-blue-500 rounded"
              data-testid={`input-edit-text-${asset.id}`}
            />
          ) : (
            <div
              className="w-full h-full p-1.5 text-[12px] leading-snug text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-words overflow-hidden"
              data-testid={`text-content-${asset.id}`}
            >
              {asset.content || "Text"}
            </div>
          )
        ) : isFrame ? (
          editing ? (
            <input
              ref={(el) => (editRef.current = el)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full p-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-700 dark:text-neutral-200 bg-transparent outline-none focus:ring-2 focus:ring-blue-500 rounded"
              data-testid={`input-edit-frame-${asset.id}`}
            />
          ) : (
            <div
              className="w-full h-full p-1.5 flex items-start justify-start text-[11px] font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
              data-testid={`frame-content-${asset.id}`}
            >
              {asset.content || "Frame"}
            </div>
          )
        ) : isDrawing ? (
          (() => {
            const drawing = parseDrawingContent(asset.content);
            if (!drawing || drawing.strokes.length === 0) {
              return (
                <div
                  className="w-full h-full flex items-center justify-center bg-white dark:bg-neutral-100 text-[10px] text-neutral-500"
                  data-testid={`drawing-content-${asset.id}`}
                >
                  empty drawing
                </div>
              );
            }
            return (
              <svg
                viewBox={`0 0 ${drawing.width} ${drawing.height}`}
                className="w-full h-full bg-white dark:bg-neutral-100"
                preserveAspectRatio="xMidYMid meet"
                data-testid={`drawing-content-${asset.id}`}
              >
                {drawing.strokes.map((s, i) => (
                  <path
                    key={i}
                    d={drawingStrokeToPath(s)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            );
          })()
        ) : isAudio && asset.assetUrl ? (
          <div
            className="w-full h-full p-2 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900"
            data-testid={`audio-content-${asset.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <audio src={asset.assetUrl} controls className="w-full" />
          </div>
        ) : src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500 dark:text-neutral-400">
            {generating ? "generating…" : "no preview"}
          </div>
        )}
        {generating && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-300/60 dark:bg-neutral-700/60 overflow-hidden"
            data-testid={`progress-${asset.id}`}
          >
            <div className="h-full w-1/3 bg-blue-500 rounded-r-full animate-progress-slide" />
          </div>
        )}
        {asset.durationSeconds != null && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white">
            <span className="font-medium">{Math.round(asset.durationSeconds)}s</span>
          </div>
        )}
        {isWinner && (
          <div
            className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 border border-white shadow flex items-center justify-center"
            data-testid={`badge-winner-${asset.id}`}
            title="Auto-pick winner"
          >
            <Crown className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </div>
        )}
        {flagged && (
          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 border border-white shadow flex items-center justify-center" data-testid={`badge-flag-${asset.id}`}>
            <Flag className="w-2.5 h-2.5 text-white" strokeWidth={3} fill="white" />
          </div>
        )}
      </div>
      {history.length > 0 && (
        <button
          type="button"
          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-20"
          title={`${history.length} eval ${history.length === 1 ? "entry" : "entries"}`}
          aria-label="Show eval history"
          data-testid={`button-history-${asset.id}`}
          onMouseEnter={() => setHistoryOpen(true)}
          onFocus={() => setHistoryOpen(true)}
          onClick={(e) => {
            e.stopPropagation();
            setHistoryOpen((v) => !v);
          }}
        >
          <History className="w-3 h-3" />
        </button>
      )}
      {historyOpen && history.length > 0 && (
        <EvalHistoryPopup assetId={asset.id} entries={history} />
      )}
      {canPromote && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetWinner?.();
          }}
          disabled={setWinnerPending}
          className="absolute top-1 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium hover:bg-black/85 disabled:opacity-50 z-20"
          data-testid={`button-set-winner-${asset.id}`}
        >
          <Crown className="w-2.5 h-2.5" />
          {setWinnerPending ? "Setting…" : "Pick a different winner"}
        </button>
      )}
      {sourceAsset && sourceSrc && (
        <button
          type="button"
          className="absolute top-1.5 right-1.5 w-9 h-9 rounded-md overflow-hidden bg-neutral-900/70 ring-1 ring-white/70 shadow opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-20"
          title="Hover to see the source image"
          aria-label="Show source image"
          data-testid={`button-before-${asset.id}`}
          onMouseEnter={() => setBeforeOpen(true)}
          onMouseLeave={() => setBeforeOpen(false)}
          onFocus={() => setBeforeOpen(true)}
          onBlur={() => setBeforeOpen(false)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSource?.();
          }}
        >
          <img src={sourceSrc} alt="" className="w-full h-full object-cover" />
        </button>
      )}
      {beforeOpen && sourceAsset && sourceSrc && (
        <div
          className="absolute inset-0 rounded-md overflow-hidden ring-2 ring-blue-500 z-10 pointer-events-none"
          data-testid={`overlay-before-${asset.id}`}
        >
          <img src={sourceSrc} alt="" className="w-full h-full object-cover" />
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] uppercase tracking-wide">
            Before
          </div>
        </div>
      )}
      {sourceAsset && (
        <button
          type="button"
          className="absolute -bottom-4 left-0 right-0 mx-auto w-fit max-w-full px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] truncate hover:bg-black/90 z-20"
          title="Jump to source asset"
          data-testid={`link-source-${asset.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSource?.();
          }}
        >
          Edited from source
        </button>
      )}
      {selected && flagged && asset.rejectionReason && (
        <RejectionPopup
          reason={asset.rejectionReason}
          history={history}
          onDelete={onDelete}
          onClear={onClearRejection}
        />
      )}
      {isResizable && selected && (
        <div
          role="slider"
          aria-label="Resize"
          aria-valuenow={size.width}
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-sm bg-blue-500 border-2 border-white shadow cursor-se-resize z-30"
          data-testid={`handle-resize-${asset.id}`}
          data-resize-handle="true"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

function pickWinnerId(assets: CanvasAsset[]): string | null {
  const eligible = assets.filter((a) => a.status === "ready" && !!a.assetUrl);
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0].id;
  let bestId: string | null = null;
  let bestAt = "";
  for (const a of eligible) {
    const history = Array.isArray(a.evalHistory) ? a.evalHistory : [];
    for (const h of history) {
      if (h.outcome !== "winner" && h.outcome !== "promoted") continue;
      if (!bestId || h.at > bestAt) {
        bestId = a.id;
        bestAt = h.at;
      }
    }
  }
  return bestId ?? eligible[0].id;
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function EvalHistoryPopup({ assetId, entries }: { assetId: string; entries: BoardAssetEvalHistoryEntry[] }) {
  const sorted = [...entries].sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
  });
  const outcomeColor: Record<string, string> = {
    winner: "bg-emerald-500/90",
    promoted: "bg-blue-500/90",
    rejected: "bg-rose-500/90",
    demoted: "bg-amber-500/90",
  };
  return (
    <div
      className="absolute top-full mt-1 left-0 w-[260px] max-h-[260px] overflow-y-auto bg-white text-neutral-900 rounded-lg shadow-xl border border-neutral-200 p-2.5 z-30 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
      data-testid={`popup-history-${assetId}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
        EVAL HISTORY
      </div>
      <ol className="space-y-1.5">
        {sorted.map((e, idx) => {
          const ts = new Date(e.at);
          const tsLabel = Number.isFinite(ts.getTime()) ? ts.toLocaleString() : e.at;
          const color = outcomeColor[e.outcome] ?? "bg-neutral-500/90";
          return (
            <li key={`${e.at}-${idx}`} className="text-[11px] leading-snug" data-testid={`history-entry-${assetId}-${idx}`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide text-white ${color}`}>
                  {e.outcome}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {e.source}
                </span>
                {e.modelUsed && (
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">· {e.modelUsed}</span>
                )}
              </div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{tsLabel}</div>
              {e.reason && (
                <div className="text-[11px] text-neutral-700 dark:text-neutral-200 mt-0.5">{e.reason}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RejectionPopup({
  reason,
  history,
  onDelete,
  onClear,
}: {
  reason: string;
  history: BoardAssetEvalHistoryEntry[];
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="absolute -top-2 -right-3 w-[260px] bg-rose-500 text-white rounded-xl shadow-lg p-3 z-30"
      data-testid="popup-rejection"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-1">
        <Tag className="w-4 h-4 fill-white" />
        <span className="text-[13px] font-bold tracking-wide">REJECTED</span>
      </div>
      <div className="text-[12px] leading-snug mb-2">{reason}</div>
      {history.length > 0 && (
        <div className="mb-2 max-h-[90px] overflow-y-auto bg-rose-600/40 rounded p-1.5 text-[10px] leading-tight space-y-0.5">
          <div className="flex items-center gap-1 font-semibold">
            <History className="w-2.5 h-2.5" />
            <span>Audit trail</span>
          </div>
          {history.map((h, i) => (
            <div key={i}>
              <span className="opacity-80">{shortDate(h.at)} · </span>
              <span className="font-medium">{h.outcome}</span>
              {h.modelUsed ? <span className="opacity-80"> ({h.modelUsed})</span> : null}
              {h.reason ? <span>: {h.reason}</span> : null}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1 rounded-md bg-rose-600/50 text-white text-[12px] font-semibold hover:bg-rose-600/70"
          data-testid="button-delete-rejected"
          onClick={onDelete}
        >
          Delete
        </button>
        <button
          className="px-3 py-1 rounded-md bg-rose-600/30 text-white text-[12px] font-semibold hover:bg-rose-600/50"
          data-testid="button-clear-rejection"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ZoomControls() {
  const [zoom, setZoom] = useState(100);
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-full shadow-sm border border-neutral-200 px-2 py-1 flex items-center gap-1 text-[11px] text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-300">
      <button
        className="w-5 h-5 rounded hover:bg-neutral-100 flex items-center justify-center dark:hover:bg-neutral-800"
        onClick={() => setZoom((z) => Math.max(25, z - 10))}
        data-testid="button-zoom-out"
      >
        <MinusIcon className="w-3 h-3" />
      </button>
      <span className="font-medium tabular-nums w-10 text-center" data-testid="text-zoom">
        {zoom}%
      </span>
      <button
        className="w-5 h-5 rounded hover:bg-neutral-100 flex items-center justify-center dark:hover:bg-neutral-800"
        onClick={() => setZoom((z) => Math.min(200, z + 10))}
        data-testid="button-zoom-in"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}
