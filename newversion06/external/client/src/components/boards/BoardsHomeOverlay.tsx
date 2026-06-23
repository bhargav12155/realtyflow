import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Moon, Sun, X } from "lucide-react";
import { BoardsHomeView } from "@/components/boards/BoardsHomeView";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";

export interface BoardsHomeOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BoardsHomeOverlay({ open, onOpenChange }: BoardsHomeOverlayProps) {
  const { theme, toggle: toggleTheme } = useBoardsTheme();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          data-testid="boards-overlay-backdrop"
        />
        <DialogPrimitive.Content
          className={`${theme === "dark" ? "dark " : ""}fixed inset-0 z-50 overflow-auto bg-white dark:bg-neutral-950 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`}
          data-testid="boards-overlay-content"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const promptInput = document.querySelector<HTMLInputElement>(
              '[data-testid="boards-overlay-content"] [data-testid="input-prompt"]',
            );
            promptInput?.focus();
          }}
          onPointerDown={(e) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            // The X close button manages its own dismissal.
            if (target.closest('[data-testid="button-close-boards-overlay"]')) return;
            // Clicks inside an interactive island stay open.
            if (target.closest("[data-overlay-keep]")) return;
            // Clicks inside a nested Radix layer (AlertDialog confirm,
            // DropdownMenu items, etc.) reach this handler via React's
            // portal-aware event tree even though the DOM target lives
            // under document.body. Treat them as "inside" so confirming
            // "Delete board" / "Leave board" doesn't dismiss the overlay.
            if (
              target.closest(
                '[role="alertdialog"], [role="menu"], [role="menuitem"], [role="listbox"], [role="combobox"], [data-radix-popper-content-wrapper]',
              )
            ) {
              return;
            }
            // Otherwise the user clicked on the gray backdrop area → dismiss.
            onOpenChange(false);
          }}
          onPointerDownOutside={(e) => {
            // The Content is full-screen and already owns dismissal via the
            // custom onPointerDown above (gray gutter) and the X close button.
            // Radix's outside-dismissal would otherwise fire when the user
            // confirms a nested AlertDialog (e.g. "Delete board" / "Leave
            // board") whose content is portaled to document.body, bouncing
            // the user back to /dashboard. Always prevent Radix's outside
            // dismissal here — our explicit handlers cover the legitimate
            // close paths.
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            // Same reason as onPointerDownOutside: focus restoration from a
            // closing nested layer (AlertDialog/DropdownMenu) would otherwise
            // dismiss the overlay because the focused element ends up at
            // document.body.
            e.preventDefault();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Boards</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Create a new board or open an existing one.
          </DialogPrimitive.Description>

          <BoardsHomeView
            onBoardCreated={() => onOpenChange(false)}
            onRequestClose={() => onOpenChange(false)}
          />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch Boards to light mode" : "Switch Boards to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="fixed right-16 top-4 z-[60] w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-neutral-200 shadow-sm flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-900/90 dark:hover:bg-neutral-900 dark:border-neutral-700"
            data-overlay-keep
            data-testid="button-toggle-boards-theme-overlay"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-neutral-200" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-700" />
            )}
          </button>

          <DialogPrimitive.Close
            className="fixed right-5 top-4 z-[60] w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-neutral-200 shadow-sm flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-900/90 dark:hover:bg-neutral-900 dark:border-neutral-700"
            aria-label="Close Boards"
            data-overlay-keep
            data-testid="button-close-boards-overlay"
          >
            <X className="w-4 h-4 text-neutral-700 dark:text-neutral-200" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
