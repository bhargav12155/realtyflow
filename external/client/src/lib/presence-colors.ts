/**
 * Single source of truth for the deterministic per-user color and label
 * helpers used by collaborator UI (presence avatars, live cursors, etc.).
 *
 * The same `userId` always maps to the same palette entry so a viewer's
 * avatar circle, cursor pointer, and any other affordance referring to
 * them all share one color across the app.
 */

export interface PresenceColor {
  /** Tailwind background utility class (e.g. for avatar circles, chips). */
  bg: string;
  /** CSS hex color (e.g. for SVG fills where utility classes don't apply). */
  hex: string;
}

const PALETTE: PresenceColor[] = [
  { bg: "bg-rose-500", hex: "#f43f5e" },
  { bg: "bg-amber-500", hex: "#f59e0b" },
  { bg: "bg-emerald-500", hex: "#10b981" },
  { bg: "bg-sky-500", hex: "#0ea5e9" },
  { bg: "bg-violet-500", hex: "#8b5cf6" },
  { bg: "bg-pink-500", hex: "#ec4899" },
  { bg: "bg-teal-500", hex: "#14b8a6" },
  { bg: "bg-indigo-500", hex: "#6366f1" },
];

function indexFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % PALETTE.length;
}

/** Tailwind background utility class for the given user id. */
export function colorFor(id: string): string {
  return PALETTE[indexFor(id)].bg;
}

/** Hex color string for the given user id (use for SVG fills, etc.). */
export function colorHexFor(id: string): string {
  return PALETTE[indexFor(id)].hex;
}

/**
 * Compute a 1–2 character monogram for the viewer. Falls back through
 * name → email → "?" so any combination of partial fields renders something.
 */
export function initialsFor(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const src = (name && name.trim()) || (email && email.trim()) || "?";
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Best-effort human label for a viewer (display name → email → "Viewer").
 * Used for tooltips and the long-form presence list.
 */
export function labelFor(viewer: {
  name: string | null | undefined;
  email: string | null | undefined;
}): string {
  return (
    (viewer.name && viewer.name.trim()) ||
    (viewer.email && viewer.email.trim()) ||
    "Viewer"
  );
}
