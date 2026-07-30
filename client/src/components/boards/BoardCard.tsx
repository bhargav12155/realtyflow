import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MoreVertical, Plus, LogOut, Trash2, BellOff, Pencil, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BOARD_TITLE_MAX = 200;

export interface BoardCollaborator {
  userId: string;
  name: string | null;
  email: string | null;
}

export interface BoardOwner {
  id: string;
  name: string | null;
  email: string | null;
}

export interface BoardSummary {
  id: string;
  title: string;
  isShared?: boolean;
  /** True when the current user is the board's owner; false when only a recipient. */
  isOwner?: boolean;
  updatedAt?: string | Date | null;
  assetCount?: number;
  thumbnails?: { id: string; thumbnailUrl: string | null; kind: string }[];
  /** Users this board is shared with (only set on boards the current user owns). */
  collaborators?: BoardCollaborator[];
  /** The owner of this board (only set on boards shared with the current user). */
  owner?: BoardOwner | null;
  /** When false, the owner has muted collaborator join/leave emails for this board. */
  notifyOnCollaboratorChange?: boolean;
}

const AVATAR_TINTS = [
  "bg-emerald-200 text-emerald-900",
  "bg-amber-200 text-amber-900",
  "bg-rose-200 text-rose-900",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
  "bg-orange-200 text-orange-900",
  "bg-teal-200 text-teal-900",
  "bg-pink-200 text-pink-900",
];

function pickAvatarTint(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

function displayName(person: { name: string | null; email: string | null }): string {
  return (person.name && person.name.trim()) || (person.email && person.email.trim()) || "Unknown";
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "Edited just now";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "Edited recently";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Edited just now";
  if (m < 60) return `Edited ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Edited ${h}h ago`;
  const d = Math.floor(h / 24);
  return `Edited ${d}d ago`;
}

type Thumb = { id: string; thumbnailUrl: string | null; kind?: string };

function SmartCover({ thumbs, boardTitle }: { thumbs: Thumb[]; boardTitle: string }) {
  const withMedia = thumbs.filter((t) => !!t.thumbnailUrl);
  if (withMedia.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-50 text-neutral-500 dark:from-neutral-900 dark:to-neutral-800 dark:text-neutral-300">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-xl" aria-hidden="true">✨</span>
          <p className="text-sm font-medium">No content yet</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Start creating...</p>
        </div>
      </div>
    );
  }

  const img = (src: string, key: string, cls: string) => (
    <img
      key={key}
      src={src}
      alt={`${boardTitle} thumbnail`}
      loading="lazy"
      className={`${cls} object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]`}
    />
  );

  if (withMedia.length === 1) {
    return <div className="h-full w-full">{img(withMedia[0].thumbnailUrl as string, withMedia[0].id, "h-full w-full")}</div>;
  }

  if (withMedia.length === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-1">
        {withMedia.slice(0, 2).map((t) => img(t.thumbnailUrl as string, t.id, "h-full w-full"))}
      </div>
    );
  }

  if (withMedia.length === 3) {
    return (
      <div className="grid h-full w-full grid-cols-3 gap-1">
        {img(withMedia[0].thumbnailUrl as string, withMedia[0].id, "col-span-2 h-full w-full")}
        <div className="grid h-full grid-rows-2 gap-1">
          {img(withMedia[1].thumbnailUrl as string, withMedia[1].id, "h-full w-full")}
          {img(withMedia[2].thumbnailUrl as string, withMedia[2].id, "h-full w-full")}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1">
      {withMedia.slice(0, 4).map((t) => img(t.thumbnailUrl as string, t.id, "h-full w-full"))}
    </div>
  );
}

function inferContentType(board: BoardSummary): string {
  const thumbKinds = new Set((board.thumbnails ?? []).map((t) => t.kind));
  if (thumbKinds.has("image")) return "Image Project";
  if (thumbKinds.has("video")) return "Video Project";
  const title = (board.title ?? "").toLowerCase();
  if (title.includes("blog") || title.includes("article")) return "Blog Content";
  if (title.includes("social") || title.includes("post")) return "Social Content";
  if (title.includes("campaign")) return "Campaign";
  return "Creative Board";
}

function assetBadges(board: BoardSummary): Array<{ label: string; count: number }> {
  const thumbs = board.thumbnails ?? [];
  const byKind = new Map<string, number>();
  thumbs.forEach((t) => {
    if (!t.kind) return;
    byKind.set(t.kind, (byKind.get(t.kind) ?? 0) + 1);
  });

  const badges: Array<{ label: string; count: number }> = [];
  if (byKind.get("image")) badges.push({ label: "🖼", count: byKind.get("image") as number });
  if (byKind.get("video")) badges.push({ label: "🎥", count: byKind.get("video") as number });
  if (byKind.get("audio")) badges.push({ label: "🎧", count: byKind.get("audio") as number });

  if (badges.length === 0 && (board.assetCount ?? 0) > 0) {
    badges.push({ label: "✨", count: board.assetCount as number });
  }
  return badges.slice(0, 3);
}

function Avatar({
  seed,
  label,
  testId,
}: {
  seed: string;
  label: string;
  testId?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-semibold ring-2 ring-white dark:ring-neutral-900 ${pickAvatarTint(seed)}`}
      data-testid={testId}
    >
      {initials(label)}
    </span>
  );
}

function CollaboratorStack({
  boardId,
  collaborators,
}: {
  boardId: string;
  collaborators: BoardCollaborator[];
}) {
  if (collaborators.length === 0) return null;
  const visible = collaborators.slice(0, 3);
  const overflow = collaborators.length - visible.length;
  const countLabel = `Shared with ${collaborators.length} ${collaborators.length === 1 ? "person" : "people"}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="mt-3 flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
          tabIndex={0}
          data-testid={`collaborators-${boardId}`}
        >
          <div className="flex -space-x-1.5">
            {visible.map((c) => (
              <Avatar
                key={c.userId}
                seed={c.userId}
                label={displayName(c)}
                testId={`avatar-collaborator-${boardId}-${c.userId}`}
              />
            ))}
            {overflow > 0 && (
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-semibold bg-neutral-200 text-neutral-700 ring-2 ring-white dark:bg-neutral-700 dark:text-neutral-200 dark:ring-neutral-900"
                data-testid={`avatar-overflow-${boardId}`}
              >
                +{overflow}
              </span>
            )}
          </div>
          <span
            className="text-[10px] text-neutral-600 dark:text-neutral-400"
            data-testid={`text-shared-count-${boardId}`}
          >
            {countLabel}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-xs"
        data-testid={`tooltip-collaborators-${boardId}`}
      >
        <div className="text-xs font-semibold mb-1">{countLabel}</div>
        <ul className="space-y-0.5">
          {collaborators.map((c) => (
            <li
              key={c.userId}
              className="flex items-center gap-2 text-xs"
              data-testid={`tooltip-collaborator-${boardId}-${c.userId}`}
            >
              <Avatar seed={c.userId} label={displayName(c)} />
              <span className="truncate">{displayName(c)}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function OwnerBadge({ boardId, owner }: { boardId: string; owner: BoardOwner }) {
  const label = displayName(owner);
  const ownerName = (owner.name && owner.name.trim()) || null;
  const ownerEmail = (owner.email && owner.email.trim()) || null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="mt-3 flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
          tabIndex={0}
          data-testid={`owner-${boardId}`}
        >
          <Avatar seed={owner.id} label={label} testId={`avatar-owner-${boardId}`} />
          <span
            className="text-[10px] text-neutral-600 truncate dark:text-neutral-400"
            data-testid={`text-owner-${boardId}`}
          >
            Shared by {label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-xs"
        data-testid={`tooltip-owner-${boardId}`}
      >
        <div className="flex items-center gap-2">
          <Avatar seed={owner.id} label={label} />
          <div className="flex flex-col">
            <span className="text-xs font-semibold">{ownerName ?? label}</span>
            {ownerEmail && (
              <span className="text-xs text-muted-foreground">{ownerEmail}</span>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export interface BoardCardProps {
  board: BoardSummary;
  /** When provided and the current user is not the owner, a kebab menu with a Leave action is rendered. */
  onLeave?: (board: BoardSummary) => void;
  isLeaving?: boolean;
  /** When provided and the current user is the owner, a kebab menu with a Delete action is rendered. */
  onDelete?: (board: BoardSummary) => void;
  isDeleting?: boolean;
  /** When provided and the current user is the owner, a kebab menu with a Rename action is rendered. */
  onRename?: (board: BoardSummary, newTitle: string) => void;
  isRenaming?: boolean;
}

export function BoardCard({
  board,
  onLeave,
  isLeaving,
  onDelete,
  isDeleting,
  onRename,
  isRenaming,
}: BoardCardProps) {
  const isOwner = board.isOwner ?? true;
  const collaborators = board.collaborators ?? [];
  const coverThumbs = board.thumbnails ?? [];
  const contentTypeLabel = inferContentType(board);
  const badges = assetBadges(board);
  const showLeave = !!onLeave && isOwner === false;
  // Destructive action: never fall back to "owner" when the flag is missing.
  // If the API ever omits `isOwner`, we must not surface a Delete option that
  // would confuse the user (and hide their Leave option).
  const showDelete = !!onDelete && board.isOwner === true;
  // Rename mirrors Delete's owner-only gate — the server enforces the same
  // authorization on PATCH /api/boards/:id, so we must not surface this for
  // shared collaborators.
  const showRename = !!onRename && board.isOwner === true;
  const showMenu = showLeave || showDelete || showRename;
  // Owner-only cue so the user can tell at a glance which boards have
  // collaborator join/leave emails silenced via the share dialog toggle.
  const showMutedIndicator =
    board.isOwner === true && board.notifyOnCollaboratorChange === false;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(board.title || "");
  // Reset the input whenever the dialog opens so it always reflects the
  // current title (and clears any stale typing from a previous open).
  useEffect(() => {
    if (renameOpen) {
      setRenameValue(board.title || "");
    }
  }, [renameOpen, board.title]);
  const titleForCopy = board.title || "Untitled board";
  const trimmedRename = renameValue.trim();
  const renameInvalid =
    trimmedRename.length === 0 || trimmedRename.length > BOARD_TITLE_MAX;
  const renameUnchanged = trimmedRename === (board.title || "").trim();
  return (
    <div className="group relative" data-testid={`board-shell-${board.id}`}>
      <Link href={`/boards/${board.id}`}>
        <a
          className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_rgba(15,23,42,0.07)] transition-all duration-200 ease-out hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_2px_8px_rgba(15,23,42,0.08),0_16px_30px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
          data-testid={`card-board-${board.id}`}
        >
          <div className="relative h-44 overflow-hidden rounded-t-2xl bg-neutral-100 dark:bg-neutral-800">
            <SmartCover thumbs={coverThumbs} boardTitle={board.title || "Untitled board"} />
          </div>

          <div className="space-y-2.5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-5 text-neutral-900 dark:text-neutral-100">
                  {board.title || "Untitled board"}
                </h3>
                <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">{contentTypeLabel}</p>
              </div>
              {showMutedIndicator && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-neutral-500 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:focus-visible:ring-neutral-600"
                      aria-label="Collaborator emails muted"
                      data-testid={`indicator-muted-${board.id}`}
                    >
                      <BellOff className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="max-w-xs"
                    data-testid={`tooltip-muted-${board.id}`}
                  >
                    <span className="text-xs">
                      Collaborator join/leave emails are muted for this board. Open the share dialog to re-enable them.
                    </span>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {badges.map((badge) => (
                <span
                  key={`${board.id}-${badge.label}`}
                  className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  <span>{badge.label}</span>
                  <span className="ml-1">{badge.count}</span>
                </span>
              ))}
              {(board.assetCount ?? 0) > 0 && (
                <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                  {board.assetCount} assets
                </span>
              )}
              {!isOwner && (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                  Shared
                </span>
              )}
            </div>

            <div className="text-[12px] text-neutral-500 dark:text-neutral-400">{relativeTime(board.updatedAt)}</div>
            {isOwner ? (
              <CollaboratorStack boardId={board.id} collaborators={collaborators} />
            ) : board.owner ? (
              <OwnerBadge boardId={board.id} owner={board.owner} />
            ) : null}
          </div>
        </a>
      </Link>
      {showMenu && (
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/86 text-neutral-700 opacity-0 shadow-sm transition-all duration-200 ease-out group-hover:opacity-100 hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-neutral-800/86 dark:text-neutral-200 dark:hover:bg-neutral-800"
                aria-label="Board actions"
                data-testid={`button-board-menu-${board.id}`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {showRename && (
                <DropdownMenuItem
                  disabled={isRenaming}
                  onSelect={(e) => {
                    e.preventDefault();
                    setRenameOpen(true);
                  }}
                  data-testid={`menu-item-rename-${board.id}`}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Rename
                </DropdownMenuItem>
              )}
              {showLeave && (
                <DropdownMenuItem
                  disabled={isLeaving}
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmOpen(true);
                  }}
                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  data-testid={`menu-item-leave-${board.id}`}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave board
                </DropdownMenuItem>
              )}
              {showDelete && (
                <DropdownMenuItem
                  disabled={isDeleting}
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmOpen(true);
                  }}
                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  data-testid={`menu-item-delete-${board.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete board
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {showRename && (
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
              <DialogContent
                onClick={(e) => e.stopPropagation()}
                data-testid={`dialog-rename-board-${board.id}`}
              >
                <DialogHeader>
                  <DialogTitle>Rename board</DialogTitle>
                  <DialogDescription>
                    Pick a new name for "{titleForCopy}".
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (renameInvalid || renameUnchanged || isRenaming) return;
                    onRename?.(board, trimmedRename);
                    setRenameOpen(false);
                  }}
                >
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={BOARD_TITLE_MAX}
                    placeholder="Board name"
                    aria-label="Board name"
                    data-testid={`input-rename-board-${board.id}`}
                  />
                  {trimmedRename.length === 0 ? (
                    <p
                      className="mt-2 text-xs text-red-600 dark:text-red-400"
                      data-testid={`text-rename-error-${board.id}`}
                    >
                      Name can't be empty.
                    </p>
                  ) : trimmedRename.length > BOARD_TITLE_MAX ? (
                    <p
                      className="mt-2 text-xs text-red-600 dark:text-red-400"
                      data-testid={`text-rename-error-${board.id}`}
                    >
                      Name can't be longer than {BOARD_TITLE_MAX} characters.
                    </p>
                  ) : null}
                  <DialogFooter className="mt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRenameOpen(false)}
                      data-testid={`button-cancel-rename-${board.id}`}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={renameInvalid || renameUnchanged || isRenaming}
                      data-testid={`button-confirm-rename-${board.id}`}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent
              onClick={(e) => e.stopPropagation()}
              data-testid={
                showDelete
                  ? `dialog-delete-board-${board.id}`
                  : `dialog-leave-board-${board.id}`
              }
            >
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {showDelete ? "Delete this board?" : "Leave this board?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {showDelete
                    ? `Delete "${titleForCopy}"? This permanently removes the board and all its assets. This can't be undone.`
                    : `You'll lose access to "${titleForCopy}". The owner will need to share it with you again to get back in.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  data-testid={
                    showDelete
                      ? `button-cancel-delete-${board.id}`
                      : `button-cancel-leave-${board.id}`
                  }
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={showDelete ? isDeleting : isLeaving}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (showDelete) onDelete?.(board);
                    else onLeave?.(board);
                    setConfirmOpen(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid={
                    showDelete
                      ? `button-confirm-delete-${board.id}`
                      : `button-confirm-leave-${board.id}`
                  }
                >
                  {showDelete ? "Delete board" : "Leave board"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

export function NewBoardCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex min-h-[292px] cursor-pointer items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:border-neutral-400 hover:shadow-[0_2px_8px_rgba(15,23,42,0.08),0_14px_24px_rgba(15,23,42,0.1)] dark:border-neutral-700 dark:bg-neutral-900/50 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
      data-testid="card-new-board"
    >
      <div className="flex flex-col items-center gap-2.5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700 transition-colors duration-200 group-hover:bg-neutral-900 group-hover:text-white dark:bg-neutral-800 dark:text-neutral-200 dark:group-hover:bg-neutral-100 dark:group-hover:text-neutral-900">
          <Plus className="h-7 w-7" strokeWidth={1.6} />
        </div>
        <p className="inline-flex items-center gap-1 text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Create New Board
        </p>
        <p className="max-w-[210px] text-[13px] leading-5 text-neutral-500 dark:text-neutral-400">
          Start organizing your AI projects
        </p>
      </div>
    </button>
  );
}
