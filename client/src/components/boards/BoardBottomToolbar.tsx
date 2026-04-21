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
  type LucideIcon,
} from "lucide-react";

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
}

/** Imperative handle the parent uses to open the "+" media picker from
 * the page-level Ctrl+U / Cmd+U keyboard shortcut. */
export interface BoardBottomToolbarHandle {
  openMediaPicker: () => void;
}

const COMING_SOON_TIP = "Coming soon";

export const BoardBottomToolbar = forwardRef<
  BoardBottomToolbarHandle,
  BoardBottomToolbarProps
>(function BoardBottomToolbar(
  { cursorActive, onActivateCursor, onPickImage, onPickVideo, onPickMedia },
  ref,
) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openMediaPicker: () => mediaInputRef.current?.click(),
  }));

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-full shadow-lg border border-neutral-200 px-2 py-1.5 flex items-center gap-1 dark:bg-neutral-900 dark:border-neutral-700"
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
        label={COMING_SOON_TIP}
        disabled
        testId="toolbar-bottom-audio"
      />
      <ToolButton
        icon={Frame}
        label={COMING_SOON_TIP}
        disabled
        testId="toolbar-bottom-frame"
      />
      <ToolButton
        icon={Pencil}
        label={COMING_SOON_TIP}
        disabled
        testId="toolbar-bottom-draw"
      />
      <ToolButton
        icon={Type}
        label={COMING_SOON_TIP}
        disabled
        testId="toolbar-bottom-text"
      />
      <ToolButton
        icon={StickyNote}
        label={COMING_SOON_TIP}
        disabled
        testId="toolbar-bottom-sticky"
      />
      <ToolButton
        icon={Circle}
        iconClassName="fill-rose-500 text-rose-500"
        label={COMING_SOON_TIP}
        disabled
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
  );
});

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
