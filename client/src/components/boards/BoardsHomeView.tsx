import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUp,
  CalendarDays,
  FileAudio,
  FileText,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Target,
  Video,
  X,
  Zap,
} from "lucide-react";
import { BoardsSidebar } from "@/components/boards/BoardsSidebar";
import { BoardCard, NewBoardCard, type BoardSummary } from "@/components/boards/BoardCard";
import { NotificationsBell } from "@/components/boards/NotificationsBell";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";
import { useRenameBoardMutation } from "@/hooks/use-rename-board";
import { useDeleteBoardMutation } from "@/hooks/use-delete-board";
import { useLeaveBoardMutation } from "@/hooks/use-leave-board";
import { useAuth } from "@/hooks/useAuth";
import { uploadFileToBoard } from "@/lib/boardUpload";
import { RecordModal } from "@/components/boards/RecordModal";

type Tab = "all" | "shared" | "mine";
type SortKey = "recently-edited" | "recently-created" | "alphabetical" | "most-opened";

type BoardIntent = "social-post" | "blog-article" | "image" | "video";

type SeedMode = "plan" | "build";
type PromptIntent = "social" | "blog" | "image" | "video";

interface QuickAction {
  id: BoardIntent;
  label: string;
  icon: typeof MessageSquare;
  starterPrompt: string;
  // Only set provider/generationMode for intents whose values are accepted by
  // the board chat schema today (see server/routes/boards-chat.ts PROVIDERS).
  // Image intent leaves these unset so the board chat falls back to its default
  // valid provider — wiring `openai-image` here would 400 on first send.
  provider?: "veo" | "gemini-image";
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
    seedMode: "plan",
  },
  {
    id: "video",
    label: "Video",
    icon: Video,
    // Video is a guided, image-first flow: we first generate image options,
    // then the user selects one and animates it into a video with Luma/VEO.
    // So the Video intent seeds an IMAGE generation (gemini-image) — not a
    // direct text-to-video call, which previously jumped straight to VEO.
    starterPrompt: "Generate 3 image options for a video scene of ",
    provider: "gemini-image",
    seedMode: "plan",
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
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme } = useBoardsTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recently-edited");
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [recordOpen, setRecordOpen] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  const composerTextMinHeight = isMobileViewport ? 78 : 92;
  const composerChromeHeight = isMobileViewport ? 88 : 96;
  const composerMinHeight = composerTextMinHeight + composerChromeHeight;
  const composerMaxHeight = isMobileViewport ? 500 : 590;
  const [composerHeight, setComposerHeight] = useState(
    typeof window !== "undefined" && window.innerWidth < 640 ? 166 : 188,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsMobileViewport(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setComposerHeight((prev) => Math.min(composerMaxHeight, Math.max(composerMinHeight, prev)));
  }, [composerMinHeight, composerMaxHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "shared" || tabParam === "mine" || tabParam === "all") {
      setTab(tabParam);
      // Clean the URL so copy/paste of the page stays canonical after initial load.
      const cleaned = location.split("?")[0] || "/boards";
      if (cleaned !== location) setLocation(cleaned);
    }
  }, [location, setLocation]);

  const boardsQuery = useQuery<BoardSummary[]>({
    queryKey: ["/api/boards"],
    enabled: !isAuthLoading && !!user,
  });

  interface CreateBoardArgs {
    title?: string;
    seedPrompt?: string;
    seedIntent?: BoardIntent;
    seedProvider?: QuickAction["provider"];
    seedGenerationMode?: QuickAction["generationMode"];
    seedMode?: SeedMode;
    files?: File[];
  }

  const MAX_BOARD_TITLE_LENGTH = 200;

  const toBoardTitle = (title?: string, seedPrompt?: string) => {
    const base = (title?.trim() || seedPrompt?.trim() || "New board").replace(/\s+/g, " ").trim();
    if (base.length <= MAX_BOARD_TITLE_LENGTH) return base;
    return `${base.slice(0, MAX_BOARD_TITLE_LENGTH - 1).trimEnd()}…`;
  };

  const createBoardMutation = useMutation({
    mutationFn: async (args: CreateBoardArgs = {}) => {
      const body: Record<string, unknown> = {};
      if (args.title || args.seedPrompt) body.title = toBoardTitle(args.title, args.seedPrompt);
      if (args.seedPrompt) body.seedPrompt = args.seedPrompt;
      if (args.seedIntent) body.seedIntent = args.seedIntent;
      if (args.seedProvider) body.seedProvider = args.seedProvider;
      if (args.seedGenerationMode) body.seedGenerationMode = args.seedGenerationMode;
      if (args.seedMode) body.seedMode = args.seedMode;
      const res = await apiRequest("POST", "/api/boards", body);
      const board = (await res.json()) as BoardSummary;
      return { board, args };
    },
    onMutate: () => {
      setIsCreatingBoard(true);
    },
    onSuccess: async ({ board, args }) => {
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
      const uploadedAssetIds: string[] = [];
      for (const file of args.files ?? []) {
        try {
          const result = await uploadFileToBoard(board.id, file);
          if (result) uploadedAssetIds.push(result.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          toast({ title: `Couldn't attach ${file.name}`, description: message, variant: "destructive" });
        }
      }
      if (uploadedAssetIds.length > 0) {
        params.set("refs", uploadedAssetIds.join(","));
        queryClient.invalidateQueries({ queryKey: ["/api/boards", board.id] });
      }
      setSelectedFiles([]);
      const qs = params.toString();
      setLocation(qs ? `/boards/${board.id}?${qs}` : `/boards/${board.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't create board", description: e?.message ?? String(e), variant: "destructive" });
    },
    onSettled: () => {
      setIsCreatingBoard(false);
    },
  });

  const deleteBoardMutation = useDeleteBoardMutation();

  const renameBoardMutation = useRenameBoardMutation();

  const leaveBoardMutation = useLeaveBoardMutation();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const userFirstName = useMemo(() => {
    const rawName =
      (user as { name?: string; username?: string; email?: string } | null)
        ?.name ||
      (user as { name?: string; username?: string; email?: string } | null)
        ?.username ||
      (user as { name?: string; username?: string; email?: string } | null)
        ?.email ||
      "there";
    const withoutDomain = rawName.includes("@")
      ? rawName.split("@")[0]
      : rawName;
    return withoutDomain.split(" ")[0] || "there";
  }, [user]);

  const handleQuickAction = (action: QuickAction) => {
    if (action.id === "social-post" || action.id === "blog-article") {
      onRequestClose?.();
      const typeParam = action.id === "social-post" ? "social" : "blog";
      setLocation(`/dashboard?type=${typeParam}#ai-content`);
      return;
    }

    const seed = (prompt.trim() ? prompt.trim() : action.starterPrompt).trim();
    createBoardMutation.mutate({
      title: `${action.label}: ${seed.slice(0, 60)}`,
      seedPrompt: seed,
      seedIntent: action.id,
      seedProvider: action.provider,
      seedGenerationMode: action.generationMode,
      seedMode: action.seedMode,
      files: selectedFiles,
    });
  };

  const quickActionCards: Array<{
    id: string;
    title: string;
    description: string;
    cta: string;
    icon: typeof Megaphone;
    onClick: () => void;
    iconTone: string;
    surfaceTone: string;
    hoverTone: string;
  }> = [
    {
      id: "social-post",
      title: "Social Post",
      description: "Create engaging posts for Instagram, LinkedIn, and X.",
      cta: "Create",
      icon: Megaphone,
      onClick: () => handleQuickAction(QUICK_ACTIONS[0]),
      iconTone: "from-violet-500 to-fuchsia-500",
      surfaceTone: "bg-violet-50/70 dark:bg-violet-950/20",
      hoverTone: "hover:bg-violet-50 dark:hover:bg-violet-950/30",
    },
    {
      id: "blog-article",
      title: "Blog Article",
      description: "Draft a clear, structured article your audience will read.",
      cta: "Write",
      icon: FileText,
      onClick: () => handleQuickAction(QUICK_ACTIONS[1]),
      iconTone: "from-indigo-500 to-blue-500",
      surfaceTone: "bg-sky-50/75 dark:bg-sky-950/20",
      hoverTone: "hover:bg-sky-50 dark:hover:bg-sky-950/30",
    },
    {
      id: "image",
      title: "Image",
      description: "Generate polished visuals for posts, ads, and campaigns.",
      cta: "Generate",
      icon: ImageIcon,
      onClick: () => handleQuickAction(QUICK_ACTIONS[2]),
      iconTone: "from-pink-500 to-rose-500",
      surfaceTone: "bg-pink-50/75 dark:bg-pink-950/20",
      hoverTone: "hover:bg-pink-50 dark:hover:bg-pink-950/30",
    },
    {
      id: "video",
      title: "Video",
      description: "Turn an idea into storyboard-ready scenes and motion.",
      cta: "Produce",
      icon: Video,
      onClick: () => handleQuickAction(QUICK_ACTIONS[3]),
      iconTone: "from-orange-500 to-amber-500",
      surfaceTone: "bg-orange-50/75 dark:bg-orange-950/20",
      hoverTone: "hover:bg-orange-50 dark:hover:bg-orange-950/30",
    },
    {
      id: "campaign",
      title: "Campaign",
      description: "Plan timelines, channels, and launch steps in one place.",
      cta: "Plan",
      icon: Target,
      onClick: () => {
        onRequestClose?.();
        setLocation("/calendar");
      },
      iconTone: "from-sky-500 to-cyan-500",
      surfaceTone: "bg-teal-50/75 dark:bg-teal-950/20",
      hoverTone: "hover:bg-teal-50 dark:hover:bg-teal-950/30",
    },
  ];

  const detectPromptIntent = (value: string): PromptIntent | null => {
    const normalized = value.toLowerCase();
    if (!normalized.trim()) return null;

    if (/(video|reel|motion|animate|animation|storyboard|tiktok)/.test(normalized)) {
      return "video";
    }
    if (/(blog|article|write-up|newsletter|long form|long-form)/.test(normalized)) {
      return "blog";
    }
    if (/(social|instagram|linkedin|facebook|x post|caption|tweet|thread)/.test(normalized)) {
      return "social";
    }
    if (/(image|img|picture|photo|visual|graphic|poster|thumbnail|creative)/.test(normalized)) {
      return "image";
    }

    return null;
  };

  const navigateToPromptDestination = (intent: PromptIntent, promptText: string) => {
    const encodedPrompt = encodeURIComponent(promptText.trim());

    if (intent === "video") {
      onRequestClose?.();
      setLocation(`/dashboard?prompt=${encodedPrompt}#video-generation`);
      return;
    }

    if (intent === "image") {
      createBoardMutation.mutate({
        title: promptText.trim(),
        seedPrompt: promptText.trim(),
        seedIntent: "image",
        seedMode: "plan",
        files: selectedFiles,
      });
      return;
    }

    const contentType = intent === "blog" ? "blog" : "social";
    onRequestClose?.();
    setLocation(`/dashboard?type=${contentType}&prompt=${encodedPrompt}#ai-content`);
  };

  const handlePromptSubmit = () => {
    const trimmed = prompt.trim();
    const intent = trimmed ? detectPromptIntent(trimmed) : null;

    if (intent) {
      navigateToPromptDestination(intent, trimmed);
      return;
    }

    // Free-form prompts that do not clearly match a dashboard workspace
    // still create a new board in Think mode, preserving the current flow.
    createBoardMutation.mutate(
      trimmed
        ? { title: trimmed, seedPrompt: trimmed, seedMode: "plan", files: selectedFiles }
        : { files: selectedFiles },
    );
  };

  const addSelectedFiles = (files: File[]) => {
    const supported = files.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/"),
    );
    if (supported.length !== files.length) {
      toast({
        title: "Unsupported file skipped",
        description: "Use images, videos, or audio files here.",
      });
    }
    if (supported.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...supported].slice(0, 8));
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;

    if (prompt.length === 0) {
      textarea.style.height = `${composerTextMinHeight}px`;
      textarea.style.overflowY = "hidden";
      textarea.scrollTop = 0;
      setComposerHeight(composerMinHeight);
      return;
    }

    textarea.style.height = "0px";
    const textScrollHeight = textarea.scrollHeight;
    const maxTextHeight = composerMaxHeight - composerChromeHeight;
    const nextTextHeight = Math.min(
      maxTextHeight,
      Math.max(composerTextMinHeight, textScrollHeight),
    );
    const nextComposerHeight = Math.min(
      composerMaxHeight,
      Math.max(composerMinHeight, nextTextHeight + composerChromeHeight),
    );

    textarea.style.height = `${nextTextHeight}px`;
    const shouldScrollInside = textScrollHeight > maxTextHeight;
    textarea.style.overflowY = shouldScrollInside ? "auto" : "hidden";

    setComposerHeight(nextComposerHeight);
  }, [prompt, composerMaxHeight, composerChromeHeight, composerTextMinHeight, composerMinHeight]);

  const composerGrowth = Math.max(0, composerHeight - composerMinHeight);
  const composerUpwardShift = Math.round(composerGrowth * 0.8);

  const boardCounts = useMemo(() => {
    const list = boardsQuery.data ?? [];
    return {
      all: list.length,
      mine: list.filter((b) => (b.isOwner ?? true) === true).length,
      shared: list.filter((b) => (b.isOwner ?? true) === false).length,
    };
  }, [boardsQuery.data]);
  const boardsLoaded = boardsQuery.isSuccess;

  const visibleBoards = useMemo(() => {
    const list = boardsQuery.data ?? [];
    const filtered = list.filter((b) => {
      // "Shared" = boards where someone else is the owner (shared with me).
      // "Mine" = boards I own. If `isOwner` is missing on legacy responses
      // we default to true so existing data still appears under Mine.
      const isOwner = b.isOwner ?? true;
      if (tab === "shared" && isOwner) return false;
      if (tab === "mine" && !isOwner) return false;
      if (search.trim() && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const updatedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const updatedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      const createdA = new Date((a as { createdAt?: string | Date }).createdAt ?? 0).getTime();
      const createdB = new Date((b as { createdAt?: string | Date }).createdAt ?? 0).getTime();
      const openedA = Number((a as { openCount?: number }).openCount ?? 0);
      const openedB = Number((b as { openCount?: number }).openCount ?? 0);

      if (sortBy === "alphabetical") {
        return (a.title || "Untitled board").localeCompare(b.title || "Untitled board");
      }
      if (sortBy === "recently-created") {
        return createdB - createdA;
      }
      if (sortBy === "most-opened") {
        if (openedA !== openedB) return openedB - openedA;
        return updatedB - updatedA;
      }
      return updatedB - updatedA;
    });

    return sorted;
  }, [boardsQuery.data, tab, search, sortBy]);

  return (
    <div
      className={`${theme === "dark" ? "dark " : ""}min-h-screen bg-neutral-200/40 flex font-sans text-[13px] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100`}
      data-testid="boards-home-view"
    >
      {!hideSidebar && <BoardsSidebar active="boards" />}
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-end gap-1 px-6 pt-3">
          <NotificationsBell />
          <button className="w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60" data-testid="button-more" data-overlay-keep>
            <MoreVertical className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>
        </header>

        <section className="flex flex-col items-center pt-2 pb-4">
          <div className="relative w-full max-w-[1120px] px-4 sm:px-6" data-overlay-keep>
            <div className="pointer-events-none absolute inset-x-0 -top-2 h-[500px] overflow-hidden rounded-[40px]">
              <div className="absolute left-[7%] top-10 h-72 w-72 rounded-full bg-violet-400/8 blur-[120px]" />
              <div className="absolute right-[10%] top-12 h-64 w-64 rounded-full bg-orange-300/8 blur-[120px]" />
              <div className="absolute left-[36%] top-44 h-72 w-72 rounded-full bg-pink-300/7 blur-[130px]" />
              <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_20%_0%,rgba(139,92,246,0.05)_0%,rgba(255,255,255,0)_65%),radial-gradient(90%_80%_at_90%_12%,rgba(251,146,60,0.05)_0%,rgba(255,255,255,0)_65%),radial-gradient(80%_80%_at_55%_82%,rgba(244,114,182,0.045)_0%,rgba(255,255,255,0)_70%)] dark:bg-[radial-gradient(90%_90%_at_20%_0%,rgba(167,139,250,0.1)_0%,rgba(10,10,10,0)_65%),radial-gradient(90%_80%_at_90%_12%,rgba(251,191,36,0.08)_0%,rgba(10,10,10,0)_65%),radial-gradient(80%_80%_at_55%_82%,rgba(244,114,182,0.08)_0%,rgba(10,10,10,0)_70%)]" />
            </div>

            <div className="relative rounded-[28px] border border-white/60 bg-white/78 px-6 py-5 shadow-[0_2px_6px_rgba(15,23,42,0.04),0_18px_42px_rgba(79,70,229,0.08)] backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/72 sm:px-10 sm:py-6 lg:px-14 lg:py-7">
              <div className="pointer-events-none absolute right-8 top-6 hidden xl:block" aria-hidden="true">
                <div className="relative h-28 w-36 opacity-65 blur-[0.2px]">
                  <div className="absolute right-0 top-0 flex h-16 w-24 items-center justify-center rounded-2xl border border-white/50 bg-white/70 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/55">
                    <Sparkles className="h-5 w-5 text-violet-400/80" />
                  </div>
                  <div className="absolute left-2 top-11 flex h-14 w-20 items-center justify-center rounded-xl border border-white/45 bg-white/65 shadow-[0_10px_20px_rgba(15,23,42,0.07)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/50">
                    <ImageIcon className="h-4 w-4 text-pink-400/75" />
                  </div>
                  <div className="absolute bottom-0 right-8 flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/70 shadow-[0_8px_18px_rgba(15,23,42,0.08)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/50">
                    <Video className="h-3.5 w-3.5 text-orange-400/80" />
                  </div>
                </div>
              </div>

              <p className="text-[18px] font-medium tracking-wide text-neutral-500 dark:text-neutral-400">
                {greeting},
              </p>
              <p className="mt-0.5 text-[19px] font-semibold tracking-tight text-neutral-800 dark:text-neutral-100">
                {userFirstName} <span aria-hidden="true">👋</span>
              </p>
              <h1 className="mt-2 max-w-4xl text-[32px] font-bold leading-[1.12] tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-[38px] lg:text-[42px]">
                What would you like to create today?
              </h1>
              <p className="mt-2 max-w-3xl text-[17px] font-normal leading-[1.5] text-neutral-600 dark:text-neutral-300">
                Start with a simple idea. Our AI will take care of the rest.
              </p>
              <div
                className="mt-5 flex w-full flex-col overflow-hidden rounded-[24px] border border-neutral-300/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_14px_32px_rgba(15,23,42,0.1)] transition-[height,transform,margin,box-shadow,border-color] duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_20px_40px_rgba(15,23,42,0.12)] focus-within:border-violet-300 focus-within:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_20px_42px_rgba(99,102,241,0.14)] dark:border-neutral-700/90 dark:bg-neutral-900"
                style={{
                  height: `${composerHeight}px`,
                  transform: `translateY(-${composerUpwardShift}px)`,
                  marginBottom: `-${composerUpwardShift}px`,
                }}
                data-overlay-keep
              >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              data-testid="input-prompt-attachments"
              onChange={(e) => {
                addSelectedFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <div className="relative flex-1 overflow-hidden px-5 pt-4 sm:px-6 sm:pt-5">
              <textarea
                ref={promptRef}
                className="relative z-[1] block w-full resize-none border-0 bg-transparent p-0 text-[16px] leading-[1.7] tracking-[0.01em] text-neutral-900 shadow-none outline-none ring-0 transition-[height] duration-200 ease-out placeholder:text-neutral-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                placeholder="Describe what you want to create..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePromptSubmit();
                  }
                }}
                data-testid="input-prompt"
                aria-label="Prompt composer"
              />
            </div>
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pb-2" data-testid="row-prompt-attachments">
                {selectedFiles.map((file, index) => {
                  const isImage = file.type.startsWith("image/");
                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className="inline-flex max-w-[180px] items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                      data-testid={`chip-prompt-attachment-${index}`}
                    >
                      {isImage ? <ImageIcon className="h-3.5 w-3.5" /> : file.type.startsWith("audio/") ? <FileAudio className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                        data-testid={`button-remove-prompt-attachment-${index}`}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-200/80 bg-neutral-50/75 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-950/40">
              {isCreatingBoard ? (
                <div className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400" data-testid="text-creating-board">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating board and uploading attachments...
                </div>
              ) : (
                <div className="inline-flex items-center gap-2.5 text-[12px]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCreatingBoard}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-neutral-600 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                    data-testid="button-add-media-inline"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <Plus className="h-3 w-3" />
                    </span>
                    <span className="font-medium">Add media</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordOpen(true)}
                    disabled={isCreatingBoard}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-neutral-600 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                    data-testid="button-record-inline"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <Mic className="h-3 w-3" />
                    </span>
                    <span className="font-medium">Record a note</span>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCreatingBoard}
                className="h-9 w-9 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                data-testid="button-attach"
                aria-label="Attach images, videos, or audio"
                title="Attach images, videos, or audio"
              >
                <Paperclip className="mx-auto h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setRecordOpen(true)}
                disabled={isCreatingBoard}
                className="h-9 w-9 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                data-testid="button-mic"
                aria-label="Record voice-over"
                title="Record voice-over"
              >
                <Mic className="mx-auto h-4.5 w-4.5" />
              </button>
              <button
                onClick={handlePromptSubmit}
                disabled={isCreatingBoard}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white transition-transform duration-200 hover:scale-[1.03] hover:bg-neutral-700 active:scale-[0.97] disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                data-testid="button-prompt-send"
                aria-label="Create board"
              >
                {isCreatingBoard ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
              </div>
            </div>
          </div>

              <div className="mt-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="inline-flex items-center gap-2 text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Quick Actions
                    </h2>
                    <p className="mt-1 text-[13px] leading-5 text-neutral-500 dark:text-neutral-400">
                      Choose a starting point or simply describe your idea above.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2" data-overlay-keep>
                    <button
                      type="button"
                      onClick={() => {
                        onRequestClose?.();
                        setLocation("/dashboard#photo-avatars");
                      }}
                      data-testid="link-heygen-photo-avatars"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50/70 px-3 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/50"
                      title="Open Photo Avatars (HeyGen)"
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-semibold text-white">HG</span>
                      Photo Avatars
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRequestClose?.();
                        setLocation("/calendar");
                      }}
                      data-testid="link-content-calendar"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                      title="Open Content Calendar"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      Content Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRequestClose?.();
                        setLocation("/dashboard#social");
                      }}
                      data-testid="link-quick-posts"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                      title="Open Quick Posts"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Quick Posts
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {quickActionCards.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={action.onClick}
                        disabled={isCreatingBoard}
                        className={`group rounded-[20px] border border-neutral-200/80 p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 ease-out hover:-translate-y-1.5 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_14px_28px_rgba(15,23,42,0.1)] hover:border-neutral-300/90 disabled:opacity-50 dark:border-neutral-800 dark:hover:border-neutral-700 ${action.surfaceTone} ${action.hoverTone}`}
                        data-testid={`card-intent-${action.id}`}
                      >
                        <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${action.iconTone} text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out group-hover:scale-[1.06]`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex items-start justify-between gap-2.5">
                          <div>
                            <p className="text-[14px] font-semibold leading-5 text-neutral-900 dark:text-neutral-100">{action.title}</p>
                            <p className="mt-1 text-[12px] leading-5 text-neutral-600 dark:text-neutral-300">{action.description}</p>
                            <p className="mt-2 inline-flex items-center text-[12px] font-medium text-neutral-700 transition-colors duration-200 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-neutral-100">
                              {action.cta}
                            </p>
                          </div>
                          <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-400 transition-all duration-200 ease-out group-hover:translate-x-1 group-hover:text-violet-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-6" data-overlay-keep>
          <div className="rounded-[24px] border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_16px_34px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-[24px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100" data-testid="text-boards-section-title">
                  Boards{boardsLoaded ? ` (${boardCounts.all})` : ""}
                </h2>
                <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
                  Browse, search, and open your active AI projects.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1 shadow-inner dark:border-neutral-700 dark:bg-neutral-800/60" role="tablist" aria-label="Board filters">
                  {([
                    { key: "all", label: boardsLoaded ? `All (${boardCounts.all})` : "All" },
                    { key: "mine", label: boardsLoaded ? `Mine (${boardCounts.mine})` : "Mine" },
                    { key: "shared", label: boardsLoaded ? `Shared (${boardCounts.shared})` : "Shared" },
                  ] as Array<{ key: Tab; label: string }>).map((item) => {
                    const active = tab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setTab(item.key)}
                        role="tab"
                        aria-selected={active}
                        className={`h-10 min-w-[92px] rounded-full px-4 text-[13px] font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          active
                            ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                        }`}
                        data-testid={`tab-${item.key}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex h-11 w-[340px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 transition-all duration-200 ease-out hover:border-neutral-300 focus-within:w-[352px] focus-within:border-blue-300 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:focus-within:border-blue-500" data-testid="search-boards-shell">
                  <Search className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                  <input
                    className="flex-1 bg-transparent text-[13px] text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                    placeholder="Search boards..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-search"
                    aria-label="Search boards"
                  />
                </div>

                <div className="relative h-11 min-w-[190px]">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="h-full w-full appearance-none rounded-xl border border-neutral-200 bg-white pl-9 pr-8 text-[13px] font-medium text-neutral-700 outline-none transition-all duration-200 ease-out hover:border-neutral-300 focus:border-blue-300 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                    data-testid="select-sort-boards"
                    aria-label="Sort boards"
                  >
                    <option value="recently-edited">Recently Edited</option>
                    <option value="recently-created">Recently Created</option>
                    <option value="alphabetical">Alphabetical</option>
                    <option value="most-opened">Most Opened</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">▼</span>
                </div>
              </div>
            </div>

            {boardsQuery.isLoading || isAuthLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="min-h-[292px] animate-pulse rounded-2xl border border-neutral-200/80 bg-neutral-100/80 dark:border-neutral-800 dark:bg-neutral-900/60" />
                ))}
              </div>
            ) : boardsQuery.isError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                <p className="font-medium" data-testid="text-boards-history-error-title">
                  Board history is unavailable right now.
                </p>
                <p className="mt-1 text-xs opacity-90" data-testid="text-boards-history-error-detail">
                  {String((boardsQuery.error as Error)?.message ?? "Failed to load boards.").includes("401")
                    ? "Your session may have expired. Please log in again, then retry."
                    : "We couldn't load your boards from the server. Please retry."}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => boardsQuery.refetch()}
                    className="inline-flex items-center rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/40"
                    data-testid="button-retry-boards-history"
                  >
                    Retry
                  </button>
                  {String((boardsQuery.error as Error)?.message ?? "").includes("401") && (
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      data-testid="button-login-boards-history"
                    >
                      Go to Login
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                  <NewBoardCard onClick={() => createBoardMutation.mutate({})} />
                  {visibleBoards.map((b) => (
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
                </div>
                {visibleBoards.length === 0 && (boardsQuery.data?.length ?? 0) > 0 && (
                  <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                    No boards match your current filter or search.
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <RecordModal
        open={recordOpen}
        onCancel={() => setRecordOpen(false)}
        onSave={(file) => {
          addSelectedFiles([file]);
          setRecordOpen(false);
        }}
      />
    </div>
  );
}
