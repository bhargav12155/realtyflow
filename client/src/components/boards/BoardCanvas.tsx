import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Flag, Tag, Plus, Minus as MinusIcon, Crown, Sparkles, History, Loader2, AlertTriangle } from "lucide-react";
import type { BoardAssetEvalHistoryEntry } from "@shared/schema";
import { parseDrawingContent, drawingStrokeToPath } from "./DrawingModal";
import {
  colorFor,
  colorHexFor,
  initialsFor,
  labelFor,
} from "@/lib/presence-colors";

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
  provider?: string | null;
  modelLabel?: string | null;
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
  image: { width: 256, height: 256 },
  video: { width: 256, height: 256 },
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
const COMPACT_NO_PREVIEW_SIZE = { width: 180, height: 126 };

function previewStatusFor(asset: CanvasAsset, videoLoadFailed: boolean): { title: string; detail: string; tone: "error" | "muted" } {
  if (asset.status === "failed" || asset.status === "rejected") {
    return {
      title: asset.status === "rejected" ? "Rejected" : "Generation failed",
      detail: asset.rejectionReason || "The provider did not return a usable preview for this item.",
      tone: "error",
    };
  }

  if (videoLoadFailed) {
    return {
      title: "Video preview unavailable",
      detail: asset.rejectionReason || "The file was generated, but this browser view could not play it.",
      tone: "muted",
    };
  }

  return {
    title: "No preview yet",
    detail: asset.rejectionReason || "This item has no preview URL yet. It may still be processing or the provider returned no media.",
    tone: "muted",
  };
}

function PreviewStatusCard({ asset, videoLoadFailed = false }: { asset: CanvasAsset; videoLoadFailed?: boolean }) {
  const status = previewStatusFor(asset, videoLoadFailed);
  const isError = status.tone === "error";
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-1.5 px-3 text-center ${
        isError
          ? "bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-200"
      }`}
      data-testid={`preview-status-${asset.id}`}
      title={status.detail}
    >
      <AlertTriangle className={`w-4 h-4 ${isError ? "text-rose-500" : "text-neutral-400"}`} />
      <div className="text-[10px] font-semibold leading-tight">{status.title}</div>
      <div className={`line-clamp-3 text-[9px] leading-snug ${isError ? "text-rose-700 dark:text-rose-200" : "text-neutral-500 dark:text-neutral-400"}`}>
        {status.detail}
      </div>
    </div>
  );
}

export interface CanvasBatch {
  batchId: string;
  batchLabel: string | null;
  assets: CanvasAsset[];
}

export type ReEvalModel = "openai" | "gemini";

interface BoardCanvasProps {
  batches: CanvasBatch[];
  compileOrderByAssetId?: Map<string, number>;
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
  /**
   * Throttled live "I'm dragging these tiles" beacon. Fires while the user
   * is moving tiles and one final time on release with `isEnd=true`. The
   * page wires this to a WebSocket broadcast so other collaborators can
   * render an in-flight ghost at the new position.
   */
  onTileDragging?: (moves: AssetMove[], isEnd: boolean) => void;
  /**
   * Per-tile remote drag overrides keyed by assetId. Each entry carries the
   * remote dragger's current target position plus their display label so the
   * canvas can render a translucent "ghost" tile with their name attached.
   */
  remoteDrags?: Map<
    string,
    {
      positionX: number;
      positionY: number;
      userId: string;
      name: string | null;
      email: string | null;
    }
  >;
  /**
   * Throttled live "where my mouse is" beacon. Fires while the local user
   * moves their cursor over the canvas, and one final time on leave with
   * `null` coordinates so collaborators can clear the cursor immediately
   * instead of waiting for the idle timeout. Coordinates are in
   * scroller-content space so they line up across viewers regardless of
   * each viewer's own scroll position or window size.
   */
  onCursorMove?: (x: number | null, y: number | null) => void;
  /**
   * Per-user remote cursor positions keyed by userId. Each entry carries
   * the cursor's position in scroller-content coordinates and the remote
   * user's display label so the canvas can render a small labelled pointer
   * exactly where the collaborator's mouse is hovering.
   */
  remoteCursors?: Map<
    string,
    { x: number; y: number; name: string | null; email: string | null }
  >;
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
  compileOrderByAssetId,
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
  onTileDragging,
  remoteDrags,
  onCursorMove,
  remoteCursors,
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

  // Per-session stacking order. Tiles touched by a drag are bumped to the top
  // so a tile dropped on the same coordinates as a sibling stays in front
  // instead of getting buried under whichever sibling renders later in DOM
  // order. Combined with a baseline z-index for any tile that has a stored
  // non-zero position, this keeps moved tiles above untouched ones too.
  const [tileZOrder, setTileZOrder] = useState<Map<string, number>>(
    () => new Map(),
  );
  const tileZCounterRef = useRef(0);
  const bumpTileZ = (ids: string[]) => {
    if (ids.length === 0) return;
    setTileZOrder((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        tileZCounterRef.current += 1;
        next.set(id, tileZCounterRef.current);
      }
      return next;
    });
  };

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
    // Raise the dragged tiles immediately so they paint above siblings as
    // soon as the drag starts (and stay there after drop).
    bumpTileZ(ids);
  };

  useEffect(() => {
    // Throttle the live drag broadcast so we don't flood the websocket with
    // a packet per mousemove. ~60ms ≈ 16fps which is smooth enough for a
    // ghost preview without saturating the channel.
    const DRAG_BROADCAST_INTERVAL_MS = 60;
    let lastDragBroadcastAt = 0;
    const buildMoves = (s: NonNullable<typeof tileDragRef.current>, dx: number, dy: number): AssetMove[] =>
      s.ids.map((id) => {
        const start = s.starts.get(id) ?? { x: 0, y: 0 };
        return {
          id,
          positionX: Math.round(start.x + dx),
          positionY: Math.round(start.y + dy),
        };
      });
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
      if (onTileDragging) {
        const now = Date.now();
        if (now - lastDragBroadcastAt >= DRAG_BROADCAST_INTERVAL_MS) {
          lastDragBroadcastAt = now;
          onTileDragging(buildMoves(s, dx, dy), false);
        }
      }
    };
    const onUp = (e: MouseEvent) => {
      const s = tileDragRef.current;
      if (!s) return;
      tileDragRef.current = null;
      setActiveTileDrag(null);
      if (!s.moved) {
        // No drag actually happened; still tell collaborators to clear any
        // ghost they might be holding (defensive — they shouldn't be).
        onTileDragging?.([], true);
        return;
      }
      // Suppress the click that fires immediately after the drag's mouseup
      // so it doesn't toggle/clear the selection.
      suppressTileClickUntilRef.current = Date.now() + TILE_DRAG_CLICK_SUPPRESS_MS;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      const moves = buildMoves(s, dx, dy);
      // Final ghost-clear beacon. The persisted positions arrive moments
      // later via `board_asset_updated`, so the ghost should disappear here
      // and the canonical tile slides into the new spot on the receiver.
      onTileDragging?.(moves, true);
      onMoveAssets?.(moves);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onMoveAssets, onTileDragging]);

  // Throttled local cursor broadcast. We translate clientX/Y into the
  // scroller's content space so every viewer pins the remote cursor at the
  // same logical spot regardless of how their own canvas is scrolled or
  // sized. The send rate is capped at ~50ms (≈20fps) which feels live but
  // never floods the websocket. A final `null,null` packet is sent on
  // mouseleave / pagehide so collaborators can clear the cursor instantly
  // instead of waiting for the receiver-side idle timeout.
  const lastCursorBroadcastAtRef = useRef(0);
  const handleCursorMoveOverScroller = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCursorMove) return;
    const root = scrollerRef.current;
    if (!root) return;
    const now = Date.now();
    if (now - lastCursorBroadcastAtRef.current < 50) return;
    lastCursorBroadcastAtRef.current = now;
    const rect = root.getBoundingClientRect();
    const x = e.clientX - rect.left + root.scrollLeft;
    const y = e.clientY - rect.top + root.scrollTop;
    onCursorMove(x, y);
  };
  const handleCursorLeaveScroller = () => {
    if (!onCursorMove) return;
    lastCursorBroadcastAtRef.current = 0;
    onCursorMove(null, null);
  };
  // Send a final clear when the page itself is going away — mouseleave
  // doesn't fire on tab close, so without this the cursor would linger on
  // every other viewer's canvas until the 5s idle expiry.
  useEffect(() => {
    if (!onCursorMove) return;
    const onPageHide = () => onCursorMove(null, null);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [onCursorMove]);

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
        onMouseMove={handleCursorMoveOverScroller}
        onMouseLeave={handleCursorLeaveScroller}
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
              compileOrderByAssetId={compileOrderByAssetId}
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
              tileZOrder={tileZOrder}
              remoteDrags={remoteDrags}
            />
          ))
        )}
        {remoteCursors && remoteCursors.size > 0 && (
          <RemoteCursorLayer cursors={remoteCursors} />
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

export function RemoteCursorLayer({
  cursors,
}: {
  cursors: Map<
    string,
    { x: number; y: number; name: string | null; email: string | null }
  >;
}) {
  // Cursors live in the scroller's content layer so they scroll naturally
  // with the canvas. Each pointer is non-interactive so it can't intercept
  // clicks on the tiles underneath; the label sits to the bottom-right of
  // the arrow so it doesn't visually collide with the tip. Color and
  // initials are derived from the same userId-based palette as the
  // presence avatars so a viewer's cursor matches their avatar circle.
  return (
    <>
      {Array.from(cursors.entries()).map(([userId, c]) => {
        const hex = colorHexFor(userId);
        const bg = colorFor(userId);
        const initials = initialsFor(c.name, c.email);
        const fullLabel = labelFor({ name: c.name, email: c.email });
        return (
          <div
            key={userId}
            className="absolute pointer-events-none z-40"
            style={{ left: c.x, top: c.y, transform: "translate(-2px, -2px)" }}
            data-testid={`remote-cursor-${userId}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}
            >
              <path
                d="M2 1 L2 14 L6 11 L8.5 16 L11 15 L8.5 10 L13 10 Z"
                fill={hex}
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            <div
              className={`mt-0.5 ml-3 inline-block px-1.5 py-0.5 rounded ${bg} text-white text-[10px] font-semibold leading-none shadow whitespace-nowrap`}
              title={fullLabel}
              data-testid={`remote-cursor-label-${userId}`}
            >
              {initials}
            </div>
          </div>
        );
      })}
    </>
  );
}

function BatchGroup({
  batch,
  compileOrderByAssetId,
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
  tileZOrder,
  remoteDrags,
}: {
  batch: CanvasBatch;
  compileOrderByAssetId?: Map<string, number>;
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
  tileZOrder: Map<string, number>;
  remoteDrags?: Map<
    string,
    {
      positionX: number;
      positionY: number;
      userId: string;
      name: string | null;
      email: string | null;
    }
  >;
}) {
  const [reEvalOpen, setReEvalOpen] = useState(false);
  const winnerId = pickWinnerId(batch.assets);
  const canReEval = batch.assets.some(
    (a) => !!a.assetUrl && (a.status === "ready" || a.status === "rejected"),
  );
  // Any tile still queued/generating lights up the whole batch box with an
  // animated glow border so the creation moment reads as "alive".
  const batchGenerating = batch.assets.some(
    (a) => a.status === "queued" || a.status === "generating",
  );

  // Tiles move via CSS `transform`, which doesn't grow their flex container,
  // so dragged tiles visually hang outside the batch box. After each layout we
  // measure the tiles' real (post-transform) extent and grow the box to cover
  // them, keeping the whole batch visually grouped no matter where tiles land.
  const boxRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  // Serialize the inputs that affect tile geometry so the effect re-runs when
  // any tile moves, resizes, or is added/removed.
  const tileGeometryKey = batch.assets
    .map((a) => `${a.id}:${a.positionX ?? 0}:${a.positionY ?? 0}:${a.width ?? 0}:${a.height ?? 0}`)
    .join("|");
  // While a tile in this batch is being dragged its stored position hasn't
  // committed yet, so fold the live drag delta into the key to re-measure on
  // every move and grow the box in real time.
  const draggingHere = batch.assets.some((a) => activeTileDrag?.ids.has(a.id));
  const liveDragKey = draggingHere
    ? `${activeTileDrag!.delta.x}:${activeTileDrag!.delta.y}`
    : "";
  useLayoutEffect(() => {
    const box = boxRef.current;
    const flow = flowRef.current;
    if (!box || !flow) return;
    const boxRect = box.getBoundingClientRect();
    // Account for the box's own padding (p-2.5 = 10px) so tiles never touch the
    // border. Read it live in case the class ever changes.
    const pad = parseFloat(getComputedStyle(box).paddingRight) || 10;
    let maxRight = 0;
    let maxBottom = 0;
    for (const child of Array.from(flow.children)) {
      const r = (child as HTMLElement).getBoundingClientRect();
      maxRight = Math.max(maxRight, r.right - boxRect.left);
      maxBottom = Math.max(maxBottom, r.bottom - boxRect.top);
    }
    // Grow-only via min-*: this adds empty space to cover translated tiles
    // without shifting the tiles themselves, so the measurement stays stable
    // (no resize feedback loop). Tiles in their default flow are unaffected.
    box.style.minWidth = maxRight > 0 ? `${Math.ceil(maxRight + pad)}px` : "";
    box.style.minHeight = maxBottom > 0 ? `${Math.ceil(maxBottom + pad)}px` : "";
  }, [tileGeometryKey, liveDragKey]);

  return (
    <div className="mb-5" data-testid={`batch-${batch.batchId}`}>
      <div className="flex items-center justify-between mb-1.5 ml-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[280px]" title={batch.batchLabel ?? undefined}>
            {batch.batchLabel || "Batch"}
          </span>
          {(() => {
            const generatingCount = batch.assets.filter(a => a.status === "queued" || a.status === "generating").length;
            const total = batch.assets.length;
            const provider = batch.assets[0]?.provider;
            const providerLabel: Record<string, string> = {
              luma: "Luma", runway: "Runway", veo: "VEO", kling: "Kling",
              sora2: "Sora 2", seedance: "Seedance", "gemini-image": "Gemini",
              "openai-image": "DALL·E", heygen: "HeyGen", upload: "Upload",
            };
            if (generatingCount > 0) {
              return (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium shrink-0">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  {generatingCount === total ? "Generating…" : `${generatingCount}/${total} generating`}
                  {provider && providerLabel[provider] ? ` · ${providerLabel[provider]}` : ""}
                </span>
              );
            }
            if (provider && providerLabel[provider]) {
              return (
                <span className="px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] shrink-0">
                  {providerLabel[provider]}
                </span>
              );
            }
            return null;
          })()}
        </div>
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
      <div
        ref={boxRef}
        className={`bg-white/70 backdrop-blur-sm border border-neutral-200/80 rounded-lg p-2.5 dark:bg-neutral-900/70 dark:border-neutral-800 ${
          batchGenerating ? "batch-generating-glow" : ""
        }`}
      >
        <div ref={flowRef} className="flex flex-wrap gap-2">
          {batch.assets.map((a) => {
            const source = a.sourceAssetId ? assetsById.get(a.sourceAssetId) ?? null : null;
            const isDragging = activeTileDrag?.ids.has(a.id) ?? false;
            const baseX = typeof a.positionX === "number" ? a.positionX : 0;
            const baseY = typeof a.positionY === "number" ? a.positionY : 0;
            // Local drag wins over a remote ghost — if I'm actively dragging
            // this tile myself, my own gesture is the source of truth.
            const remote = !isDragging ? remoteDrags?.get(a.id) ?? null : null;
            const offsetX = remote
              ? remote.positionX
              : baseX + (isDragging ? activeTileDrag!.delta.x : 0);
            const offsetY = remote
              ? remote.positionY
              : baseY + (isDragging ? activeTileDrag!.delta.y : 0);
            // Stacking: any tile with a stored non-zero position sits above
            // tiles still in their flex-flow slot, and recently-dragged
            // tiles sit above older ones (tracked by tileZOrder). The
            // currently-dragging tile is bumped highest of all.
            const hasStoredPosition = baseX !== 0 || baseY !== 0;
            const sessionZ = tileZOrder.get(a.id) ?? 0;
            const baselineZ = hasStoredPosition || sessionZ > 0 ? 1 : 0;
            const tileZ = isDragging
              ? 9999
              : remote
                ? 9000
                : baselineZ + sessionZ;
            return (
              <AssetTile
                key={a.id}
                remoteDragger={
                  remote
                    ? {
                        userId: remote.userId,
                        name: remote.name,
                        email: remote.email,
                      }
                    : null
                }
                asset={a}
                sourceAsset={source}
                compileOrder={compileOrderByAssetId?.get(a.id)}
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
                zIndex={tileZ}
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
  compileOrder,
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
  zIndex,
  isDragging,
  onDragStart,
  consumeClickAfterDrag,
  remoteDragger,
}: {
  asset: CanvasAsset;
  sourceAsset?: CanvasAsset | null;
  compileOrder?: number;
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
  zIndex: number;
  isDragging: boolean;
  onDragStart?: (e: React.MouseEvent) => void;
  consumeClickAfterDrag: () => boolean;
  /**
   * When non-null, another collaborator is currently dragging this tile.
   * The render path treats the tile as a translucent "ghost" and pins a
   * small badge with their initials in their per-user color so viewers
   * can see who is moving it without losing the visual link to that
   * collaborator's avatar / cursor elsewhere on the canvas.
   */
  remoteDragger?: {
    userId: string;
    name: string | null;
    email: string | null;
  } | null;
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
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const compileOrderForVideo = asset.kind === "video" && typeof compileOrder === "number" ? compileOrder : null;
  const historyButtonTop = compileOrderForVideo != null ? "top-7" : "top-1.5";
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
  useEffect(() => {
    if (asset.kind === "video") {
      setVideoLoadFailed(false);
    }
  }, [asset.kind, src, asset.status]);
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
  // Legacy image/video tiles were persisted at the old 150x110 default. Bump
  // any tile at/below that legacy size up to the current default so existing
  // boards match new generations — but never shrink tiles the user has
  // manually enlarged beyond the legacy threshold.
  const isMediaTile = asset.kind === "image" || asset.kind === "video";
  const normalizeMedia = (
    stored: number | null | undefined,
    legacy: number,
    next: number,
  ): number | null => {
    if (!isMediaTile) return typeof stored === "number" && stored > 0 ? stored : null;
    if (typeof stored !== "number" || stored <= 0) return next;
    return stored <= legacy ? next : stored;
  };
  const normalizedWidth = normalizeMedia(asset.width, 160, fallbackSize.width);
  const normalizedHeight = normalizeMedia(asset.height, 120, fallbackSize.height);
  const storedWidth =
    typeof normalizedWidth === "number" && normalizedWidth > 0
      ? normalizedWidth
      : fallbackSize.width;
  const storedHeight =
    typeof normalizedHeight === "number" && normalizedHeight > 0
      ? normalizedHeight
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

  const compactNoPreview =
    isMediaTile &&
    !generating &&
    ((!src && asset.status !== "ready") || (asset.kind === "video" && videoLoadFailed));
  const tileWidth = isResizable
    ? compactNoPreview
      ? Math.min(size.width, COMPACT_NO_PREVIEW_SIZE.width)
      : size.width
    : 150;
  const tileHeight = isResizable
    ? compactNoPreview
      ? Math.min(size.height, COMPACT_NO_PREVIEW_SIZE.height)
      : size.height
    : 110;

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

  // Per-user color / label for the remote-drag affordance. Reusing the
  // same helpers as live cursors / presence avatars guarantees the badge,
  // the ring around the ghost tile, and that viewer's pointer & avatar
  // all share one identity so it's obvious at a glance who is moving
  // what — even with several collaborators dragging different tiles at
  // once.
  const remoteDragHex = remoteDragger ? colorHexFor(remoteDragger.userId) : null;
  const remoteDragBg = remoteDragger ? colorFor(remoteDragger.userId) : null;
  const remoteDragInitials = remoteDragger
    ? initialsFor(remoteDragger.name, remoteDragger.email)
    : null;
  const remoteDragLabel = remoteDragger
    ? labelFor({ name: remoteDragger.name, email: remoteDragger.email })
    : null;

  return (
    <div
      ref={tileRef}
      style={{
        width: tileWidth,
        height: tileHeight,
        transform:
          offsetX || offsetY ? `translate(${offsetX}px, ${offsetY}px)` : undefined,
        zIndex: zIndex || undefined,
        opacity: isDragging ? 0.85 : remoteDragger ? 0.7 : undefined,
        // While a remote drag is in flight we let the cursor pass through
        // so the local user can still grab tiles underneath without their
        // clicks being eaten by a translucent ghost in motion.
        pointerEvents: remoteDragger ? "none" : undefined,
        transition: remoteDragger ? "transform 80ms linear" : undefined,
        // Tailwind ring utilities can't take a dynamic hex from the
        // per-user palette, so we paint the ring directly via boxShadow
        // (the same trick `ring-2` uses under the hood). The dragger's
        // color sits on the outside; if the tile is also a winner we
        // tuck a thin amber outline *inside* the per-user ring so both
        // signals stay readable at the same time without one hiding
        // the other.
        boxShadow: (() => {
          const layers: string[] = [];
          if (remoteDragHex) layers.push(`0 0 0 2px ${remoteDragHex}`);
          if (isWinner && remoteDragger) {
            // amber-400 = #fbbf24; inset so it reads as an inner outline
            // tucked inside the per-user color ring.
            layers.push(`inset 0 0 0 2px #fbbf24`);
          }
          return layers.length ? layers.join(", ") : undefined;
        })(),
        borderRadius: remoteDragger ? "0.375rem" : undefined,
      }}
      className={`relative group flex-shrink-0 ${
        isWinner && !remoteDragger ? "ring-2 ring-amber-400 rounded-md" : ""
      }`}
      onMouseLeave={() => {
        setHistoryOpen(false);
        setBeforeOpen(false);
      }}
      data-asset-id={asset.id}
      data-tile-offset-x={offsetX || undefined}
      data-tile-offset-y={offsetY || undefined}
      data-remote-dragger={remoteDragLabel || undefined}
      data-remote-dragger-user-id={remoteDragger?.userId || undefined}
    >
      {remoteDragger && remoteDragBg && (
        // The ghost tile body stays click-through (pointerEvents: "none"
        // on the parent) so the local user can still grab tiles
        // underneath, but the label re-enables pointer events on itself
        // so the native `title` tooltip can fire on hover. Mouse events
        // on this small badge don't get in the way of underlying tile
        // selection because the badge sits above the tile, not over its
        // hit-testable surface.
        <div
          className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded ${remoteDragBg} text-white text-[10px] font-semibold leading-none shadow whitespace-nowrap pointer-events-auto z-10`}
          title={remoteDragLabel ?? undefined}
          data-testid={`tile-remote-dragger-${asset.id}`}
        >
          {remoteDragInitials}
        </div>
      )}
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
          asset.kind === "video" ? (
            videoLoadFailed ? (
              <PreviewStatusCard asset={asset} videoLoadFailed />
            ) : (
              <video
                src={src}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                onError={() => setVideoLoadFailed(true)}
              />
            )
          ) : (
            <img src={src} alt="" className="w-full h-full object-cover" />
          )
        ) : generating ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center gap-1.5 bg-neutral-50 dark:bg-neutral-900/60">
            {/* Decorative twinkling sparkles — an "AI is conjuring this" cue. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <Sparkles className="gen-sparkle w-3 h-3" style={{ top: "16%", left: "15%", animationDelay: "0s" }} />
              <Sparkles className="gen-sparkle w-2.5 h-2.5" style={{ top: "28%", right: "17%", animationDelay: "0.45s" }} />
              <Sparkles className="gen-sparkle w-2 h-2" style={{ bottom: "26%", left: "24%", animationDelay: "0.9s" }} />
              <Sparkles className="gen-sparkle w-3 h-3" style={{ bottom: "18%", right: "20%", animationDelay: "1.3s" }} />
            </div>
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <div className="text-center px-1">
              <div className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                {asset.status === "queued" ? "Queued" : "Generating"}
              </div>
              {asset.provider && (() => {
                const providerLabel: Record<string, string> = {
                  luma: "Luma", runway: "Runway", veo: "VEO", kling: "Kling",
                  sora2: "Sora 2", seedance: "Seedance", "gemini-image": "Gemini",
                  "openai-image": "DALL·E", heygen: "HeyGen",
                };
                const label = providerLabel[asset.provider] ?? asset.provider;
                return <div className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-0.5">{label}</div>;
              })()}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-200/60 dark:bg-neutral-700/60 overflow-hidden" data-testid={`progress-${asset.id}`}>
              <div className="h-full w-1/3 bg-blue-500 rounded-r-full animate-progress-slide" />
            </div>
          </div>
        ) : (
          <PreviewStatusCard asset={asset} />
        )}
        {asset.durationSeconds != null && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white">
            <span className="font-medium">{Math.round(asset.durationSeconds)}s</span>
          </div>
        )}
        {compileOrderForVideo != null && (
          <div
            className="absolute top-1.5 left-1.5 min-w-[18px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center"
            data-testid={`badge-compile-order-${asset.id}`}
            title={`Compile order ${compileOrderForVideo}`}
          >
            {compileOrderForVideo}
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
          className={`absolute ${historyButtonTop} left-1.5 w-5 h-5 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-20`}
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
