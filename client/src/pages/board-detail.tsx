import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, LogOut, MessageSquare, Settings as SettingsIcon, Share2, Moon, Sun } from "lucide-react";
import { AssetToolbar } from "@/components/boards/AssetToolbar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";
import { BoardCanvas, type CanvasBatch, type ReEvalModel } from "@/components/boards/BoardCanvas";
import {
  BoardBottomToolbar,
  type BoardBottomToolbarHandle,
} from "@/components/boards/BoardBottomToolbar";
import { uploadFilesToBoard, uploadFileToBoard } from "@/lib/boardUpload";
import { DrawingModal } from "@/components/boards/DrawingModal";
import { RecordModal } from "@/components/boards/RecordModal";
import { ChatPanel, type ChatMessage, type ChatMode, type ChatModelId } from "@/components/boards/ChatPanel";
import { detectCreateSelfAvatarIntent } from "@shared/avatarIntent";
import { ShareBoardDialog } from "@/components/boards/ShareBoardDialog";
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
  isOwner?: boolean;
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
    const chatModeRaw = sp.get("chatMode");
    const chatMode: "plan" | "build" | null =
      chatModeRaw === "plan" || chatModeRaw === "build" ? chatModeRaw : null;
    // Even with no `seed`, a `chatMode=plan|build` should still drive the
    // initial mode (e.g. opening a board from a plan-mode handoff link).
    if (!seed && !chatMode) return null;
    const providerRaw = sp.get("provider");
    const modeRaw = sp.get("mode");
    return {
      seed: seed ?? null,
      provider: isProviderId(providerRaw) ? providerRaw : null,
      mode: isGenerationMode(modeRaw) ? modeRaw : null,
      template: sp.get("template"),
      intent: sp.get("intent"),
      chatMode,
    };
  }, [location, boardId]);
  const seedAppliedRef = useRef<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, toggle: toggleTheme } = useBoardsTheme();

  const [chatOpen, setChatOpen] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("create");
  const [provider, setProvider] = useState<ProviderId>("luma");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("text-to-video");
  const [seedanceOptions, setSeedanceOptions] = useState<SeedanceOptions>(DEFAULT_SEEDANCE_OPTIONS);
  const [chatModel, setChatModel] = useState<ChatModelId>("claude");
  const [chatModelManuallyPicked, setChatModelManuallyPicked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingInput, setPendingInput] = useState<string | null>(null);
  // Hydrate the chat panel from the server exactly once per board so the
  // user's prior conversation is restored on reload/navigation. We never
  // re-overwrite local state after the first hydration — the chat handler
  // continues to be the source of truth for new turns within the session.
  const hydratedBoardRef = useRef<string | null>(null);

  const boardQuery = useQuery<BoardResponse>({
    queryKey: ["/api/boards", boardId],
    enabled: !!boardId,
  });

  type PersistedBoardMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    notice: string | null;
    cta: { label: string; href: string; testId?: string } | null;
    createdAt: string | null;
  };
  const messagesQuery = useQuery<{ messages: PersistedBoardMessage[] }>({
    queryKey: ["/api/boards", boardId, "messages"],
    enabled: !!boardId,
  });

  useEffect(() => {
    if (!boardId) return;
    if (hydratedBoardRef.current === boardId) return;
    const data = messagesQuery.data;
    if (!data || !Array.isArray(data.messages)) return;
    const restored: ChatMessage[] = data.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.notice ? `_${m.notice}_\n\n${m.content}` : m.content,
      cta: m.cta ?? undefined,
    }));
    // Don't clobber an in-flight conversation. If the user already started
    // typing/sending before the history finished loading, we keep the live
    // session and treat hydration as "missed this round" — they can refresh
    // to get the merged view next time. This is the safer trade-off:
    // overwriting would drop the optimistic message AND the pendingId the
    // chat mutation needs to swap in the assistant reply.
    setMessages((current) => (current.length > 0 ? current : restored));
    hydratedBoardRef.current = boardId;
  }, [boardId, messagesQuery.data]);

  // Reset hydration when navigating between boards so the next board hydrates
  // from its own history rather than reusing the previous one.
  useEffect(() => {
    if (hydratedBoardRef.current && hydratedBoardRef.current !== boardId) {
      hydratedBoardRef.current = null;
      setMessages([]);
    }
  }, [boardId]);

  // Ask the server which chat providers actually have a working API key, so
  // we don't default Think mode onto a provider that's known to 401 every
  // request. The user can still switch to any provider manually — we only
  // override the default when they haven't picked one yet.
  const chatHealthQuery = useQuery<{
    healthy: ChatModelId[];
    unhealthy: ChatModelId[];
    default: ChatModelId | null;
  }>({
    queryKey: ["/api/boards/chat/health"],
    staleTime: 60_000,
  });

  useEffect(() => {
    if (chatModelManuallyPicked) return;
    const data = chatHealthQuery.data;
    if (!data) return;
    if (data.default && data.default !== chatModel) {
      setChatModel(data.default);
    }
  }, [chatHealthQuery.data, chatModelManuallyPicked, chatModel]);

  const handleChatModelChange = (m: ChatModelId) => {
    setChatModelManuallyPicked(true);
    setChatModel(m);
  };

  // Listen for asset status updates pushed via WebSocket
  useWebSocket({
    userId: user?.id ? String(user.id) : undefined,
    autoConnect: !!user?.id,
    showToast: false,
    onMessage: (msg) => {
      const t = msg.type;
      if (t === "board_asset_status") {
        const d = msg.data as {
          boardId: string;
          batchId: string;
          assetId: string;
          status: string;
          assetUrl?: string | null;
          thumbnailUrl?: string | null;
          durationSeconds?: number | null;
          modelLabel?: string | null;
          rejectionReason?: string | null;
        };
        if (d.boardId !== boardId) return;
        queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) => {
          if (!prev) return prev;
          const patchAsset = <T extends { id: string }>(a: T): T => {
            if (a.id !== d.assetId) return a;
            return {
              ...a,
              status: d.status,
              ...(d.assetUrl !== undefined ? { assetUrl: d.assetUrl } : {}),
              ...(d.thumbnailUrl !== undefined ? { thumbnailUrl: d.thumbnailUrl } : {}),
              ...(d.durationSeconds !== undefined ? { durationSeconds: d.durationSeconds } : {}),
              ...(d.modelLabel !== undefined ? { modelLabel: d.modelLabel } : {}),
              ...(d.rejectionReason !== undefined ? { rejectionReason: d.rejectionReason } : {}),
            };
          };
          return {
            ...prev,
            batches: prev.batches.map((b) => ({ ...b, assets: b.assets.map(patchAsset) })),
            assets: prev.assets.map(patchAsset),
          };
        });
        return;
      }
      if (t === "board_auto_eval") {
        const d = msg.data as {
          boardId: string;
          batchId: string;
          winnerAssetId: string;
          rejected: Array<{ assetId: string; reason: string }>;
          modelUsed: string;
        };
        if (d.boardId !== boardId) return;
        const lines = [
          `Auto-eval picked a winner (${d.modelUsed}).`,
          ...d.rejected.map((r) => `• Rejected ${r.assetId.slice(0, 8)}: ${r.reason}`),
        ];
        setMessages((m) => [
          ...m,
          {
            id: `eval-${d.batchId}`,
            role: "assistant",
            content: lines.join("\n"),
          },
        ]);
        queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
        return;
      }
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
  const hasReferencedImage = useMemo(() => {
    if (!selectedAssetId || !boardQuery.data) return false;
    const a = boardQuery.data.assets.find((x) => x.id === selectedAssetId);
    return a?.kind === "image";
  }, [selectedAssetId, boardQuery.data]);
  const referencedAssets = useMemo(() => {
    if (!selectedAssetId || !boardQuery.data) return [];
    const a = boardQuery.data.assets.find((x) => x.id === selectedAssetId);
    if (!a) return [];
    // Images render their assetUrl directly; videos use the still thumbnail
    // (since vision models can't watch a moving video).
    const previewUrl =
      a.kind === "image" ? a.assetUrl : a.kind === "video" ? a.thumbnailUrl : null;
    return [{ id: a.id, kind: a.kind, previewUrl }];
  }, [selectedAssetId, boardQuery.data]);

  const sendSelfAvatarCta = (text: string) => {
    const cta = {
      label: "Open Photo Avatars",
      href: "/dashboard?action=upload#photo-avatars",
      testId: "button-open-photo-avatars",
    };
    const assistantContent =
      "Got it — to create a Photo Avatar of yourself, head to Photo Avatars. Upload a clear headshot there and we'll train the avatar so you can use it in any video.";
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: assistantContent,
      cta,
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    // Persist the CTA pair so it survives reload — without it the
    // intent-detector branch would lose its message on every refresh.
    // Failures are silent: the in-memory bubble has already rendered, and
    // we don't want to surface a toast for a cosmetic write.
    apiRequest("POST", `/api/boards/${boardId}/messages`, {
      messages: [
        { role: "user", content: text, notice: null, cta: null },
        { role: "assistant", content: assistantContent, notice: null, cta },
      ],
    })
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "messages"] }),
      )
      .catch((err) =>
        console.warn("[boards] failed to persist self-avatar CTA:", err),
      );
  };

  const sendChat = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/boards/${boardId}/chat`, {
        message: text,
        mode,
        provider,
        generationMode,
        referencedAssetIds,
        ...(provider === "seedance" ? { seedanceOptions } : {}),
        ...(mode === "brainstorm" ? { chatModel } : {}),
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
      const baseReply =
        typeof replyRaw === "string"
          ? replyRaw
          : replyRaw?.content ?? "(no reply)";
      // The server may include a friendly `notice` when a fallback model was
      // used (e.g. "Claude was unavailable, so I used Gemini instead."). We
      // surface it as an italic prefix on the same assistant bubble so the
      // user understands why the answer style might differ — without ever
      // exposing the raw upstream provider error.
      const notice = typeof data?.notice === "string" ? data.notice : null;
      const reply = notice ? `_${notice}_\n\n${baseReply}` : baseReply;
      // If the server reports every provider was down, also re-check the
      // health endpoint so the Think model picker reflects the new defaults.
      if (data?.allFailed || data?.fallbackUsed) {
        queryClient.invalidateQueries({ queryKey: ["/api/boards/chat/health"] });
      }
      setMessages((m) =>
        m.map((msg) => (msg.id === ctx?.pendingId ? { ...msg, content: reply, pending: false } : msg)),
      );
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      // The server persisted both the user turn and the assistant reply, so
      // refresh the cached history. This keeps a second tab (or any other
      // collaborator on a shared board) in sync without a manual refresh.
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "messages"] });
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

  const leaveBoard = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/share/me`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Left board", description: "It has been removed from your Shared tab." });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setLocation("/boards");
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't leave board", description: errText, variant: "destructive" });
    },
  });

  const setWinner = useMutation({
    mutationFn: async ({ batchId, assetId }: { batchId: string; assetId: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/boards/${boardId}/batches/${batchId}/winner`,
        { winnerAssetId: assetId },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Winner updated", description: "Your pick is now the winning variation." });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't override winner", description: errText, variant: "destructive" });
    },
  });

  const reEvaluateBatch = useMutation({
    mutationFn: async ({
      batchId,
      modelHint,
      extraCriteria,
    }: {
      batchId: string;
      modelHint: ReEvalModel;
      extraCriteria?: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/boards/${boardId}/batches/${batchId}/re-evaluate`,
        { modelHint, extraCriteria },
      );
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch re-evaluated",
        description: `New winner picked using ${data?.modelUsed ?? "model"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Re-evaluation failed", description: errText, variant: "destructive" });
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

  const bottomToolbarRef = useRef<BoardBottomToolbarHandle>(null);

  const createToolAsset = useCallback(
    async (params: {
      kind: "sticky" | "text" | "frame" | "drawing";
      content: string;
      width?: number;
      height?: number;
      label?: string;
    }) => {
      if (!boardId) return;
      const batchId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tileWidth =
        params.width ?? (params.kind === "frame" ? 320 : params.kind === "drawing" ? 360 : 200);
      const tileHeight =
        params.height ?? (params.kind === "frame" ? 200 : params.kind === "drawing" ? 240 : 150);
      const labels: Record<string, string> = {
        sticky: "Sticky note",
        text: "Text",
        frame: "Frame",
        drawing: "Drawing",
      };
      try {
        await apiRequest("POST", `/api/boards/${boardId}/assets`, {
          batchId,
          batchLabel: params.label ?? labels[params.kind],
          kind: params.kind,
          provider: "tool",
          status: "ready",
          content: params.content,
          positionX: 40,
          positionY: 40,
          width: tileWidth,
          height: tileHeight,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          title: `Couldn't add ${labels[params.kind].toLowerCase()}`,
          description: msg,
          variant: "destructive",
        });
      }
    },
    [boardId, toast],
  );

  const promptCreate = useCallback(
    (kind: "sticky" | "text" | "frame", placeholder: string) => {
      if (typeof window === "undefined") return;
      const value = window.prompt(placeholder, "");
      if (value === null) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      void createToolAsset({ kind, content: trimmed });
    },
    [createToolAsset],
  );

  const handleSaveDrawing = useCallback(
    (svg: string) => {
      setDrawOpen(false);
      void createToolAsset({ kind: "drawing", content: svg });
    },
    [createToolAsset],
  );

  const handleSaveRecording = useCallback(
    async (file: File) => {
      setRecordOpen(false);
      if (!boardId) return;
      try {
        const result = await uploadFileToBoard(boardId, file);
        if (result) {
          queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
          toast({
            title: "Voice note added",
            description: "It's now visible on the board.",
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: "Recording failed", description: msg, variant: "destructive" });
      }
    },
    [boardId, toast],
  );

  const handleUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!boardId) return;
      try {
        const results = await uploadFilesToBoard(boardId, files, (file, err) => {
          const msg = err instanceof Error ? err.message : String(err);
          toast({
            title: `Couldn't upload ${file.name}`,
            description: msg,
            variant: "destructive",
          });
        });
        if (results.length > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
          toast({
            title: results.length === 1 ? "File uploaded" : "Files uploaded",
            description: `${results.length} ${
              results.length === 1 ? "file is" : "files are"
            } now on the board.`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: "Upload failed", description: msg, variant: "destructive" });
      }
    },
    [boardId, toast],
  );

  // Ctrl+U / Cmd+U opens the "+" media picker, but only when the user isn't
  // typing into an input or a modal/dialog is on top of the board.
  useEffect(() => {
    if (!boardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "u" && e.key !== "U") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (
        typeof document !== "undefined" &&
        document.querySelector('[role="dialog"][data-state="open"]')
      ) {
        return;
      }
      e.preventDefault();
      bottomToolbarRef.current?.openMediaPicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardId]);

  // Apply seed payload from URL (set by Discover templates) once per board
  useEffect(() => {
    if (!seedParams || !boardId) return;
    if (seedAppliedRef.current === boardId) return;
    seedAppliedRef.current = boardId;
    if (seedParams.provider) setProvider(seedParams.provider);
    if (seedParams.mode) setGenerationMode(seedParams.mode);
    // Plan-mode intents (Social Post / Blog Article) land in conversational
    // brainstorm mode; build/generation intents land in create mode.
    setMode(seedParams.chatMode === "plan" ? "brainstorm" : "create");
    const intentLabels: Record<string, string> = {
      "social-post": "Social Post",
      "blog-article": "Blog Article",
      image: "Image",
      video: "Video",
    };
    if (seedParams.chatMode === "plan") {
      // Plan mode: don't stuff the typed idea into a fake assistant message.
      // Pre-fill the input so the user can keep typing, and open with one
      // focused planning question to get the conversation going.
      if (seedParams.seed) {
        setPendingInput(seedParams.seed);
      }
      const intentLabel = seedParams.intent
        ? intentLabels[seedParams.intent] ?? seedParams.intent
        : null;
      const planningQuestion = intentLabel
        ? `Let's plan your ${intentLabel.toLowerCase()}. Who's the audience, which channel will it run on, and what tone are you going for?`
        : `Let's plan this out. Who's the audience, which channel will it run on, and what tone are you going for?`;
      setMessages((m) => [
        ...m,
        {
          id: `plan-open-${boardId}`,
          role: "assistant",
          content: planningQuestion,
        },
      ]);
    } else if (seedParams.seed) {
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
    }
    // Clean the seed from the URL so a refresh doesn't re-apply it
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `/boards/${boardId}`);
    }
  }, [seedParams, boardId]);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId || !boardQuery.data) return null;
    return boardQuery.data.assets.find((a) => a.id === selectedAssetId) ?? null;
  }, [selectedAssetId, boardQuery.data]);

  const selectedSourceAsset = useMemo(() => {
    if (!selectedAsset?.sourceAssetId || !boardQuery.data) return null;
    return boardQuery.data.assets.find((a) => a.id === selectedAsset.sourceAssetId) ?? null;
  }, [selectedAsset, boardQuery.data]);

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
      <div
        className={`${themeClass}h-screen w-full bg-neutral-200/40 dark:bg-neutral-950 flex flex-col items-center justify-center gap-4 px-6 text-center`}
      >
        <div className="text-[15px] font-medium text-neutral-800 dark:text-neutral-100">
          We couldn't open that board.
        </div>
        <div className="text-[12px] text-neutral-500 dark:text-neutral-400 max-w-sm">
          It may have been deleted or you don't have access. Head back to your dashboard and start
          a new plan — describe what you want to create and we'll help you build it.
        </div>
        <button
          className="px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] dark:bg-neutral-100 dark:text-neutral-900"
          onClick={() => setLocation("/boards")}
          data-testid="button-return-boards"
        >
          Plan something new
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
          {board.isOwner !== false ? (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900"
              data-testid="button-share"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (leaveBoard.isPending) return;
                if (typeof window !== "undefined" && !window.confirm("Remove this board from your Shared tab? The owner will keep it.")) return;
                leaveBoard.mutate();
              }}
              disabled={leaveBoard.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-[12px] font-medium disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              data-testid="button-leave-board"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{leaveBoard.isPending ? "Leaving…" : "Leave board"}</span>
            </button>
          )}
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
            onSetWinner={(batchId, assetId) => setWinner.mutate({ batchId, assetId })}
            onReEvaluate={(batchId, payload) =>
              reEvaluateBatch.mutate({ batchId, ...payload })
            }
            reEvalPendingBatchId={
              reEvaluateBatch.isPending ? reEvaluateBatch.variables?.batchId ?? null : null
            }
            setWinnerPendingAssetId={
              setWinner.isPending ? setWinner.variables?.assetId ?? null : null
            }
          />
          {selectedAsset && (
            <AssetToolbar
              asset={selectedAsset}
              sourceAsset={selectedSourceAsset}
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
          <BoardBottomToolbar
            ref={bottomToolbarRef}
            cursorActive={selectedAssetId === null}
            onActivateCursor={() => setSelectedAssetId(null)}
            onPickImage={(files) => void handleUploadFiles(files)}
            onPickVideo={(files) => void handleUploadFiles(files)}
            onPickMedia={(files) => void handleUploadFiles(files)}
            onPickAudio={(files) => void handleUploadFiles(files)}
            onCreateSticky={() =>
              promptCreate("sticky", "What should this sticky note say?")
            }
            onCreateText={() => promptCreate("text", "Text to add to the board:")}
            onCreateFrame={() =>
              promptCreate("frame", "Name this frame (e.g. Hero shots):")
            }
            onOpenDraw={() => setDrawOpen(true)}
            onOpenRecord={() => setRecordOpen(true)}
          />
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
            chatModel={chatModel}
            onChatModelChange={handleChatModelChange}
            referencedAssetIds={referencedAssetIds}
            hasReferencedImage={hasReferencedImage}
            referencedAssets={referencedAssets}
            onRemoveReferencedAsset={() => setSelectedAssetId(null)}
            onSend={(text) => {
              if (detectCreateSelfAvatarIntent(text)) {
                sendSelfAvatarCta(text);
                return;
              }
              sendChat.mutate(text);
            }}
            isSending={sendChat.isPending}
            pendingInput={pendingInput}
            onPendingInputApplied={() => setPendingInput(null)}
          />
        )}
      </div>
      <ShareBoardDialog boardId={board.id} open={shareOpen} onOpenChange={setShareOpen} />
      <DrawingModal open={drawOpen} onCancel={() => setDrawOpen(false)} onSave={handleSaveDrawing} />
      <RecordModal open={recordOpen} onCancel={() => setRecordOpen(false)} onSave={handleSaveRecording} />
    </div>
  );
}
