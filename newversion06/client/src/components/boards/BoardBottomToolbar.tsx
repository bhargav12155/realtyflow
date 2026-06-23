import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  MousePointer2,
  Image as ImageIcon,
  Video,
  AudioWaveform,
  Frame,
  Pencil,
  Type,
  StickyNote,
  Circle,
  Plus,
  Loader2,
  RotateCcw,
  X,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

/** A single in-flight (or just-failed) board upload, surfaced as a chip
 * above the bottom toolbar so the user can see progress / retry errors. */
export interface BoardUploadChip {
  id: string;
  fileName: string;
  /** 0-100 while `status === "uploading"`. */
  percent: number;
  status: "uploading" | "error";
  error?: string;
}

export interface BoardBottomToolbarProps {
  /** Whether the cursor (default) tool is active. */
  cursorActive: boolean;
  /** Activate cursor mode — also clears any selected asset. */
  onActivateCursor: () => void;
  /** Called with the user-picked file list scoped to image MIME types. */
  onPickImage: (files: FileList) => void;
  /** Called with the user-picked file list scoped to video MIME types. */
  onPickVideo: (files: FileList) => void;
  /** Called with the user-picked file list (image OR video). Same handler the
   * `Ctrl+U` / `Cmd+U` shortcut routes through. */
  onPickMedia: (files: FileList) => void;
  /** Called with the user-picked file list scoped to audio MIME types. */
  onPickAudio: (files: FileList) => void;
  /** Drop a new sticky-note asset on the canvas. */
  onCreateSticky: () => void;
  /** Drop a new free-text asset on the canvas. */
  onCreateText: () => void;
  /** Drop a new labeled frame asset on the canvas. */
  onCreateFrame: () => void;
  /** Open the in-app drawing pad. */
  onOpenDraw: () => void;
  /** Open the in-app voice recorder. */
  onOpenRecord: () => void;
  /** In-flight / failed uploads to render as chips above the toolbar. */
  uploads?: BoardUploadChip[];
  /** Retry an errored chip — gets a fresh attempt with the original File. */
  onRetryUpload?: (id: string) => void;
  /** Dismiss a chip without retrying (only available for errored chips). */
  onDismissUpload?: (id: string) => void;
  /** Cancel an in-flight upload. Aborts the signed PUT and removes the chip. */
  onCancelUpload?: (id: string) => void;
}

/** Imperative handle the parent uses to open the "+" media picker from
 * the page-level Ctrl+U / Cmd+U keyboard shortcut. */
export interface BoardBottomToolbarHandle {
  openMediaPicker: () => void;
}

export const BoardBottomToolbar = forwardRef<
  BoardBottomToolbarHandle,
  BoardBottomToolbarProps
>(function BoardBottomToolbar(
  {
    cursorActive,
    onActivateCursor,
    onPickImage,
    onPickVideo,
    onPickMedia,
    onPickAudio,
    onCreateSticky,
    onCreateText,
    onCreateFrame,
    onOpenDraw,
    onOpenRecord,
    uploads = [],
    onRetryUpload,
    onDismissUpload,
    onCancelUpload,
  },
  ref,
) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openMediaPicker: () => mediaInputRef.current?.click(),
  }));

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
      data-testid="container-board-bottom-toolbar"
    >
      {uploads.length > 0 && (
        <div
          className="flex flex-col items-stretch gap-1.5 max-w-[min(28rem,90vw)] w-max"
          data-testid="list-board-uploads"
          role="status"
          aria-live="polite"
        >
          {uploads.map((u) => (
            <UploadChip
              key={u.id}
              upload={u}
              onRetry={onRetryUpload}
              onDismiss={onDismissUpload}
              onCancel={onCancelUpload}
            />
          ))}
        </div>
      )}
      <div
        className="bg-white rounded-full shadow-lg border border-neutral-200 px-2 py-1.5 flex items-center gap-1 dark:bg-neutral-900 dark:border-neutral-700"
        data-testid="toolbar-board-bottom"
        role="toolbar"
        aria-label="Board tools"
      >
      <ToolButton
        icon={MousePointer2}
        label="Select"
        active={cursorActive}
        onClick={onActivateCursor}
        testId="toolbar-bottom-cursor"
      />
      <ToolButton
        icon={ImageIcon}
        label="Upload image"
        onClick={() => imageInputRef.current?.click()}
        testId="toolbar-bottom-image"
      />
      <ToolButton
        icon={Video}
        label="Upload video"
        onClick={() => videoInputRef.current?.click()}
        testId="toolbar-bottom-video"
      />
      <ToolButton
        icon={AudioWaveform}
        label="Upload audio"
        onClick={() => audioInputRef.current?.click()}
        testId="toolbar-bottom-audio"
      />
      <ToolButton
        icon={Frame}
        label="Add frame"
        onClick={onCreateFrame}
        testId="toolbar-bottom-frame"
      />
      <ToolButton
        icon={Pencil}
        label="Draw"
        onClick={onOpenDraw}
        testId="toolbar-bottom-draw"
      />
      <ToolButton
        icon={Type}
        label="Add text"
        onClick={onCreateText}
        testId="toolbar-bottom-text"
      />
      <ToolButton
        icon={StickyNote}
        label="Add sticky note"
        onClick={onCreateSticky}
        testId="toolbar-bottom-sticky"
      />
      <ToolButton
        icon={Circle}
        iconClassName="fill-rose-500 text-rose-500"
        label="Record voice note"
        onClick={onOpenRecord}
        testId="toolbar-bottom-record"
      />
      <div className="w-px h-5 bg-neutral-200 mx-1 dark:bg-neutral-700" />
      <button
        type="button"
        onClick={() => mediaInputRef.current?.click()}
        title="Media Upload (Ctrl+U)"
        aria-label="Media Upload"
        data-testid="toolbar-bottom-plus"
        className="group relative w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-100 text-neutral-700 dark:hover:bg-neutral-800 dark:text-neutral-200"
      >
        <Plus className="w-4 h-4" />
        <span
          className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 text-white text-[11px] px-2 py-1 shadow opacity-0 group-hover:opacity-100 transition-opacity dark:bg-neutral-100 dark:text-neutral-900 flex items-center gap-1.5"
          data-testid="tooltip-toolbar-bottom-plus"
        >
          Media Upload
          <kbd
            className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-[10px] font-mono text-neutral-200 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-700"
            data-testid="kbd-toolbar-bottom-plus"
          >
            Ctrl+U
          </kbd>
        </span>
      </button>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="input-toolbar-bottom-image"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) onPickImage(files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        data-testid="input-toolbar-bottom-video"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) onPickVideo(files);
          e.target.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        data-testid="input-toolbar-bottom-audio"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) onPickAudio(files);
          e.target.value = "";
        }}
      />
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        data-testid="input-toolbar-bottom-plus"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) onPickMedia(files);
          e.target.value = "";
        }}
      />
      </div>
    </div>
  );
});

function UploadChip({
  upload,
  onRetry,
  onDismiss,
  onCancel,
}: {
  upload: BoardUploadChip;
  onRetry?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  const isError = upload.status === "error";
  return (
    <div
      className={`flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1.5 shadow-md border text-xs min-w-0 ${
        isError
          ? "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-100"
          : "bg-white border-neutral-200 text-neutral-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
      }`}
      data-testid={`chip-upload-${upload.id}`}
    >
      {isError ? (
        <AlertCircle
          className="w-3.5 h-3.5 flex-shrink-0 text-rose-500 dark:text-rose-300"
          aria-hidden="true"
        />
      ) : (
        <Loader2
          className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-violet-500 dark:text-violet-300"
          aria-hidden="true"
        />
      )}
      <span
        className="truncate max-w-[12rem] font-medium"
        title={upload.fileName}
        data-testid={`text-upload-name-${upload.id}`}
      >
        {upload.fileName}
      </span>
      {isError ? (
        <span
          className="truncate text-rose-700/80 dark:text-rose-200/80 max-w-[10rem]"
          title={upload.error}
          data-testid={`text-upload-error-${upload.id}`}
        >
          {upload.error || "Upload failed"}
        </span>
      ) : (
        <span
          className="tabular-nums text-neutral-500 dark:text-neutral-400"
          data-testid={`text-upload-percent-${upload.id}`}
        >
          {upload.percent}%
        </span>
      )}
      {!isError && onCancel && (
        <button
          type="button"
          onClick={() => onCancel(upload.id)}
          aria-label={`Cancel upload of ${upload.fileName}`}
          title="Cancel upload"
          className="w-5 h-5 inline-flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          data-testid={`button-upload-cancel-${upload.id}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {isError && onRetry && (
        <button
          type="button"
          onClick={() => onRetry(upload.id)}
          className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400"
          data-testid={`button-upload-retry-${upload.id}`}
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          Retry
        </button>
      )}
      {isError && onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(upload.id)}
          aria-label={`Dismiss ${upload.fileName}`}
          className="w-5 h-5 inline-flex items-center justify-center rounded-full text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900"
          data-testid={`button-upload-dismiss-${upload.id}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  iconClassName,
  label,
  active,
  disabled,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId: string;
}) {
  const baseColors = disabled
    ? "text-neutral-300 cursor-not-allowed dark:text-neutral-600"
    : active
      ? "bg-neutral-100 text-violet-600 dark:bg-neutral-800 dark:text-violet-300"
      : "hover:bg-neutral-100 text-neutral-700 dark:hover:bg-neutral-800 dark:text-neutral-200";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-pressed={active}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={`group relative w-7 h-7 rounded-full flex items-center justify-center ${baseColors}`}
    >
      <Icon className={`w-4 h-4 ${iconClassName ?? ""}`} />
    </button>
  );
}
