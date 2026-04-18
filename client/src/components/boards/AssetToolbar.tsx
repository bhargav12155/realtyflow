import { Copy, Download, Layers, MessageSquarePlus, RotateCcw, Trash2, X } from "lucide-react";
import type { CanvasAsset } from "./BoardCanvas";

interface AssetToolbarProps {
  asset: CanvasAsset;
  onClose: () => void;
  onDelete: () => void;
  onClearRejection: () => void;
  onReuseInChat: () => void;
}

export function AssetToolbar({ asset, onClose, onDelete, onClearRejection, onReuseInChat }: AssetToolbarProps) {
  const downloadHref = asset.assetUrl || asset.thumbnailUrl || "";
  const canDownload = !!downloadHref && asset.status === "ready";
  const isRejected = asset.status === "rejected";

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-full shadow-lg border border-neutral-200 px-2 py-1.5 flex items-center gap-1"
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
        download={canDownload ? undefined : undefined}
        target="_blank"
        rel="noreferrer"
        className={`w-7 h-7 rounded-full flex items-center justify-center ${
          canDownload ? "hover:bg-neutral-100 text-neutral-700" : "text-neutral-300 pointer-events-none"
        }`}
        title="Download"
        data-testid="toolbar-download"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
      {isRejected && (
        <ToolbarButton icon={RotateCcw} label="Clear rejection" onClick={onClearRejection} testId="toolbar-clear-rejection" />
      )}
      <div className="w-px h-4 bg-neutral-200 mx-0.5" />
      <ToolbarButton icon={Trash2} label="Delete" onClick={onDelete} danger testId="toolbar-delete" />
      <div className="w-px h-4 bg-neutral-200 mx-0.5" />
      <ToolbarButton icon={X} label="Close" onClick={onClose} testId="toolbar-close" />
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
  icon: any;
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
          ? "text-neutral-300 cursor-not-allowed"
          : danger
          ? "hover:bg-rose-50 text-rose-600"
          : "hover:bg-neutral-100 text-neutral-700"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
