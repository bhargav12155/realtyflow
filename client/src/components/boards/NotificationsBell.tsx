import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";

interface BoardSharedData {
  boardId?: string;
  boardTitle?: string;
  sharedByName?: string | null;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsBell() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const notificationsQuery = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Only show unread notifications — dismissing or marking read should make
  // the item disappear from the list (per task requirements).
  const items = (notificationsQuery.data ?? []).filter((n) => !n.isRead);
  const unreadCount = items.length;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
    onError: (e: Error) =>
      toast({ title: "Couldn't dismiss notification", description: e?.message ?? String(e), variant: "destructive" }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const handleClickItem = (n: Notification) => {
    if (n.type === "board_shared") {
      const data = (n.data ?? {}) as BoardSharedData;
      if (data.boardId) {
        setOpen(false);
        if (!n.isRead) markRead.mutate(n.id);
        setLocation(`/boards/${data.boardId}`);
      }
    }
  };

  return (
    <div className="relative" data-overlay-keep>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60"
        data-testid="button-notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center"
            data-testid="badge-notifications-unread"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-[340px] max-h-[480px] overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg z-50 dark:bg-neutral-900 dark:border-neutral-800"
          data-testid="panel-notifications"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
                data-testid="button-mark-all-read"
              >
                Mark all read
              </button>
            )}
          </div>
          {notificationsQuery.isLoading ? (
            <div className="p-4 text-[12px] text-neutral-500 dark:text-neutral-400">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-neutral-500 dark:text-neutral-400" data-testid="text-notifications-empty">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((n) => {
                const data = (n.data ?? {}) as BoardSharedData;
                const isShare = n.type === "board_shared";
                const title = isShare
                  ? `${data.sharedByName ?? "Someone"} shared a board with you`
                  : "Notification";
                const subtitle = isShare ? data.boardTitle ?? "Untitled board" : null;
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-2 px-4 py-3 ${n.isRead ? "" : "bg-blue-50/40 dark:bg-blue-950/20"}`}
                    data-testid={`notification-${n.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleClickItem(n)}
                      className="flex-1 text-left"
                      data-testid={`button-notification-open-${n.id}`}
                    >
                      <div className="text-[12px] font-medium text-neutral-900 dark:text-neutral-100">{title}</div>
                      {subtitle && (
                        <div className="text-[12px] text-neutral-600 dark:text-neutral-300 truncate">{subtitle}</div>
                      )}
                      <div className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                        {n.createdAt ? timeAgo(new Date(n.createdAt)) : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      disabled={n.isRead || markRead.isPending}
                      className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                      data-testid={`button-notification-dismiss-${n.id}`}
                      aria-label="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
