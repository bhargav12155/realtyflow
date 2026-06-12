import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, Layers, MessageSquarePlus, RotateCcw, Trash2, X, type LucideIcon } from "lucide-react";
import type { CanvasAsset } from "./BoardCanvas";

interface AssetToolbarProps {
  asset: CanvasAsset;
  sourceAsset?: CanvasAsset | null;
  onClose: () => void;
  onDelete: () => void;
  onClearRejection: () => void;
  onReuseInChat: () => void;
}

export function AssetToolbar({
  asset,
  sourceAsset,
  onClose,
  onDelete,
  onClearRejection,
  onReuseInChat,
}: AssetToolbarProps) {
  const rawUrl = asset.assetUrl || asset.thumbnailUrl || "";
  const downloadHref = rawUrl.startsWith("/tmp/")
    ? (asset.thumbnailUrl || rawUrl)
    : rawUrl;
  const canDownload = !!downloadHref && asset.status === "ready";
  const isRejected = asset.status === "rejected";

  const beforeSrc = sourceAsset ? sourceAsset.assetUrl || sourceAsset.thumbnailUrl : null;
  const afterSrc = asset.assetUrl || asset.thumbnailUrl;
  const showCompare =
    !!sourceAsset && asset.kind === "image" && !!beforeSrc && !!afterSrc;

  return (
    <>
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-full shadow-lg border border-neutral-200 px-2 py-1.5 flex items-center gap-1 dark:bg-neutral-900 dark:border-neutral-700"
        data-testid="toolbar-asset"
        role="toolbar"
        aria-label="Selected asset actions"
      >
        <ToolbarButton icon={MessageSquarePlus} label="Reference in chat" onClick={onReuseInChat} testId="toolbar-reference" />
        <ToolbarButton icon={Layers} label="Make variation" onClick={onReuseInChat} testId="toolbar-variation" />
        <ToolbarButton
          icon={Copy}
          label="Copy asset URL"
          disabled={!downloadHref}
          onClick={() => {
            if (downloadHref && typeof navigator !== "undefined") {
              void navigator.clipboard?.writeText(downloadHref).catch(() => {});
            }
          }}
          testId="toolbar-copy"
        />
        <a
          href={canDownload ? downloadHref : undefined}
          download
          target="_blank"
          rel="noreferrer"
          className={`w-7 h-7 rounded-full flex items-center justify-center ${
            canDownload ? "hover:bg-neutral-100 text-neutral-700 dark:hover:bg-neutral-800 dark:text-neutral-200" : "text-neutral-300 pointer-events-none dark:text-neutral-600"
          }`}
          title="Download"
          data-testid="toolbar-download"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
        {isRejected && (
          <ToolbarButton icon={RotateCcw} label="Clear rejection" onClick={onClearRejection} testId="toolbar-clear-rejection" />
        )}
        <div className="w-px h-4 bg-neutral-200 mx-0.5 dark:bg-neutral-700" />
        <ToolbarButton icon={Trash2} label="Delete" onClick={onDelete} danger testId="toolbar-delete" />
        <div className="w-px h-4 bg-neutral-200 mx-0.5 dark:bg-neutral-700" />
        <ToolbarButton icon={X} label="Close" onClick={onClose} testId="toolbar-close" />
      </div>
      {showCompare && (
        <BeforeAfterPanel assetId={asset.id} beforeSrc={beforeSrc!} afterSrc={afterSrc!} />
      )}
    </>
  );
}

function BeforeAfterPanel({
  assetId,
  beforeSrc,
  afterSrc,
}: {
  assetId: string;
  beforeSrc: string;
  afterSrc: string;
}) {
  const [view, setView] = useState<"slider" | "before" | "after">("slider");
  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-[min(680px,calc(100%-32px))] bg-white rounded-lg shadow-lg border border-neutral-200 p-3 dark:bg-neutral-900 dark:border-neutral-700"
      data-testid={`compare-panel-${assetId}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">
          BEFORE / AFTER
        </div>
        <div
          className="inline-flex rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden text-[11px]"
          role="tablist"
          aria-label="Compare view"
        >
          {(
            [
              { id: "before", label: "Before" },
              { id: "slider", label: "Slider" },
              { id: "after", label: "After" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={view === opt.id}
              onClick={() => setView(opt.id)}
              className={`px-2 py-1 ${
                view === opt.id
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
              data-testid={`compare-tab-${opt.id}-${assetId}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {view === "slider" ? (
        <CompareSlider assetId={assetId} beforeSrc={beforeSrc} afterSrc={afterSrc} />
      ) : (
        <div className="relative w-full bg-neutral-100 dark:bg-neutral-800 rounded-md overflow-hidden">
          <img
            src={view === "before" ? beforeSrc : afterSrc}
            alt={view === "before" ? "Before" : "After"}
            className="w-full max-h-[60vh] object-contain"
            data-testid={`compare-image-${view}-${assetId}`}
          />
          <Tag label={view === "before" ? "Before" : "After"} side="left" />
        </div>
      )}
    </div>
  );
}

function CompareSlider({
  assetId,
  beforeSrc,
  afterSrc,
}: {
  assetId: string;
  beforeSrc: string;
  afterSrc: string;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, next)));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      updateFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      const t = e.touches[0];
      if (t) updateFromClientX(t.clientX);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateFromClientX]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPos((p) => Math.max(0, p - 2));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPos((p) => Math.min(100, p + 2));
    } else if (e.key === "Home") {
      e.preventDefault();
      setPos(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setPos(100);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-neutral-100 dark:bg-neutral-800 rounded-md overflow-hidden select-none"
      onMouseDown={(e) => {
        draggingRef.current = true;
        updateFromClientX(e.clientX);
      }}
      onTouchStart={(e) => {
        draggingRef.current = true;
        const t = e.touches[0];
        if (t) updateFromClientX(t.clientX);
      }}
      data-testid={`compare-slider-${assetId}`}
    >
      <img
        src={afterSrc}
        alt="After"
        className="block w-full max-h-[60vh] object-contain pointer-events-none"
      />
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${pos}%` }}
        data-testid={`compare-before-clip-${assetId}`}
      >
        <img
          src={beforeSrc}
          alt="Before"
          className="block h-full max-h-[60vh] object-contain"
          style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : "100%", maxWidth: "none" }}
        />
      </div>
      <Tag label="Before" side="left" />
      <Tag label="After" side="right" />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Before / after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKeyDown}
        className="absolute top-0 bottom-0 -translate-x-1/2 w-1 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ left: `${pos}%` }}
        data-testid={`compare-handle-${assetId}`}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-neutral-300 shadow flex items-center justify-center text-neutral-500 text-[10px] font-semibold">
          ‹›
        </div>
      </div>
    </div>
  );
}

function Tag({ label, side }: { label: string; side: "left" | "right" }) {
  return (
    <div
      className={`absolute top-2 ${side === "left" ? "left-2" : "right-2"} px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] uppercase tracking-wide pointer-events-none`}
    >
      {label}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={`w-7 h-7 rounded-full flex items-center justify-center ${
        disabled
          ? "text-neutral-300 cursor-not-allowed dark:text-neutral-600"
          : danger
          ? "hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/40 dark:text-rose-400"
          : "hover:bg-neutral-100 text-neutral-700 dark:hover:bg-neutral-800 dark:text-neutral-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
