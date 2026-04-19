import { useState } from "react";
import { Flag, Tag, Plus, Minus as MinusIcon } from "lucide-react";

export interface CanvasAsset {
  id: string;
  assetUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  status: string;
  rejectionReason?: string | null;
  kind: string;
}

export interface CanvasBatch {
  batchId: string;
  batchLabel: string | null;
  assets: CanvasAsset[];
}

interface BoardCanvasProps {
  batches: CanvasBatch[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onDeleteAsset: (id: string) => void;
  onClearRejection: (id: string) => void;
}

export function BoardCanvas({
  batches,
  selectedAssetId,
  onSelectAsset,
  onDeleteAsset,
  onClearRejection,
}: BoardCanvasProps) {
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
              selectedAssetId={selectedAssetId}
              onSelectAsset={(id) => onSelectAsset(id)}
              onDeleteAsset={onDeleteAsset}
              onClearRejection={onClearRejection}
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
  selectedAssetId,
  onSelectAsset,
  onDeleteAsset,
  onClearRejection,
}: {
  batch: CanvasBatch;
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  onDeleteAsset: (id: string) => void;
  onClearRejection: (id: string) => void;
}) {
  return (
    <div className="mb-5" data-testid={`batch-${batch.batchId}`}>
      <div className="text-[11px] text-neutral-500 mb-1.5 ml-1 dark:text-neutral-400">{batch.batchLabel || "Batch"}</div>
      <div className="bg-white/70 backdrop-blur-sm border border-neutral-200/80 rounded-lg p-2.5 dark:bg-neutral-900/70 dark:border-neutral-800">
        <div className="flex flex-wrap gap-2">
          {batch.assets.map((a) => (
            <AssetTile
              key={a.id}
              asset={a}
              selected={a.id === selectedAssetId}
              onSelect={() => onSelectAsset(a.id)}
              onDelete={() => onDeleteAsset(a.id)}
              onClearRejection={() => onClearRejection(a.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AssetTile({
  asset,
  selected,
  onSelect,
  onDelete,
  onClearRejection,
}: {
  asset: CanvasAsset;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onClearRejection: () => void;
}) {
  const flagged = asset.status === "rejected";
  const generating = asset.status === "queued" || asset.status === "generating";
  const src = asset.thumbnailUrl || asset.assetUrl;
  return (
    <div
      className={`relative rounded-md overflow-hidden bg-neutral-200 dark:bg-neutral-800 group flex-shrink-0 w-[150px] h-[110px] cursor-pointer ${
        selected ? "ring-2 ring-blue-500" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      data-testid={`asset-${asset.id}`}
    >
      {src ? (
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
      {flagged && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 border border-white shadow flex items-center justify-center" data-testid={`badge-flag-${asset.id}`}>
          <Flag className="w-2.5 h-2.5 text-white" strokeWidth={3} fill="white" />
        </div>
      )}
      {selected && flagged && asset.rejectionReason && (
        <RejectionPopup
          reason={asset.rejectionReason}
          onDelete={onDelete}
          onClear={onClearRejection}
        />
      )}
    </div>
  );
}

function RejectionPopup({
  reason,
  onDelete,
  onClear,
}: {
  reason: string;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="absolute -top-2 -right-3 w-[240px] bg-rose-500 text-white rounded-xl shadow-lg p-3 z-30"
      data-testid="popup-rejection"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-1">
        <Tag className="w-4 h-4 fill-white" />
        <span className="text-[13px] font-bold tracking-wide">REJECTED</span>
      </div>
      <div className="text-[12px] leading-snug mb-2.5">{reason}</div>
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
