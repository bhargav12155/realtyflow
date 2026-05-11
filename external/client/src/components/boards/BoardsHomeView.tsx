import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUp, MoreVertical, Paperclip, Mic, Search, MessageSquare, FileText, Image as ImageIcon, Video, CalendarDays, Share2 } from "lucide-react";
import { BoardsSidebar } from "@/components/boards/BoardsSidebar";
import { BoardCard, NewBoardCard, type BoardSummary } from "@/components/boards/BoardCard";
import { NotificationsBell } from "@/components/boards/NotificationsBell";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";
import { useRenameBoardMutation } from "@/hooks/use-rename-board";
import { useDeleteBoardMutation } from "@/hooks/use-delete-board";
import { useLeaveBoardMutation } from "@/hooks/use-leave-board";
import heygenLogo from "@assets/image_1776641804301.png";

type Tab = "all" | "shared" | "mine";

type BoardIntent = "social-post" | "blog-article" | "image" | "video";

type SeedMode = "plan" | "build";

interface QuickAction {
  id: BoardIntent;
  label: string;
  icon: typeof MessageSquare;
  starterPrompt: string;
  // Only set provider/generationMode for intents whose values are accepted by
  // the board chat schema today (see server/routes/boards-chat.ts PROVIDERS).
  // Image intent leaves these unset so the board chat falls back to its default
  // valid provider — wiring `openai-image` here would 400 on first send.
  provider?: "veo";
  generationMode?: "text-to-video" | "image-to-video" | "video-to-video";
  // Whether the new board should land in "plan" (conversational) or "build"
  // (generation) mode. Plan mode hides the platform picker so the user has a
  // real planning conversation before any media is generated.
  seedMode: SeedMode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "social-post",
    label: "Social Post",
    icon: MessageSquare,
    starterPrompt: "Help me plan a social media post about ",
    seedMode: "plan",
  },
  {
    id: "blog-article",
    label: "Blog Article",
    icon: FileText,
    starterPrompt: "Help me plan a blog article about ",
    seedMode: "plan",
  },
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    starterPrompt: "Create an image of ",
    seedMode: "build",
  },
  {
    id: "video",
    label: "Video",
    icon: Video,
    starterPrompt: "Create a short video of ",
    provider: "veo",
    generationMode: "text-to-video",
    seedMode: "build",
  },
];

export interface BoardsHomeViewProps {
  /** Called when the view wants to be dismissed (e.g. user clicked a shortcut that navigates away). An overlay host should close itself. */
  onRequestClose?: () => void;
  /** Called right before navigation to a newly created board, so an overlay host can close itself. */
  onBoardCreated?: (board: BoardSummary) => void;
  /** Hide the sidebar (e.g. when embedded in an overlay where chrome would feel redundant). */
  hideSidebar?: boolean;
}

export function BoardsHomeView({ onBoardCreated, onRequestClose, hideSidebar }: BoardsHomeViewProps = {}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme } = useBoardsTheme();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");

  const boardsQuery = useQuery<BoardSummary[]>({
    queryKey: ["/api/boards"],
  });

  interface CreateBoardArgs {
    title?: string;
    seedPrompt?: string;
    seedIntent?: BoardIntent;
    seedProvider?: QuickAction["provider"];
    seedGenerationMode?: QuickAction["generationMode"];
    seedMode?: SeedMode;
  }

  const createBoardMutation = useMutation({
    mutationFn: async (args: CreateBoardArgs = {}) => {
      const body: Record<string, unknown> = {};
      if (args.title) body.title = args.title;
      if (args.seedPrompt) body.seedPrompt = args.seedPrompt;
      if (args.seedIntent) body.seedIntent = args.seedIntent;
      if (args.seedProvider) body.seedProvider = args.seedProvider;
      if (args.seedGenerationMode) body.seedGenerationMode = args.seedGenerationMode;
      if (args.seedMode) body.seedMode = args.seedMode;
      const res = await apiRequest("POST", "/api/boards", body);
      const board = (await res.json()) as BoardSummary;
      return { board, args };
    },
    onSuccess: ({ board, args }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      onBoardCreated?.(board);
      const params = new URLSearchParams();
      if (args.seedPrompt) params.set("seed", args.seedPrompt);
      if (args.seedProvider) params.set("provider", args.seedProvider);
      if (args.seedGenerationMode) params.set("mode", args.seedGenerationMode);
      if (args.seedIntent) params.set("intent", args.seedIntent);
      // Use a distinct query key (chatMode) to avoid colliding with the
      // existing `mode` param which carries the video generation mode.
      if (args.seedMode) params.set("chatMode", args.seedMode);
      const qs = params.toString();
      setLocation(qs ? `/boards/${board.id}?${qs}` : `/boards/${board.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't create board", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const deleteBoardMutation = useDeleteBoardMutation();

  const renameBoardMutation = useRenameBoardMutation();

  const leaveBoardMutation = useLeaveBoardMutation();

  const handleQuickAction = (action: QuickAction) => {
    const seed = (prompt.trim() ? prompt.trim() : action.starterPrompt).trim();
    createBoardMutation.mutate({
      title: `${action.label}: ${seed.slice(0, 60)}`,
      seedPrompt: seed,
      seedIntent: action.id,
      seedProvider: action.provider,
      seedGenerationMode: action.generationMode,
      seedMode: action.seedMode,
    });
  };

  const handlePromptSubmit = () => {
    const trimmed = prompt.trim();
    // Free-form prompts (no quick-action picked) land the user in Think
    // mode on the new board so the assistant opens with a planning question
    // instead of the "press send to start" build seed.
    createBoardMutation.mutate(
      trimmed ? { title: trimmed, seedPrompt: trimmed, seedMode: "plan" } : {},
    );
  };

  const filtered = useMemo(() => {
    const list = boardsQuery.data ?? [];
    return list.filter((b) => {
      // "Shared" = boards where someone else is the owner (shared with me).
      // "Mine" = boards I own. If `isOwner` is missing on legacy responses
      // we default to true so existing data still appears under Mine.
      const isOwner = b.isOwner ?? true;
      if (tab === "shared" && isOwner) return false;
      if (tab === "mine" && !isOwner) return false;
      if (search.trim() && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [boardsQuery.data, tab, search]);

  return (
    <div
      className={`${theme === "dark" ? "dark " : ""}min-h-screen bg-neutral-200/40 flex font-sans text-[13px] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100`}
      data-testid="boards-home-view"
    >
      {!hideSidebar && <BoardsSidebar active="boards" />}
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-end gap-1 px-6 pt-4">
          <NotificationsBell />
          <button className="w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60" data-testid="button-more" data-overlay-keep>
            <MoreVertical className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>
        </header>

        <section className="flex flex-col items-center pt-10 pb-8">
          <h1 className="text-2xl text-neutral-900 mb-5 tracking-tight dark:text-neutral-100">What do you want to do today?</h1>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4 w-[560px] max-w-full" data-overlay-keep>
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  disabled={createBoardMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-neutral-200 text-[12px] text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-50 transition-colors dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800/60 dark:hover:border-neutral-700"
                  data-testid={`chip-intent-${action.id}`}
                >
                  <Icon className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  {action.label}
                </button>
              );
            })}
          </div>
          <div
            className="group relative w-[560px] max-w-full rounded-[20px] border border-white/12 bg-neutral-900/90 px-4 pt-4 pb-3 backdrop-blur-md shadow-[0_8px_40px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] focus-within:border-white/22 transition-colors"
            data-overlay-keep
          >
              <div className="rounded-xl border border-black/60 bg-black/40 px-3 py-2.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.7)]">
                <textarea
                  rows={3}
                  className="w-full resize-none text-[15px] leading-6 text-neutral-100 placeholder:text-neutral-500"
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    caretColor: "#e5e5e5",
                    textShadow: "0 1px 3px rgba(0,0,0,0.95), 0 -1px 0 rgba(255,255,255,0.10)",
                  }}
                  placeholder="Describe what you want to create…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePromptSubmit();
                    }
                  }}
                  data-testid="input-prompt"
                />
              </div>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_18px_-14px_rgba(0,0,0,0.75)] transition-all hover:-translate-y-0.5 hover:text-neutral-100 hover:bg-white/[0.06]"
                  data-testid="button-attach"
                  title="Attach a file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-neutral-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_18px_-14px_rgba(0,0,0,0.75)] transition-all hover:-translate-y-0.5 hover:text-neutral-100 hover:bg-white/[0.06]"
                  data-testid="button-mic"
                  title="Voice input"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePromptSubmit}
                  disabled={createBoardMutation.isPending}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-rose-500 text-white shadow-[0_16px_28px_-16px_rgba(168,85,247,0.75)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_34px_-16px_rgba(168,85,247,0.85)] hover:brightness-110 active:translate-y-0 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-prompt-send"
                  title="Create"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
          </div>
          <div className="mt-4 flex items-start justify-center gap-6" data-overlay-keep>
            <button
              type="button"
              onClick={() => {
                onRequestClose?.();
                setLocation("/dashboard#photo-avatars");
              }}
              data-testid="link-heygen-photo-avatars"
              className="flex flex-col items-center gap-1 group focus:outline-none"
              title="Open Photo Avatars (HeyGen)"
            >
              <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-neutral-200 shadow-sm group-hover:shadow group-hover:border-neutral-300 transition dark:bg-neutral-900 dark:border-neutral-700 dark:group-hover:border-neutral-600">
                <img
                  src={heygenLogo}
                  alt="Open Photo Avatars (HeyGen)"
                  className="w-7 h-7 object-contain"
                />
              </span>
              <span className="text-[11px] text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-100">
                Photo Avatars
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRequestClose?.();
                setLocation("/calendar");
              }}
              data-testid="link-content-calendar"
              className="flex flex-col items-center gap-1 group focus:outline-none"
              title="Open Content Calendar"
            >
              <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-neutral-200 shadow-sm group-hover:shadow group-hover:border-neutral-300 transition dark:bg-neutral-900 dark:border-neutral-700 dark:group-hover:border-neutral-600">
                <CalendarDays className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
              </span>
              <span className="text-[11px] text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-100">
                Content Calendar
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRequestClose?.();
                setLocation("/dashboard#social");
              }}
              data-testid="link-quick-posts"
              className="flex flex-col items-center gap-1 group focus:outline-none"
              title="Open Quick Posts"
            >
              <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-neutral-200 shadow-sm group-hover:shadow group-hover:border-neutral-300 transition dark:bg-neutral-900 dark:border-neutral-700 dark:group-hover:border-neutral-600">
                <Share2 className="w-5 h-5 text-neutral-700 dark:text-neutral-200" />
              </span>
              <span className="text-[11px] text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-100">
                Quick Posts
              </span>
            </button>
          </div>
        </section>

        <div className="flex items-center justify-between px-6 mb-4" data-overlay-keep>
          <div className="flex items-center gap-5 text-[13px]">
            {(["all", "shared", "mine"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  tab === t
                    ? "font-medium text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }
                data-testid={`tab-${t}`}
              >
                {t === "all" ? "All" : t === "shared" ? "Shared" : "Mine"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white rounded-full border border-neutral-200 px-3 py-1.5 w-[260px] dark:bg-neutral-900 dark:border-neutral-800">
            <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
            <input
              className="bg-transparent outline-none flex-1 text-[12px] dark:text-neutral-100 dark:placeholder:text-neutral-500"
              placeholder="Search boards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex-1 px-6 pb-6 overflow-auto" data-overlay-keep>
          {boardsQuery.isLoading ? (
            <div className="grid grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-neutral-100/80 animate-pulse min-h-[220px] dark:bg-neutral-900/60" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              <NewBoardCard onClick={() => createBoardMutation.mutate({})} />
              {filtered.map((b) => (
                <BoardCard
                  key={b.id}
                  board={b}
                  onLeave={(board) => leaveBoardMutation.mutate(board.id)}
                  isLeaving={leaveBoardMutation.isPending && leaveBoardMutation.variables === b.id}
                  onDelete={(board) => deleteBoardMutation.mutate(board.id)}
                  isDeleting={deleteBoardMutation.isPending && deleteBoardMutation.variables === b.id}
                  onRename={(board, newTitle) => renameBoardMutation.mutate({ boardId: board.id, title: newTitle })}
                  isRenaming={renameBoardMutation.isPending && renameBoardMutation.variables?.boardId === b.id}
                />
              ))}
              {filtered.length === 0 && (boardsQuery.data?.length ?? 0) > 0 && (
                <div className="col-span-4 flex items-center text-[12px] text-neutral-400 px-4 dark:text-neutral-500">
                  No boards match your search.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
