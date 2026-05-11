import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MoreVertical, Plus, LogOut, Trash2, BellOff, Pencil } from "lucide-react";
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

const TINTS = [
  "from-emerald-100 to-amber-50",
  "from-slate-200 to-slate-100",
  "from-amber-100 to-rose-50",
  "from-orange-100 to-amber-50",
  "from-stone-200 to-stone-100",
  "from-rose-100 to-pink-50",
  "from-emerald-100 to-teal-50",
  "from-blue-100 to-sky-50",
  "from-emerald-200 to-emerald-50",
];

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

function pickTint(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

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

function ThumbCollage({ thumbs }: { thumbs: { id: string; thumbnailUrl: string | null }[] }) {
  const slots = [0, 1, 2, 3].map((i) => thumbs[i]?.thumbnailUrl ?? null);
  return (
    <div className="grid grid-cols-2 gap-1 w-[148px] h-[148px] flex-shrink-0">
      {slots.map((src, i) => (
        <div key={i} className="bg-neutral-300/70 rounded-md overflow-hidden dark:bg-neutral-700/60">
          {src ? (
            <img src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-neutral-200 dark:bg-neutral-800" />
          )}
        </div>
      ))}
    </div>
  );
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
  const tint = pickTint(board.id);
  const [first, ...rest] = (board.title || "Untitled board").split(" ");
  const highlight = rest.join(" ");
  const isOwner = board.isOwner ?? true;
  const collaborators = board.collaborators ?? [];
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
    <div className="relative">
      <Link href={`/boards/${board.id}`}>
        <a
          className={`group block bg-gradient-to-br ${tint} rounded-2xl p-4 hover:ring-2 hover:ring-neutral-300 transition cursor-pointer dark:bg-none dark:bg-neutral-900 dark:hover:ring-neutral-700`}
          data-testid={`card-board-${board.id}`}
        >
          <div className="text-[10px] font-semibold tracking-wider text-neutral-700 mb-0.5 uppercase dark:text-neutral-300 flex items-center gap-1.5">
            <span>
              {first} {highlight && <span className="text-neutral-900 dark:text-neutral-100">{highlight}</span>}
            </span>
            {showRename && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Rename board"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRenameOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setRenameOpen(true);
                      }
                    }}
                    className="inline-flex items-center justify-center w-4 h-4 rounded text-neutral-500 dark:text-neutral-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 outline-none transition-opacity hover:text-neutral-800 dark:hover:text-neutral-200"
                    data-testid={`button-rename-inline-${board.id}`}
                  >
                    <Pencil className="w-3 h-3" strokeWidth={2} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  data-testid={`tooltip-rename-inline-${board.id}`}
                >
                  <span className="text-xs">Rename board</span>
                </TooltipContent>
              </Tooltip>
            )}
            {showMutedIndicator && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-neutral-500 dark:text-neutral-400 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
                    aria-label="Collaborator emails muted"
                    data-testid={`indicator-muted-${board.id}`}
                  >
                    <BellOff className="w-3 h-3" strokeWidth={2} />
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
          <div className="text-[10px] text-neutral-500 mb-3 dark:text-neutral-400">{relativeTime(board.updatedAt)}</div>
          <ThumbCollage thumbs={board.thumbnails ?? []} />
          {isOwner ? (
            <CollaboratorStack boardId={board.id} collaborators={collaborators} />
          ) : board.owner ? (
            <OwnerBadge boardId={board.id} owner={board.owner} />
          ) : null}
        </a>
      </Link>
      {showMenu && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="w-7 h-7 rounded-full bg-white/80 hover:bg-white text-neutral-700 flex items-center justify-center shadow-sm dark:bg-neutral-800/80 dark:hover:bg-neutral-800 dark:text-neutral-200"
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
      className="bg-neutral-100/70 border border-dashed border-neutral-300 rounded-2xl p-4 flex items-center justify-center min-h-[220px] hover:bg-neutral-200/60 transition cursor-pointer dark:bg-neutral-900/40 dark:border-neutral-700 dark:hover:bg-neutral-800/60"
      data-testid="card-new-board"
    >
      <div className="flex flex-col items-center gap-2">
        <Plus className="w-8 h-8 text-neutral-700 dark:text-neutral-300" strokeWidth={1.5} />
        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">New board</div>
      </div>
    </button>
  );
}
