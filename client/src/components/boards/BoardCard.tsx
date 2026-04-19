import { Link } from "wouter";
import { MoreVertical, Plus, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface BoardSummary {
  id: string;
  title: string;
  isShared?: boolean;
  /** True when the current user is the board's owner; false when only a recipient. */
  isOwner?: boolean;
  updatedAt?: string | Date | null;
  assetCount?: number;
  thumbnails?: { id: string; thumbnailUrl: string | null; kind: string }[];
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

function pickTint(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
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

export interface BoardCardProps {
  board: BoardSummary;
  /** When provided and the current user is not the owner, a kebab menu with a Leave action is rendered. */
  onLeave?: (board: BoardSummary) => void;
  isLeaving?: boolean;
}

export function BoardCard({ board, onLeave, isLeaving }: BoardCardProps) {
  const tint = pickTint(board.id);
  const [first, ...rest] = (board.title || "Untitled board").split(" ");
  const highlight = rest.join(" ");
  const showLeave = onLeave && board.isOwner === false;
  return (
    <div className="relative">
      <Link href={`/boards/${board.id}`}>
        <a
          className={`block bg-gradient-to-br ${tint} rounded-2xl p-4 hover:ring-2 hover:ring-neutral-300 transition cursor-pointer dark:bg-none dark:bg-neutral-900 dark:hover:ring-neutral-700`}
          data-testid={`card-board-${board.id}`}
        >
          <div className="text-[10px] font-semibold tracking-wider text-neutral-700 mb-0.5 uppercase dark:text-neutral-300">
            {first} {highlight && <span className="text-neutral-900 dark:text-neutral-100">{highlight}</span>}
          </div>
          <div className="text-[10px] text-neutral-500 mb-3 dark:text-neutral-400">{relativeTime(board.updatedAt)}</div>
          <ThumbCollage thumbs={board.thumbnails ?? []} />
        </a>
      </Link>
      {showLeave && (
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
              <DropdownMenuItem
                disabled={isLeaving}
                onSelect={(e) => {
                  e.preventDefault();
                  onLeave?.(board);
                }}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                data-testid={`menu-item-leave-${board.id}`}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
