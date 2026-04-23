import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, LogOut, MessageSquare, Settings as SettingsIcon, Share2, Moon, Sun } from "lucide-react";
import { AssetToolbar } from "@/components/boards/AssetToolbar";
import { GroupAssetToolbar } from "@/components/boards/GroupAssetToolbar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";
import { BoardCanvas, type CanvasBatch, type ReEvalModel } from "@/components/boards/BoardCanvas";
import {
  BoardBottomToolbar,
  type BoardBottomToolbarHandle,
  type BoardUploadChip,
} from "@/components/boards/BoardBottomToolbar";
import {
  isBoardUploadCancelled,
  uploadFilesToBoard,
  uploadFileToBoard,
} from "@/lib/boardUpload";
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
  // Multi-select: an array of asset ids (insertion order preserved). For
  // backwards-compat with the rest of the page, `selectedAssetId` is derived
  // and only non-null when exactly one asset is selected — that's the case
  // where the single-asset toolbar (with before/after compare) makes sense.
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const selectedAssetId = selectedAssetIds.length === 1 ? selectedAssetIds[0] : null;
  const selectedAssetSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);
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

  type PersistedBoardMessageAuthor = {
    id: string;
    name: string | null;
    email: string | null;
  };
  type PersistedBoardMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    notice: string | null;
    cta: { label: string; href: string; testId?: string } | null;
    createdAt: string | null;
    authorUserId?: string | null;
    author?: PersistedBoardMessageAuthor | null;
  };
  const messagesQuery = useQuery<{ messages: PersistedBoardMessage[] }>({
    queryKey: ["/api/boards", boardId, "messages"],
    enabled: !!boardId,
  });

  // The board owner's id, used as the fallback "author" for legacy rows
  // (persisted before authorship was tracked) and to label the most common
  // private-board case correctly.
  const boardOwnerId = boardQuery.data
    ? (boardQuery.data as unknown as { userId?: string }).userId ?? null
    : null;
  const currentUserId = user?.id ? String(user.id) : null;

  // Resolve a message's author into a label + isSelf flag for ChatPanel.
  // Only emits an author tag when the board has actually been shared with
  // someone — otherwise the panel stays visually identical to the
  // single-user version. Null author rows (legacy data) are attributed to
  // the board owner, which matches who could have written them under the
  // old owner-only policy.
  const resolveAuthor = useCallback(
    (m: PersistedBoardMessage) => {
      if (!boardQuery.data?.isShared) return undefined;
      const authorId = m.authorUserId ?? m.author?.id ?? boardOwnerId;
      if (!authorId) return undefined;
      const isSelf = currentUserId !== null && authorId === currentUserId;
      const label =
        m.author?.name?.trim() ||
        m.author?.email?.trim() ||
        (authorId === boardOwnerId ? "Board owner" : "Collaborator");
      return { name: label, isSelf };
    },
    [boardQuery.data?.isShared, boardOwnerId, currentUserId],
  );

  useEffect(() => {
    if (!boardId) return;
    if (hydratedBoardRef.current === boardId) return;
    const data = messagesQuery.data;
    if (!data || !Array.isArray(data.messages)) return;
    // Wait for board metadata too — `resolveAuthor` needs `isShared` and the
    // owner id to decide whether and how to label each message. Hydrating
    // before the board query resolves would strip author labels permanently
    // (we only hydrate once per board).
    if (!boardQuery.data) return;
    const restored: ChatMessage[] = data.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.notice ? `_${m.notice}_\n\n${m.content}` : m.content,
      cta: m.cta ?? undefined,
      author: resolveAuthor(m),
    }));
    // Merge older history above any in-flight messages. If the user started
    // sending before hydration finished, we keep their optimistic message and
    // the pending assistant placeholder (so the chat mutation can still swap
    // in the reply via pendingId) and prepend the restored history above it.
    // Dedupe by id so a restored row can't appear twice if it's already in
    // local state.
    setMessages((current) => {
      if (current.length === 0) return restored;
      const liveIds = new Set(current.map((m) => m.id));
      const olderHistory = restored.filter((m) => !liveIds.has(m.id));
      return [...olderHistory, ...current];
    });
    hydratedBoardRef.current = boardId;
  }, [boardId, messagesQuery.data, boardQuery.data, resolveAuthor]);

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
      if (t === "board_asset_updated") {
        const d = msg.data as {
          boardId: string;
          batchId: string;
          assetId: string;
          content?: string | null;
        };
        if (d.boardId !== boardId) return;
        queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) => {
          if (!prev) return prev;
          const patchAsset = <T extends { id: string }>(a: T): T => {
            if (a.id !== d.assetId) return a;
            return {
              ...a,
              ...(d.content !== undefined ? { content: d.content } : {}),
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

  const referencedAssetIds = selectedAssetIds;
  const selectedAssetObjects = useMemo(() => {
    if (selectedAssetIds.length === 0 || !boardQuery.data) return [];
    const byId = new Map(boardQuery.data.assets.map((a) => [a.id, a] as const));
    const out: typeof boardQuery.data.assets = [];
    for (const id of selectedAssetIds) {
      const a = byId.get(id);
      if (a) out.push(a);
    }
    return out;
  }, [selectedAssetIds, boardQuery.data]);
  const hasReferencedImage = useMemo(
    () => selectedAssetObjects.some((a) => a.kind === "image"),
    [selectedAssetObjects],
  );
  const referencedAssets = useMemo(
    () =>
      selectedAssetObjects.map((a) => ({
        id: a.id,
        kind: a.kind,
        // Images render their assetUrl directly; videos use the still thumbnail
        // (since vision models can't watch a moving video).
        previewUrl:
          a.kind === "image" ? a.assetUrl : a.kind === "video" ? a.thumbnailUrl : null,
      })),
    [selectedAssetObjects],
  );

  // Selection helpers. `additive=true` (shift/cmd/ctrl click) toggles the id
  // in the existing selection; otherwise we replace it with a single id.
  const handleSelectAsset = useCallback(
    (id: string | null, opts?: { additive?: boolean }) => {
      if (id === null) {
        setSelectedAssetIds([]);
        return;
      }
      if (opts?.additive) {
        setSelectedAssetIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
        return;
      }
      setSelectedAssetIds([id]);
    },
    [],
  );
  const handleSelectMany = useCallback((ids: string[]) => {
    setSelectedAssetIds(ids);
  }, []);
  const handleSelectAll = useCallback(() => {
    if (!boardQuery.data) return;
    setSelectedAssetIds(boardQuery.data.assets.map((a) => a.id));
  }, [boardQuery.data]);
  const handleRemoveReferencedAsset = useCallback((id: string) => {
    setSelectedAssetIds((prev) => prev.filter((x) => x !== id));
  }, []);

  // Build the "from <me>" tag that decorates a turn we just sent
  // optimistically. Same gating as the hydrated-message resolver: only emit
  // a tag on shared boards so the private-board UI stays unchanged.
  const selfAuthorTag = useMemo(() => {
    if (!boardQuery.data?.isShared || !user) return undefined;
    const label =
      (typeof user.name === "string" && user.name.trim()) ||
      (typeof user.email === "string" && user.email.trim()) ||
      "You";
    return { name: label, isSelf: true } as const;
  }, [boardQuery.data?.isShared, user]);

  const sendSelfAvatarCta = (text: string) => {
    const cta = {
      label: "Open Photo Avatars",
      href: "/dashboard?action=upload#photo-avatars",
      testId: "button-open-photo-avatars",
    };
    const assistantContent =
      "Got it — to create a Photo Avatar of yourself, head to Photo Avatars. Upload a clear headshot there and we'll train the avatar so you can use it in any video.";
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      author: selfAuthorTag,
    };
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

  // Tracks the AbortController for the in-flight chat request so the user
  // can cancel a slow reply via the Stop button. Also remembers the pending
  // assistant message id so onError can distinguish a true failure from a
  // user-initiated abort (we already cleared the bubble in handleStopChat).
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatAbortedPendingIdRef = useRef<string | null>(null);

  const sendChat = useMutation({
    mutationFn: async (text: string) => {
      const controller = new AbortController();
      chatAbortRef.current = controller;
      const res = await apiRequest(
        "POST",
        `/api/boards/${boardId}/chat`,
        {
          message: text,
          mode,
          provider,
          generationMode,
          referencedAssetIds,
          ...(provider === "seedance" ? { seedanceOptions } : {}),
          ...(mode === "brainstorm" ? { chatModel } : {}),
        },
        { signal: controller.signal },
      );
      return res.json();
    },
    onMutate: (text) => {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        author: selfAuthorTag,
      };
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
      const pendingId = (ctx as { pendingId?: string } | undefined)?.pendingId;
      // If this rejection is the result of a user-initiated Stop, the bubble
      // and toast were already handled by handleStopChat — don't double-up
      // with a destructive "Chat error" toast or rewrite the bubble.
      const isAbort =
        e?.name === "AbortError" ||
        chatAbortedPendingIdRef.current === pendingId;
      if (isAbort) {
        chatAbortedPendingIdRef.current = null;
        return;
      }
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId ? { ...msg, content: `Error: ${errText}`, pending: false } : msg,
        ),
      );
      toast({ title: "Chat error", description: errText, variant: "destructive" });
    },
    onSettled: () => {
      chatAbortRef.current = null;
    },
  });

  // Cancel the in-flight chat request and clear the optimistic pending bubble
  // so the conversation doesn't show an orphan "…" message. Used by both the
  // ChatPanel Stop button and the leave-board / unmount paths.
  const handleStopChat = () => {
    const controller = chatAbortRef.current;
    if (!controller) return;
    // Find and remove the pending bubble; remember its id so onError knows
    // this rejection came from the user, not the server.
    setMessages((m) => {
      const pending = m.find((msg) => msg.role === "assistant" && msg.pending);
      if (pending) chatAbortedPendingIdRef.current = pending.id;
      return m.filter((msg) => !(msg.role === "assistant" && msg.pending));
    });
    controller.abort();
    chatAbortRef.current = null;
    toast({ title: "Reply stopped", description: "We canceled the in-flight reply." });
  };

  const clearChat = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/messages`);
      return res.json();
    },
    onSuccess: () => {
      // Drop the in-memory transcript so the panel reflects the wipe
      // immediately, then refresh the cached history so any other open tab
      // sees an empty thread on its next focus.
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "messages"] });
      toast({ title: "Chat cleared", description: "All messages have been deleted." });
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't clear chat", description: errText, variant: "destructive" });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/assets/${assetId}`);
      return res.json();
    },
    onSuccess: (_data, assetId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId));
    },
  });

  // Bulk delete the current multi-selection. Errors don't abort the batch —
  // we report a partial-success toast so the user sees what survived.
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiRequest("DELETE", `/api/boards/${boardId}/assets/${id}`).then((r) => r.json()),
        ),
      );
      return { ids, results };
    },
    onSuccess: ({ ids, results }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;
      // Drop the successfully-deleted ids from the selection. Failed ones
      // stay so the user can retry.
      const failedIds = new Set(
        results
          .map((r, i) => (r.status === "rejected" ? ids[i] : null))
          .filter((x): x is string => !!x),
      );
      setSelectedAssetIds((prev) => prev.filter((id) => failedIds.has(id)));
      if (failed === 0) {
        toast({
          title: `Deleted ${succeeded} ${succeeded === 1 ? "asset" : "assets"}`,
        });
      } else {
        toast({
          title: `Deleted ${succeeded} of ${results.length} assets`,
          description: `${failed} couldn't be deleted. They're still selected so you can try again.`,
          variant: "destructive",
        });
      }
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't delete assets", description: errText, variant: "destructive" });
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

  const updateAssetContent = useMutation({
    mutationFn: async ({ assetId, content }: { assetId: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/boards/${boardId}/assets/${assetId}`, {
        content,
      });
      return res.json();
    },
    onMutate: async ({ assetId, content }) => {
      // Optimistically patch the cached board so the editor's own canvas
      // updates instantly without waiting for the round-trip refetch.
      queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) => {
        if (!prev) return prev;
        const patchAsset = <T extends { id: string; content?: string | null }>(a: T): T =>
          a.id === assetId ? { ...a, content } : a;
        return {
          ...prev,
          batches: prev.batches.map((b) => ({ ...b, assets: b.assets.map(patchAsset) })),
          assets: prev.assets.map(patchAsset),
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't save edit", description: errText, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
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

  const resizeAsset = useMutation({
    mutationFn: async (vars: { assetId: string; width: number; height: number }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/boards/${boardId}/assets/${vars.assetId}`,
        { width: vars.width, height: vars.height },
      );
      return res.json();
    },
    onMutate: (vars) => {
      // Optimistic: update the cached size right away so the resize handle
      // doesn't snap back while the PATCH is in flight.
      queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) => {
        if (!prev) return prev;
        const patch = <T extends { id: string }>(a: T): T =>
          a.id === vars.assetId ? { ...a, width: vars.width, height: vars.height } : a;
        return {
          ...prev,
          batches: prev.batches.map((b) => ({ ...b, assets: b.assets.map(patch) })),
          assets: prev.assets.map(patch),
        };
      });
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't resize", description: errText, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
  });

  // Reset selection when board changes
  useEffect(() => {
    setSelectedAssetIds([]);
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

  // In-flight + just-failed uploads, surfaced as chips above the bottom
  // toolbar. The original `File` is kept on the entry so retries can re-run
  // the upload without re-prompting the picker.
  const [uploadChips, setUploadChips] = useState<
    (BoardUploadChip & { file: File })[]
  >([]);

  // Track an AbortController per in-flight upload so the chip's cancel button
  // can abort the signed PUT mid-stream. Kept in a ref so updates don't
  // re-render and so we can reach the controller from event handlers.
  const uploadAbortersRef = useRef<Map<string, AbortController>>(new Map());

  // Clear upload chips when boardId changes so progress from board A doesn't
  // show up on board B. Also abort any in-flight uploads from the previous
  // board so they stop streaming and don't create stray asset rows.
  useEffect(() => {
    uploadAbortersRef.current.forEach((controller) => controller.abort());
    uploadAbortersRef.current.clear();
    setUploadChips([]);
  }, [boardId]);

  const startUpload = useCallback(
    async (file: File, existingId?: string) => {
      if (!boardId) return;
      const id =
        existingId ??
        `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const controller = new AbortController();
      uploadAbortersRef.current.set(id, controller);
      setUploadChips((prev) => {
        const without = prev.filter((u) => u.id !== id);
        return [
          ...without,
          { id, file, fileName: file.name, percent: 0, status: "uploading" },
        ];
      });
      try {
        const result = await uploadFileToBoard(boardId, file, {
          signal: controller.signal,
          onProgress: (percent) => {
            setUploadChips((prev) =>
              prev.map((u) => (u.id === id ? { ...u, percent } : u)),
            );
          },
        });
        setUploadChips((prev) => prev.filter((u) => u.id !== id));
        if (result) {
          queryClient.invalidateQueries({
            queryKey: ["/api/boards", boardId],
          });
          toast({
            title: "File uploaded",
            description: `${file.name} is now on the board.`,
          });
        }
      } catch (err) {
        // User-initiated cancels are surfaced separately by handleCancelUpload
        // — don't show a destructive failure toast and don't leave a chip
        // behind in the error state.
        if (isBoardUploadCancelled(err)) {
          setUploadChips((prev) => prev.filter((u) => u.id !== id));
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setUploadChips((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, status: "error", error: msg } : u,
          ),
        );
        toast({
          title: `Couldn't upload ${file.name}`,
          description: msg,
          variant: "destructive",
        });
      } finally {
        uploadAbortersRef.current.delete(id);
      }
    },
    [boardId, toast],
  );

  const handleUploadFiles = useCallback(
    (files: FileList | File[]) => {
      if (!boardId) return;
      for (const file of Array.from(files)) {
        void startUpload(file);
      }
    },
    [boardId, startUpload],
  );

  const handleRetryUpload = useCallback(
    (id: string) => {
      const entry = uploadChips.find((u) => u.id === id);
      if (!entry) return;
      void startUpload(entry.file, id);
    },
    [uploadChips, startUpload],
  );

  const handleDismissUpload = useCallback((id: string) => {
    setUploadChips((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const handleCancelUpload = useCallback(
    (id: string) => {
      const controller = uploadAbortersRef.current.get(id);
      if (!controller) return;
      const entry = uploadChips.find((u) => u.id === id);
      controller.abort();
      uploadAbortersRef.current.delete(id);
      // The startUpload catch will also remove the chip, but do it eagerly so
      // the UI feels instant even if the abort event takes a tick to fire.
      setUploadChips((prev) => prev.filter((u) => u.id !== id));
      toast({
        title: "Upload cancelled",
        description: entry ? entry.fileName : undefined,
        action: entry ? (
          <ToastAction
            altText={`Undo cancel of ${entry.fileName}`}
            onClick={() => {
              void startUpload(entry.file, id);
            }}
            data-testid={`button-undo-cancel-upload-${id}`}
          >
            Undo
          </ToastAction>
        ) : undefined,
      });
    },
    [uploadChips, toast, startUpload],
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
            selectedAssetIds={selectedAssetSet}
            onSelectAsset={handleSelectAsset}
            onSelectMany={handleSelectMany}
            onSelectAll={handleSelectAll}
            onDeleteAsset={(id) => deleteAsset.mutate(id)}
            onClearRejection={(id) => clearRejection.mutate(id)}
            onSetWinner={(batchId, assetId) => setWinner.mutate({ batchId, assetId })}
            onReEvaluate={(batchId, payload) =>
              reEvaluateBatch.mutate({ batchId, ...payload })
            }
            onResizeAsset={(assetId, width, height) =>
              resizeAsset.mutate({ assetId, width, height })
            }
            reEvalPendingBatchId={
              reEvaluateBatch.isPending ? reEvaluateBatch.variables?.batchId ?? null : null
            }
            setWinnerPendingAssetId={
              setWinner.isPending ? setWinner.variables?.assetId ?? null : null
            }
            onUpdateAssetContent={(assetId, content) =>
              updateAssetContent.mutate({ assetId, content })
            }
          />
          {selectedAssetIds.length === 1 && selectedAsset && (
            <AssetToolbar
              asset={selectedAsset}
              sourceAsset={selectedSourceAsset}
              onClose={() => setSelectedAssetIds([])}
              onDelete={() => deleteAsset.mutate(selectedAsset.id)}
              onClearRejection={() => clearRejection.mutate(selectedAsset.id)}
              onReuseInChat={() => {
                setMode("create");
                if (!chatOpen) setChatOpen(true);
              }}
            />
          )}
          {selectedAssetIds.length >= 2 && (
            <GroupAssetToolbar
              assets={selectedAssetObjects}
              onClose={() => setSelectedAssetIds([])}
              onReuseInChat={() => {
                setMode("create");
                if (!chatOpen) setChatOpen(true);
              }}
              onBulkDelete={() => bulkDelete.mutate(selectedAssetIds)}
              isDeleting={bulkDelete.isPending}
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
            cursorActive={selectedAssetIds.length === 0}
            onActivateCursor={() => setSelectedAssetIds([])}
            onPickImage={(files) => handleUploadFiles(files)}
            onPickVideo={(files) => handleUploadFiles(files)}
            onPickMedia={(files) => handleUploadFiles(files)}
            onPickAudio={(files) => handleUploadFiles(files)}
            onCreateSticky={() =>
              promptCreate("sticky", "What should this sticky note say?")
            }
            onCreateText={() => promptCreate("text", "Text to add to the board:")}
            onCreateFrame={() =>
              promptCreate("frame", "Name this frame (e.g. Hero shots):")
            }
            onOpenDraw={() => setDrawOpen(true)}
            onOpenRecord={() => setRecordOpen(true)}
            uploads={uploadChips}
            onRetryUpload={handleRetryUpload}
            onDismissUpload={handleDismissUpload}
            onCancelUpload={handleCancelUpload}
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
            onRemoveReferencedAsset={handleRemoveReferencedAsset}
            onSend={(text) => {
              if (detectCreateSelfAvatarIntent(text)) {
                sendSelfAvatarCta(text);
                return;
              }
              sendChat.mutate(text);
            }}
            isSending={sendChat.isPending}
            onStop={handleStopChat}
            pendingInput={pendingInput}
            onPendingInputApplied={() => setPendingInput(null)}
            onClearChat={
              board.isOwner !== false ? () => clearChat.mutate() : undefined
            }
            isClearingChat={clearChat.isPending}
          />
        )}
      </div>
      <ShareBoardDialog boardId={board.id} open={shareOpen} onOpenChange={setShareOpen} />
      <DrawingModal open={drawOpen} onCancel={() => setDrawOpen(false)} onSave={handleSaveDrawing} />
      <RecordModal open={recordOpen} onCancel={() => setRecordOpen(false)} onSave={handleSaveRecording} />
    </div>
  );
}
