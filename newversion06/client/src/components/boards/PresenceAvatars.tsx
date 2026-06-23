import { useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { colorFor, initialsFor, labelFor } from "@/lib/presence-colors";

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

export function PresenceAvatars({ viewers, max = 4 }: PresenceAvatarsProps) {
  const visible = useMemo(() => viewers.slice(0, max), [viewers, max]);
  const overflow = viewers.length - visible.length;
  if (viewers.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center -space-x-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900"
          data-testid="button-presence-avatars"
          aria-label={`${viewers.length} other viewer${viewers.length === 1 ? "" : "s"}. Click to see who's here.`}
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
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-0"
        data-testid="popover-presence-viewers"
      >
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
          <p
            className="text-xs font-semibold text-neutral-700 dark:text-neutral-200"
            data-testid="text-presence-heading"
          >
            {viewers.length} {viewers.length === 1 ? "person" : "people"} here
          </p>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {viewers.map((v) => {
            const name =
              (v.name && v.name.trim()) ||
              (v.email && v.email.trim()) ||
              "Viewer";
            const email = v.email && v.email.trim();
            const showEmail = email && email !== name;
            return (
              <li
                key={v.userId}
                className="flex items-center gap-2.5 px-3 py-2"
                data-testid={`row-presence-viewer-${v.userId}`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorFor(v.userId)}`}
                  aria-hidden="true"
                  data-testid={`dot-presence-${v.userId}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate"
                    data-testid={`text-presence-name-${v.userId}`}
                  >
                    {name}
                  </p>
                  {showEmail && (
                    <p
                      className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate"
                      data-testid={`text-presence-email-${v.userId}`}
                    >
                      {email}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
