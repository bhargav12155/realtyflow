import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUp, MoreVertical, Paperclip, Mic, Search, MessageSquare, FileText, Image as ImageIcon, Video } from "lucide-react";
import { BoardsSidebar } from "@/components/boards/BoardsSidebar";
import { BoardCard, NewBoardCard, type BoardSummary } from "@/components/boards/BoardCard";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";

type Tab = "all" | "shared" | "mine";

type BoardIntent = "social-post" | "blog-article" | "image" | "video";

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
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "social-post",
    label: "Social Post",
    icon: MessageSquare,
    starterPrompt: "Draft a social media post about ",
  },
  {
    id: "blog-article",
    label: "Blog Article",
    icon: FileText,
    starterPrompt: "Write a blog article about ",
  },
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    starterPrompt: "Create an image of ",
  },
  {
    id: "video",
    label: "Video",
    icon: Video,
    starterPrompt: "Create a short video of ",
    provider: "veo",
    generationMode: "text-to-video",
  },
];

export interface BoardsHomeViewProps {
  /** Called right before navigation to a newly created board, so an overlay host can close itself. */
  onBoardCreated?: (board: BoardSummary) => void;
  /** Hide the sidebar (e.g. when embedded in an overlay where chrome would feel redundant). */
  hideSidebar?: boolean;
}

export function BoardsHomeView({ onBoardCreated, hideSidebar }: BoardsHomeViewProps = {}) {
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
  }

  const createBoardMutation = useMutation({
    mutationFn: async (args: CreateBoardArgs = {}) => {
      const body: Record<string, unknown> = {};
      if (args.title) body.title = args.title;
      if (args.seedPrompt) body.seedPrompt = args.seedPrompt;
      if (args.seedIntent) body.seedIntent = args.seedIntent;
      if (args.seedProvider) body.seedProvider = args.seedProvider;
      if (args.seedGenerationMode) body.seedGenerationMode = args.seedGenerationMode;
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
      const qs = params.toString();
      setLocation(qs ? `/boards/${board.id}?${qs}` : `/boards/${board.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't create board", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const leaveBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/share/me`);
      return res.json();
    },
    onMutate: async (boardId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/boards"] });
      const previous = queryClient.getQueryData<BoardSummary[]>(["/api/boards"]);
      if (previous) {
        queryClient.setQueryData<BoardSummary[]>(
          ["/api/boards"],
          previous.filter((b) => b.id !== boardId),
        );
      }
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Left board", description: "It has been removed from your Shared tab." });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    },
    onError: (e: Error, _boardId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/boards"], context.previous);
      }
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't leave board", description: errText, variant: "destructive" });
    },
  });

  const handleQuickAction = (action: QuickAction) => {
    const seed = (prompt.trim() ? prompt.trim() : action.starterPrompt).trim();
    createBoardMutation.mutate({
      title: `${action.label}: ${seed.slice(0, 60)}`,
      seedPrompt: seed,
      seedIntent: action.id,
      seedProvider: action.provider,
      seedGenerationMode: action.generationMode,
    });
  };

  const handlePromptSubmit = () => {
    const trimmed = prompt.trim();
    createBoardMutation.mutate(trimmed ? { title: trimmed, seedPrompt: trimmed } : {});
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
        <header className="flex items-center justify-end px-6 pt-4">
          <button className="w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60" data-testid="button-more" data-overlay-keep>
            <MoreVertical className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>
        </header>

        <section className="flex flex-col items-center pt-10 pb-8">
          <h1 className="text-2xl text-neutral-900 mb-5 tracking-tight dark:text-neutral-100">What do you want to plan for social media this week?</h1>
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
            className="w-[560px] max-w-full bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-neutral-200/80 px-5 py-4 dark:bg-neutral-900 dark:border-neutral-800"
            data-overlay-keep
          >
            <input
              className="w-full bg-transparent outline-none text-[14px] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 dark:text-neutral-100"
              placeholder="Describe what you want to create..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePromptSubmit();
                }
              }}
              data-testid="input-prompt"
            />
            <div className="flex items-center justify-end gap-3 mt-6">
              <button className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100" data-testid="button-attach"><Paperclip className="w-4 h-4" /></button>
              <button className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100" data-testid="button-mic"><Mic className="w-4 h-4" /></button>
              <button
                onClick={handlePromptSubmit}
                disabled={createBoardMutation.isPending}
                className="w-7 h-7 rounded-full bg-neutral-300 hover:bg-neutral-400 disabled:opacity-50 flex items-center justify-center dark:bg-neutral-700 dark:hover:bg-neutral-600"
                data-testid="button-prompt-send"
              >
                <ArrowUp className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-200" />
              </button>
            </div>
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
