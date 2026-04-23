import { useMemo } from "react";

export interface PresenceViewer {
  userId: string;
  name: string | null;
  email: string | null;
}

interface PresenceAvatarsProps {
  viewers: PresenceViewer[];
  /** Cap how many circles to render before collapsing into "+N". */
  max?: number;
}

const PALETTE = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name: string | null, email: string | null): string {
  const src = (name && name.trim()) || (email && email.trim()) || "?";
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function labelFor(v: PresenceViewer): string {
  return (v.name && v.name.trim()) || (v.email && v.email.trim()) || "Viewer";
}

export function PresenceAvatars({ viewers, max = 4 }: PresenceAvatarsProps) {
  const visible = useMemo(() => viewers.slice(0, max), [viewers, max]);
  const overflow = viewers.length - visible.length;
  if (viewers.length === 0) return null;
  return (
    <div
      className="flex items-center -space-x-1.5"
      data-testid="row-presence-avatars"
      aria-label={`${viewers.length} other viewer${viewers.length === 1 ? "" : "s"}`}
    >
      {visible.map((v) => (
        <div
          key={v.userId}
          title={labelFor(v)}
          data-testid={`avatar-presence-${v.userId}`}
          className={`w-6 h-6 rounded-full ring-2 ring-white dark:ring-neutral-900 ${colorFor(v.userId)} text-white text-[10px] font-semibold flex items-center justify-center`}
        >
          {initialsFor(v.name, v.email)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-neutral-900 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-[10px] font-semibold flex items-center justify-center"
          data-testid="text-presence-overflow"
          title={viewers
            .slice(max)
            .map(labelFor)
            .join(", ")}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
