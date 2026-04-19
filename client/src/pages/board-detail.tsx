import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, MessageSquare, Settings as SettingsIcon, Share2, Moon, Sun } from "lucide-react";
import { AssetToolbar } from "@/components/boards/AssetToolbar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";
import { BoardCanvas, type CanvasBatch } from "@/components/boards/BoardCanvas";
import { ChatPanel, type ChatMessage, type ChatMode } from "@/components/boards/ChatPanel";
import {
  DEFAULT_SEEDANCE_OPTIONS,
  isGenerationMode,
  isProviderId,
  type GenerationMode,
  type ProviderId,
  type SeedanceOptions,
} from "@/components/boards/PlatformPicker";

interface BoardResponse {
  id: string;
  title: string;
  isShared: boolean;
  batches: CanvasBatch[];
  assets: Array<CanvasBatch["assets"][number]>;
}

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const boardId = params.id;
  const [location, setLocation] = useLocation();
  const seedParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const seed = sp.get("seed");
    if (!seed) return null;
    const providerRaw = sp.get("provider");
    const modeRaw = sp.get("mode");
    return {
      seed,
      provider: isProviderId(providerRaw) ? providerRaw : null,
      mode: isGenerationMode(modeRaw) ? modeRaw : null,
      template: sp.get("template"),
      intent: sp.get("intent"),
    };
  }, [location, boardId]);
  const seedAppliedRef = useRef<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, toggle: toggleTheme } = useBoardsTheme();

  const [chatOpen, setChatOpen] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("create");
  const [provider, setProvider] = useState<ProviderId>("luma");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("text-to-video");
  const [seedanceOptions, setSeedanceOptions] = useState<SeedanceOptions>(DEFAULT_SEEDANCE_OPTIONS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const boardQuery = useQuery<BoardResponse>({
    queryKey: ["/api/boards", boardId],
    enabled: !!boardId,
  });

  // Listen for asset status updates pushed via WebSocket
  useWebSocket({
    userId: user?.id ? String(user.id) : undefined,
    autoConnect: !!user?.id,
    showToast: false,
    onMessage: (msg) => {
      const t = msg.type;
      if (
        t === "video_generation_complete" ||
        t === "video_generation_failed" ||
        t === "photo_generated" ||
        t === "video_created" ||
        t === "status_update" ||
        t === "sora2_video_ready" ||
        t === "sjinn_video_ready"
      ) {
        queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      }
    },
  });

  const referencedAssetIds = useMemo(() => (selectedAssetId ? [selectedAssetId] : []), [selectedAssetId]);

  const sendChat = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/boards/${boardId}/chat`, {
        message: text,
        mode,
        provider,
        generationMode,
        referencedAssetIds,
        ...(provider === "seedance" ? { seedanceOptions } : {}),
      });
      return res.json();
    },
    onMutate: (text) => {
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
      const pendingMsg: ChatMessage = { id: `a-${Date.now()}`, role: "assistant", content: "", pending: true };
      setMessages((m) => [...m, userMsg, pendingMsg]);
      return { pendingId: pendingMsg.id };
    },
    onSuccess: (data, _vars, ctx) => {
      const replyRaw = data?.reply;
      const reply =
        typeof replyRaw === "string"
          ? replyRaw
          : replyRaw?.content ?? "(no reply)";
      setMessages((m) =>
        m.map((msg) => (msg.id === ctx?.pendingId ? { ...msg, content: reply, pending: false } : msg)),
      );
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
    onError: (e: Error, _vars: unknown, ctx: unknown) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === ctx?.pendingId ? { ...msg, content: `Error: ${errText}`, pending: false } : msg,
        ),
      );
      toast({ title: "Chat error", description: errText, variant: "destructive" });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/assets/${assetId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      setSelectedAssetId(null);
    },
  });

  const clearRejection = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await apiRequest("PATCH", `/api/boards/${boardId}/assets/${assetId}`, {
        status: "ready",
        rejectionReason: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
  });

  // Reset selection when board changes
  useEffect(() => {
    setSelectedAssetId(null);
  }, [boardId]);

  // Apply seed payload from URL (set by Discover templates) once per board
  useEffect(() => {
    if (!seedParams || !boardId) return;
    if (seedAppliedRef.current === boardId) return;
    seedAppliedRef.current = boardId;
    if (seedParams.provider) setProvider(seedParams.provider);
    if (seedParams.mode) setGenerationMode(seedParams.mode);
    setMode("create");
    const intentLabels: Record<string, string> = {
      "social-post": "Social Post",
      "blog-article": "Blog Article",
      image: "Image",
      video: "Video",
    };
    const sourceLabel = seedParams.intent
      ? `intent "${intentLabels[seedParams.intent] ?? seedParams.intent}"`
      : `template "${seedParams.template ?? "discover"}"`;
    setMessages((m) => [
      ...m,
      {
        id: `seed-${boardId}`,
        role: "assistant",
        content: `Seeded from ${sourceLabel}. Press send to start: "${seedParams.seed}"`,
      },
    ]);
    // Clean the seed from the URL so a refresh doesn't re-apply it
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `/boards/${boardId}`);
    }
  }, [seedParams, boardId]);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId || !boardQuery.data) return null;
    return boardQuery.data.assets.find((a) => a.id === selectedAssetId) ?? null;
  }, [selectedAssetId, boardQuery.data]);

  const themeClass = theme === "dark" ? "dark " : "";

  if (boardQuery.isLoading) {
    return (
      <div className={`${themeClass}h-screen w-full bg-neutral-200/40 dark:bg-neutral-950 flex items-center justify-center text-[13px] text-neutral-500 dark:text-neutral-400`}>
        Loading board…
      </div>
    );
  }
  if (boardQuery.isError || !boardQuery.data) {
    return (
      <div className={`${themeClass}h-screen w-full bg-neutral-200/40 dark:bg-neutral-950 flex flex-col items-center justify-center gap-3`}>
        <div className="text-[13px] text-neutral-500 dark:text-neutral-400">Board not found.</div>
        <button
          className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] dark:bg-neutral-100 dark:text-neutral-900"
          onClick={() => setLocation("/boards")}
          data-testid="button-return-boards"
        >
          Back to boards
        </button>
      </div>
    );
  }

  const board = boardQuery.data;
  const titleParts = (board.title || "Untitled board").split(" ");
  const titleHead = titleParts[0]?.toUpperCase() ?? "BOARD";
  const titleTail = titleParts.slice(1).join(" ").toUpperCase();

  return (
    <div className={`${themeClass}h-screen w-full bg-neutral-200/40 flex flex-col font-sans text-[13px] text-neutral-900 overflow-hidden dark:bg-neutral-950 dark:text-neutral-100`}>
      <header className="flex items-center justify-between px-4 py-2.5 bg-white/60 backdrop-blur border-b border-neutral-200 dark:bg-neutral-900/60 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <button
            className="w-7 h-7 rounded hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60"
            onClick={() => setLocation("/boards")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </button>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60" data-testid="button-title">
            <span className="text-[10px] font-semibold tracking-wider text-neutral-600 dark:text-neutral-300">
              {titleHead} {titleTail && <span className="text-neutral-900 dark:text-neutral-100">{titleTail}</span>}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch Boards to light mode" : "Switch Boards to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="w-8 h-8 rounded hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60"
            data-testid="button-toggle-boards-theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-neutral-300" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-600" />
            )}
          </button>
          <button className="w-8 h-8 rounded hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60" data-testid="button-settings">
            <SettingsIcon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900" data-testid="button-share">
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="relative flex-1 flex">
          <BoardCanvas
            batches={board.batches}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            onDeleteAsset={(id) => deleteAsset.mutate(id)}
            onClearRejection={(id) => clearRejection.mutate(id)}
          />
          {selectedAsset && (
            <AssetToolbar
              asset={selectedAsset}
              onClose={() => setSelectedAssetId(null)}
              onDelete={() => deleteAsset.mutate(selectedAsset.id)}
              onClearRejection={() => clearRejection.mutate(selectedAsset.id)}
              onReuseInChat={() => {
                setMode("create");
                if (!chatOpen) setChatOpen(true);
              }}
            />
          )}
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-white shadow border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              data-testid="button-open-chat"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
        </div>
        {chatOpen && (
          <ChatPanel
            boardTitle={board.title}
            messages={messages}
            mode={mode}
            onModeChange={setMode}
            provider={provider}
            onProviderChange={setProvider}
            generationMode={generationMode}
            onGenerationModeChange={setGenerationMode}
            seedanceOptions={seedanceOptions}
            onSeedanceOptionsChange={setSeedanceOptions}
            referencedAssetIds={referencedAssetIds}
            onSend={(text) => sendChat.mutate(text)}
            isSending={sendChat.isPending}
          />
        )}
      </div>
    </div>
  );
}
