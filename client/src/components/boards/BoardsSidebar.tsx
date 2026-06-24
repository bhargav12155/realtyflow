import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Share2, Compass, Users, ChevronDown, LayoutGrid, ArrowLeft, Moon, Sun, Plus, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/authToken";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BoardsSidebarProps {
  active: "boards" | "discover" | "team" | "usage";
}

interface SidebarBoard {
  id: string;
  title: string;
  isOwner?: boolean;
}

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

type SharesByBoard = Record<string, ShareRecipient[]>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function BoardsSidebar({ active }: BoardsSidebarProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, toggle } = useBoardsTheme();
  const { toast } = useToast();
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  const NavLink = ({
    icon: Icon,
    label,
    href,
    onClick,
    isActive,
    testId,
  }: {
    icon: LucideIcon;
    label: string;
    href?: string;
    onClick?: () => void;
    isActive?: boolean;
    testId: string;
  }) => {
    const className = `w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md ${
      isActive
        ? "bg-neutral-200/80 text-neutral-900 font-medium dark:bg-neutral-800 dark:text-neutral-100"
        : "hover:bg-neutral-200/60 text-neutral-700 dark:hover:bg-neutral-800/60 dark:text-neutral-300"
    }`;
    if (href) {
      return (
        <Link href={href}>
          <a className={className} data-testid={testId}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </a>
        </Link>
      );
    }
    return (
      <button type="button" className={className} data-testid={testId} onClick={onClick}>
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </button>
    );
  };

  const boardsQuery = useQuery<SidebarBoard[]>({
    queryKey: ["/api/boards"],
    enabled: teamOpen,
  });

  const ownedBoards = useMemo(
    () => (boardsQuery.data ?? []).filter((b) => b.isOwner !== false),
    [boardsQuery.data],
  );

  const sharesQuery = useQuery<SharesByBoard>({
    queryKey: ["/api/boards", "team-shares", ownedBoards.map((b) => b.id).join(",")],
    enabled: teamOpen && ownedBoards.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        ownedBoards.map(async (b) => {
          const res = await apiRequest("GET", `/api/boards/${b.id}/shares`);
          const data = (await res.json()) as ShareRecipient[];
          return [b.id, data] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  const candidatesQuery = useQuery<ShareCandidate[]>({
    queryKey: ["/api/boards/share-candidates"],
    enabled: teamOpen,
  });

  const teamMembers = useMemo(() => {
    const byId = new Map<
      string,
      { userId: string; name: string | null; email: string | null; boardCount: number }
    >();
    const sharesByBoard = sharesQuery.data ?? {};
    for (const recipients of Object.values(sharesByBoard)) {
      for (const r of recipients) {
        const prev = byId.get(r.userId);
        if (prev) {
          prev.boardCount += 1;
        } else {
          byId.set(r.userId, {
            userId: r.userId,
            name: r.name,
            email: r.email,
            boardCount: 1,
          });
        }
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.boardCount - a.boardCount);
  }, [sharesQuery.data]);

  const normalizedSearch = normalizeEmail(teamSearch);
  const filteredCandidates = useMemo(() => {
    const q = normalizedSearch;
    return (candidatesQuery.data ?? []).filter((c) => {
      if (!q) return true;
      const hay = `${c.name ?? ""} ${c.email ?? ""} ${c.username ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [candidatesQuery.data, normalizedSearch]);

  const memberIds = useMemo(() => new Set(teamMembers.map((m) => m.userId)), [teamMembers]);
  const memberEmails = useMemo(
    () => new Set(teamMembers.map((m) => normalizeEmail(m.email ?? "")).filter(Boolean)),
    [teamMembers],
  );
  const canInviteTypedEmail =
    EMAIL_REGEX.test(normalizedSearch) &&
    !memberEmails.has(normalizedSearch) &&
    !(candidatesQuery.data ?? []).some((c) => normalizeEmail(c.email ?? "") === normalizedSearch);

  const addTeamMember = useMutation({
    mutationFn: async (payload: { userId?: string; email?: string }) => {
      if (ownedBoards.length === 0) {
        throw new Error("You don't have any owned boards to grant access to yet.");
      }
      const outcomes = await Promise.allSettled(
        ownedBoards.map((b) =>
          apiRequest("POST", `/api/boards/${b.id}/shares`, payload).then((r) => r.json()),
        ),
      );
      const successCount = outcomes.filter((o) => o.status === "fulfilled").length;
      if (successCount === 0) {
        const firstError = outcomes.find((o) => o.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(firstError?.reason?.message ?? "Failed to add team member to boards");
      }
      return { successCount, total: ownedBoards.length };
    },
    onSuccess: ({ successCount, total }) => {
      toast({
        title: "Team member added",
        description: `Granted access on ${successCount}/${total} owned board${total === 1 ? "" : "s"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", "team-shares"] });
      setTeamSearch("");
    },
    onError: (e: Error) => {
      toast({
        title: "Couldn't add team member",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    },
  });

  const removeTeamMember = useMutation({
    mutationFn: async (recipientId: string) => {
      if (ownedBoards.length === 0) {
        throw new Error("You don't have any owned boards.");
      }
      const outcomes = await Promise.allSettled(
        ownedBoards.map(async (b) => {
          const res = await fetch(`/api/boards/${b.id}/shares/${encodeURIComponent(recipientId)}`, {
            method: "DELETE",
            headers: { ...getAuthHeaders() },
          });
          // 404 means this board didn't have that recipient — treat as neutral.
          return res.ok || res.status === 404;
        }),
      );
      const successCount = outcomes.filter((o) => o.status === "fulfilled").length;
      if (successCount === 0) {
        throw new Error("Failed to remove team member from boards");
      }
      return { successCount, total: ownedBoards.length };
    },
    onSuccess: ({ successCount, total }) => {
      toast({
        title: "Team member removed",
        description: `Removed access from ${successCount}/${total} owned board${total === 1 ? "" : "s"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", "team-shares"] });
    },
    onError: (e: Error) => {
      toast({
        title: "Couldn't remove team member",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    },
  });

  const initial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase();
  const displayName = user?.name || user?.email || "Workspace";

  return (
    <aside
      className="w-[220px] flex-shrink-0 bg-white/60 backdrop-blur-sm border-r border-neutral-200/80 flex flex-col dark:bg-neutral-900/60 dark:border-neutral-800"
      data-overlay-keep
    >
      <div className="p-3">
        <button
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60"
          data-testid="button-boards-workspace"
          onClick={() => setLocation("/dashboard")}
          title="Back to dashboard"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-semibold">
            {initial}
          </div>
          <span className="font-medium flex-1 text-left truncate text-[13px] dark:text-neutral-100">{displayName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
        </button>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700 text-[13px] dark:hover:bg-neutral-800/60 dark:text-neutral-300"
          data-testid="button-back-to-app"
          onClick={() => setLocation("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to app</span>
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700 text-[13px] dark:hover:bg-neutral-800/60 dark:text-neutral-300"
          data-testid="button-shared"
          onClick={() => setLocation("/boards?tab=shared")}
        >
          <Share2 className="w-4 h-4" />
          <span>Shared with you</span>
        </button>
      </div>

      <nav className="px-3 mt-1 space-y-0.5 text-[13px]">
        <NavLink icon={LayoutGrid} label="Boards" href="/boards" isActive={active === "boards"} testId="nav-boards" />
        <NavLink icon={Compass} label="Discover" href="/boards/discover" isActive={active === "discover"} testId="nav-discover" />
        <NavLink icon={Users} label="Team" isActive={active === "team"} testId="nav-team" onClick={() => setTeamOpen(true)} />
      </nav>

      <div className="mt-auto p-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">My Golden Brick · Boards</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch Boards to light mode" : "Switch Boards to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
          data-overlay-keep
          data-testid="button-toggle-boards-theme"
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-team-access">
          <DialogHeader>
            <DialogTitle>Team Access</DialogTitle>
            <DialogDescription>
              Add members once, and they get access to all your owned boards ({ownedBoards.length}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              type="text"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              placeholder="Search teammate or enter email..."
              className="w-full px-3 py-2 text-[13px] rounded-md border border-neutral-200 outline-none focus:border-neutral-400 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              data-testid="input-team-search"
            />

            {canInviteTypedEmail && (
              <button
                type="button"
                onClick={() => addTeamMember.mutate({ email: normalizedSearch })}
                disabled={addTeamMember.isPending}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left border border-neutral-200 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800/60"
                data-testid="button-team-add-email"
              >
                <div className="min-w-0">
                  <div className="text-[13px] text-neutral-900 dark:text-neutral-100 truncate">Invite {normalizedSearch}</div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Will be granted access to all your boards when they log in with this email.</div>
                </div>
                <Plus className="w-4 h-4 text-neutral-500" />
              </button>
            )}

            <div className="max-h-40 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700">
              {(filteredCandidates.length === 0 && !canInviteTypedEmail) ? (
                <div className="px-3 py-2 text-[12px] text-neutral-500 dark:text-neutral-400">No matching teammates.</div>
              ) : (
                filteredCandidates.map((c) => {
                  const already = memberIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => !already && addTeamMember.mutate({ userId: c.id })}
                      disabled={already || addTeamMember.isPending}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-neutral-100 disabled:opacity-60 dark:hover:bg-neutral-800/60"
                      data-testid={`button-team-add-${c.id}`}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] text-neutral-900 dark:text-neutral-100 truncate">
                          {c.name || c.email || c.username || c.id}
                        </div>
                        {c.email && c.name && (
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{c.email}</div>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {already ? "Added" : "Add"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div>
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 dark:text-neutral-400">
                Team Members
              </div>
              <div className="max-h-48 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700">
                {teamMembers.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-neutral-500 dark:text-neutral-400">No team members yet.</div>
                ) : (
                  teamMembers.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-neutral-100 dark:border-neutral-800"
                      data-testid={`row-team-member-${m.userId}`}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] text-neutral-900 dark:text-neutral-100 truncate">
                          {m.name || m.email || m.userId}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          Access to {m.boardCount} board{m.boardCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTeamMember.mutate(m.userId)}
                        disabled={removeTeamMember.isPending}
                        className="ml-2 text-neutral-500 hover:text-red-600 disabled:opacity-50"
                        aria-label="Remove team member"
                        data-testid={`button-team-remove-${m.userId}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
