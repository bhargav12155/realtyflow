import { useState } from "react";
import {
  Copy,
  Download,
  Layers,
  MessageSquarePlus,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CanvasAsset } from "./BoardCanvas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GroupAssetToolbarProps {
  assets: CanvasAsset[];
  onClose: () => void;
  onReuseInChat: () => void;
  onBulkDelete: () => void;
  isDeleting?: boolean;
}

export function GroupAssetToolbar({
  assets,
  onClose,
  onReuseInChat,
  onBulkDelete,
  isDeleting,
}: GroupAssetToolbarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const count = assets.length;
  const downloadable = assets.filter(
    (a) => !!(a.assetUrl || a.thumbnailUrl) && a.status === "ready",
  );
  const urls = downloadable.map((a) => {
    const raw = a.assetUrl || a.thumbnailUrl || "";
    return raw.startsWith("/tmp/") ? (a.thumbnailUrl || raw) : raw;
  });
  const canCopy = urls.length > 0;
  const canDownload = downloadable.length > 0;

  const onCopyAll = () => {
    if (!canCopy || typeof navigator === "undefined") return;
    void navigator.clipboard?.writeText(urls.join("\n")).catch(() => {});
  };

  const onDownloadAll = () => {
    if (!canDownload || typeof document === "undefined") return;
    for (const url of urls) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <>
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-full shadow-lg border border-neutral-200 px-2 py-1.5 flex items-center gap-1 dark:bg-neutral-900 dark:border-neutral-700"
        data-testid="toolbar-group-asset"
        role="toolbar"
        aria-label="Selected assets actions"
      >
        <span
          className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-semibold dark:bg-violet-500/20 dark:text-violet-200"
          data-testid="text-group-selected-count"
          aria-label={`${count} assets selected`}
        >
          {count} selected
        </span>
        <div className="w-px h-4 bg-neutral-200 mx-0.5 dark:bg-neutral-700" />
        <ToolbarButton
          icon={MessageSquarePlus}
          label="Reference in chat"
          onClick={onReuseInChat}
          testId="toolbar-group-reference"
        />
        <ToolbarButton
          icon={Layers}
          label="Make variations"
          onClick={onReuseInChat}
          testId="toolbar-group-variation"
        />
        <ToolbarButton
          icon={Copy}
          label="Copy URLs"
          disabled={!canCopy}
          onClick={onCopyAll}
          testId="toolbar-group-copy"
        />
        <ToolbarButton
          icon={Download}
          label="Download all"
          disabled={!canDownload}
          onClick={onDownloadAll}
          testId="toolbar-group-download"
        />
        <div className="w-px h-4 bg-neutral-200 mx-0.5 dark:bg-neutral-700" />
        <ToolbarButton
          icon={Trash2}
          label="Delete selected"
          danger
          disabled={isDeleting}
          onClick={() => setConfirmOpen(true)}
          testId="toolbar-group-delete"
        />
        <div className="w-px h-4 bg-neutral-200 mx-0.5 dark:bg-neutral-700" />
        <ToolbarButton icon={X} label="Close" onClick={onClose} testId="toolbar-group-close" />
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="dialog-group-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count} {count === 1 ? "asset" : "assets"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected assets from this board. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-group-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onBulkDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              data-testid="button-group-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
