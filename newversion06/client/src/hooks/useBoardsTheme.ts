import { useCallback, useEffect, useState } from "react";

export type BoardsTheme = "light" | "dark";

const STORAGE_KEY = "boards-theme";

type Listener = (t: BoardsTheme) => void;
const listeners = new Set<Listener>();
let current: BoardsTheme | null = null;

function readInitial(): BoardsTheme {
  if (current) return current;
  if (typeof window === "undefined") {
    current = "light";
    return current;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      current = stored;
      return stored;
    }
  } catch {
    // ignore (private mode, etc.)
  }
  current = "light";
  return current;
}

function setGlobal(next: BoardsTheme) {
  current = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l(next));
}

/**
 * Boards-scoped theme state. Persists in localStorage under "boards-theme" and
 * is shared across all consumers (sidebar toggle, home view, overlay, board
 * canvas, discover) via an in-module pub-sub so toggling in one surface
 * updates every other open surface immediately.
 *
 * The Boards UI applies the returned `theme` as a `dark` class on its own
 * roots (Tailwind is configured with darkMode: "class") — it never mutates
 * <html> / <body>, so the rest of the app stays light.
 */
export function useBoardsTheme(): {
  theme: BoardsTheme;
  toggle: () => void;
  setTheme: (t: BoardsTheme) => void;
} {
  const [theme, setTheme] = useState<BoardsTheme>(readInitial);

  useEffect(() => {
    const fn: Listener = (t) => setTheme(t);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const toggle = useCallback(() => {
    setGlobal(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return { theme, toggle, setTheme: setGlobal };
}

/** Test-only: reset the in-memory cache so tests can re-read localStorage. */
export function __resetBoardsThemeForTests() {
  current = null;
  listeners.clear();
}
