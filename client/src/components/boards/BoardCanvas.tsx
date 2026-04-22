import { useState } from "react";
import { Flag, Tag, Plus, Minus as MinusIcon, Crown, Sparkles, History } from "lucide-react";
import type { BoardAssetEvalHistoryEntry } from "@shared/schema";
import { parseDrawingContent, drawingStrokeToPath } from "./DrawingModal";

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
}

export interface CanvasBatch {
  batchId: string;
  batchLabel: string | null;
  assets: CanvasAsset[];
}

export type ReEvalModel = "openai" | "gemini";

interface BoardCanvasProps {
  batches: CanvasBatch[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onDeleteAsset: (id: string) => void;
  onClearRejection: (id: string) => void;
  onSetWinner?: (batchId: string, assetId: string) => void;
  onReEvaluate?: (
    batchId: string,
    payload: { modelHint: ReEvalModel; extraCriteria?: string },
  ) => void;
  reEvalPendingBatchId?: string | null;
  setWinnerPendingAssetId?: string | null;
}

export function BoardCanvas({
  batches,
  selectedAssetId,
  onSelectAsset,
  onDeleteAsset,
  onClearRejection,
  onSetWinner,
  onReEvaluate,
  reEvalPendingBatchId,
  setWinnerPendingAssetId,
}: BoardCanvasProps) {
  // Build a quick lookup so each tile can resolve its source-asset thumbnail
  // (used for the before/after preview on edited image tiles) without a prop
  // drill from the page level.
  const assetsById = new Map<string, CanvasAsset>();
  for (const b of batches) {
    for (const a of b.assets) assetsById.set(a.id, a);
  }
  return (
    <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)] dark:bg-[radial-gradient(circle,_rgba(255,255,255,0.06)_1px,_transparent_1px)] [background-size:18px_18px] bg-neutral-100 dark:bg-neutral-950">
      <div className="absolute inset-0 overflow-auto px-8 py-6" onClick={() => onSelectAsset(null)}>
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
              selectedAssetId={selectedAssetId}
              onSelectAsset={(id) => onSelectAsset(id)}
              onDeleteAsset={onDeleteAsset}
              onClearRejection={onClearRejection}
              onSetWinner={onSetWinner}
              onReEvaluate={onReEvaluate}
              reEvalPending={reEvalPendingBatchId === b.batchId}
              setWinnerPendingAssetId={setWinnerPendingAssetId}
            />
          ))
        )}
      </div>
      <ZoomControls />
    </main>
  );
}

function BatchGroup({
  batch,
  assetsById,
  selectedAssetId,
  onSelectAsset,
  onDeleteAsset,
  onClearRejection,
  onSetWinner,
  onReEvaluate,
  reEvalPending,
  setWinnerPendingAssetId,
}: {
  batch: CanvasBatch;
  assetsById: Map<string, CanvasAsset>;
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  onDeleteAsset: (id: string) => void;
  onClearRejection: (id: string) => void;
  onSetWinner?: (batchId: string, assetId: string) => void;
  onReEvaluate?: (
    batchId: string,
    payload: { modelHint: ReEvalModel; extraCriteria?: string },
  ) => void;
  reEvalPending?: boolean;
  setWinnerPendingAssetId?: string | null;
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
            return (
              <AssetTile
                key={a.id}
                asset={a}
                sourceAsset={source}
                selected={a.id === selectedAssetId}
                isWinner={a.id === winnerId}
                onSelect={() => onSelectAsset(a.id)}
                onSelectSource={source ? () => onSelectAsset(source.id) : undefined}
                onDelete={() => onDeleteAsset(a.id)}
                onClearRejection={() => onClearRejection(a.id)}
                onSetWinner={
                  onSetWinner ? () => onSetWinner(batch.batchId, a.id) : undefined
                }
                setWinnerPending={setWinnerPendingAssetId === a.id}
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
  setWinnerPending,
}: {
  asset: CanvasAsset;
  sourceAsset?: CanvasAsset | null;
  selected: boolean;
  isWinner: boolean;
  onSelect: () => void;
  onSelectSource?: () => void;
  onDelete: () => void;
  onClearRejection: () => void;
  onSetWinner?: () => void;
  setWinnerPending?: boolean;
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
  return (
    <div
      className={`relative group flex-shrink-0 w-[150px] h-[110px] ${
        isWinner ? "ring-2 ring-amber-400 rounded-md" : ""
      }`}
      onMouseLeave={() => {
        setHistoryOpen(false);
        setBeforeOpen(false);
      }}
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
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        data-testid={`asset-${asset.id}`}
      >
        {isSticky ? (
          <div
            className="w-full h-full p-2 text-[11px] leading-snug text-neutral-900 whitespace-pre-wrap break-words overflow-hidden"
            data-testid={`sticky-content-${asset.id}`}
          >
            {asset.content || "Sticky note"}
          </div>
        ) : isText ? (
          <div
            className="w-full h-full p-1.5 text-[12px] leading-snug text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-words overflow-hidden"
            data-testid={`text-content-${asset.id}`}
          >
            {asset.content || "Text"}
          </div>
        ) : isFrame ? (
          <div
            className="w-full h-full p-1.5 flex items-start justify-start text-[11px] font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
            data-testid={`frame-content-${asset.id}`}
          >
            {asset.content || "Frame"}
          </div>
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
