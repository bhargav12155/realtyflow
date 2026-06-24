import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface ShareCandidate {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
}

interface ShareRecipient {
  userId: string;
  name: string | null;
  email: string | null;
  sharedAt: string | null;
}

interface ShareBoardDialogProps {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BoardSummary {
  id: string;
  notifyOnCollaboratorChange?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function ShareBoardDialog({ boardId, open, onOpenChange }: ShareBoardDialogProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");

  const sharesQuery = useQuery<ShareRecipient[]>({
    queryKey: ["/api/boards", boardId, "shares"],
    enabled: open,
  });
  const candidatesQuery = useQuery<ShareCandidate[]>({
    queryKey: ["/api/boards/share-candidates"],
    enabled: open,
  });
  const boardQuery = useQuery<BoardSummary>({
    queryKey: ["/api/boards", boardId],
    enabled: open,
  });
  const notifyOn = boardQuery.data?.notifyOnCollaboratorChange ?? true;

  const notifyMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await apiRequest("PATCH", `/api/boards/${boardId}`, {
        notifyOnCollaboratorChange: next,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    },
    onError: (e: Error) => {
      toast({
        title: "Couldn't update notification setting",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    },
  });

  const sharedIds = useMemo(
    () => new Set((sharesQuery.data ?? []).map((s) => s.userId)),
    [sharesQuery.data],
  );
  const sharedEmails = useMemo(
    () => new Set((sharesQuery.data ?? []).map((s) => normalizeEmail(s.email ?? "")).filter(Boolean)),
    [sharesQuery.data],
  );

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (candidatesQuery.data ?? []).filter((c) => {
      if (!q) return true;
      const hay = `${c.name ?? ""} ${c.email ?? ""} ${c.username ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [candidatesQuery.data, search]);

  const shareMutation = useMutation({
    mutationFn: async (payload: { userId?: string; email?: string }) => {
      const res = await apiRequest("POST", `/api/boards/${boardId}/shares`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "shares"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't share board", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const normalizedSearch = normalizeEmail(search);
  const searchLooksLikeEmail = EMAIL_REGEX.test(normalizedSearch);
  const isAlreadySharedByEmail = sharedEmails.has(normalizedSearch);
  const emailExistsInCandidates = (candidatesQuery.data ?? []).some(
    (c) => normalizeEmail(c.email ?? "") === normalizedSearch,
  );
  const canInviteTypedEmail =
    searchLooksLikeEmail &&
    !isAlreadySharedByEmail &&
    !emailExistsInCandidates;

  const unshareMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/shares/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "shares"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't remove access", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-share-board">
        <DialogHeader>
          <DialogTitle>Share this board</DialogTitle>
          <DialogDescription>
            Pick teammates to give read access. They'll see the board on their "Shared" tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            className="flex items-start justify-between gap-3 px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-700"
            data-testid="row-notify-toggle"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                Email me when collaborators join or leave
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                In-app notifications still appear in the bell.
              </span>
            </div>
            <input
              type="checkbox"
              checked={notifyOn}
              onChange={(e) => notifyMutation.mutate(e.target.checked)}
              disabled={boardQuery.isLoading || notifyMutation.isPending}
              className="mt-1 h-4 w-4 cursor-pointer accent-neutral-900 disabled:opacity-50 dark:accent-neutral-100"
              aria-label="Email me when collaborators join or leave"
              data-testid="toggle-notify-collaborator-change"
            />
          </label>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full px-3 py-2 text-[13px] rounded-md border border-neutral-200 outline-none focus:border-neutral-400 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            data-testid="input-share-search"
          />

          <div>
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 dark:text-neutral-400">
              Shared with
            </div>
            <div className="space-y-1" data-testid="list-shared-with">
              {sharesQuery.isLoading && (
                <div className="text-[12px] text-neutral-400">Loading…</div>
              )}
              {!sharesQuery.isLoading && (sharesQuery.data?.length ?? 0) === 0 && (
                <div className="text-[12px] text-neutral-400" data-testid="text-no-shares">
                  Not shared with anyone yet.
                </div>
              )}
              {sharesQuery.data?.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800/60"
                  data-testid={`row-share-${s.userId}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] truncate text-neutral-900 dark:text-neutral-100">
                      {s.name || s.email || s.userId}
                    </span>
                    {s.email && s.name && (
                      <span className="text-[11px] text-neutral-500 truncate dark:text-neutral-400">
                        {s.email}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const label = s.name || s.email || s.userId;
                      const ok = await confirm({
                        title: "Remove access?",
                        description: `${label} will no longer be able to view this board.`,
                        confirmText: "Remove",
                        cancelText: "Cancel",
                        variant: "destructive",
                      });
                      if (ok) unshareMutation.mutate(s.userId);
                    }}
                    disabled={unshareMutation.isPending}
                    className="ml-2 text-neutral-500 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
                    aria-label="Remove access"
                    data-testid={`button-unshare-${s.userId}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 dark:text-neutral-400">
              Add people
            </div>
            <div className="max-h-56 overflow-auto space-y-1" data-testid="list-share-candidates">
              {candidatesQuery.isLoading && (
                <div className="text-[12px] text-neutral-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </div>
              )}
              {!candidatesQuery.isLoading && filteredCandidates.length === 0 && (
                <div className="text-[12px] text-neutral-400">No matching users.</div>
              )}
              {canInviteTypedEmail && (
                <button
                  type="button"
                  onClick={() => shareMutation.mutate({ email: normalizedSearch })}
                  disabled={shareMutation.isPending}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left hover:bg-neutral-100 disabled:opacity-60 dark:hover:bg-neutral-800/60"
                  data-testid="button-share-email"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] truncate text-neutral-900 dark:text-neutral-100">
                      Invite {normalizedSearch}
                    </span>
                    <span className="text-[11px] text-neutral-500 truncate dark:text-neutral-400">
                      They'll get access when they log in with this email.
                    </span>
                  </div>
                </button>
              )}
              {filteredCandidates.map((c) => {
                const already = sharedIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => !already && shareMutation.mutate({ userId: c.id })}
                    disabled={already || shareMutation.isPending}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left hover:bg-neutral-100 disabled:opacity-60 dark:hover:bg-neutral-800/60"
                    data-testid={`button-share-${c.id}`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] truncate text-neutral-900 dark:text-neutral-100">
                        {c.name || c.email || c.username || c.id}
                      </span>
                      {c.email && c.name && (
                        <span className="text-[11px] text-neutral-500 truncate dark:text-neutral-400">
                          {c.email}
                        </span>
                      )}
                    </div>
                    {already && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
