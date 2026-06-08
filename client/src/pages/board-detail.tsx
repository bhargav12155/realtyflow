import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, LogOut, MessageSquare, Settings as SettingsIcon, Share2, Moon, Sun, Trash2 } from "lucide-react";
import { AssetToolbar } from "@/components/boards/AssetToolbar";
import { GroupAssetToolbar } from "@/components/boards/GroupAssetToolbar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/authToken";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";
import { useRenameBoardMutation } from "@/hooks/use-rename-board";
import { useLeaveBoardMutation } from "@/hooks/use-leave-board";
import { useDeleteBoardMutation } from "@/hooks/use-delete-board";
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
import { PresenceAvatars } from "@/components/boards/PresenceAvatars";
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
  // Per-board cap on persisted chat messages (owner-tunable). Always present
  // on rows from the server, but typed as optional so older cached responses
  // don't blow up.
  chatHistoryCap?: number;
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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
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
  // Confirmation gate before firing a generation: holds the prompt text until
  // the user either confirms ("generate now") or cancels ("make more changes").
  const [pendingGenText, setPendingGenText] = useState<string | null>(null);
  // Resizable chat panel width (px), persisted in localStorage per-browser.
  const [chatPanelWidth, setChatPanelWidth] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("chatPanelWidth") ?? "360", 10) || 360; } catch { return 360; }
  });
  const handleChatPanelWidthChange = (w: number) => {
    setChatPanelWidth(w);
    try { localStorage.setItem("chatPanelWidth", String(w)); } catch { /* ignore */ }
  };
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

  // Live presence: who else is currently viewing this board, and who is
  // typing in the chat panel right now. The server only knows about a viewer
  // after it receives a `presence_join`; our useEffect below sends one as
  // soon as the websocket is connected and a board id is loaded.
  type BoardViewer = { userId: string; name: string | null; email: string | null };
  const [presenceViewers, setPresenceViewers] = useState<BoardViewer[]>([]);
  // userId -> display name for users currently typing (other than self).
  // Each entry has its own timeout so stale typing indicators don't linger
  // if the sender disconnects mid-keystroke.
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Live tile drags from other collaborators. Key: assetId. Value: target
  // position the dragger is hovering over plus their display name. Cleared
  // when the dragger sends `isEnd:true`, when they leave presence, or via a
  // safety timeout in case we never see the end packet (e.g. they crashed
  // mid-drag). The persisted position arrives moments later via
  // `board_asset_updated`, so the ghost vanishes and the canonical tile
  // slides into place.
  const [remoteDrags, setRemoteDrags] = useState<
    Map<
      string,
      {
        positionX: number;
        positionY: number;
        userId: string;
        name: string | null;
        email: string | null;
      }
    >
  >(() => new Map());
  const remoteDragTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const clearRemoteDragTimer = (assetId: string) => {
    const t = remoteDragTimersRef.current[assetId];
    if (t) {
      clearTimeout(t);
      delete remoteDragTimersRef.current[assetId];
    }
  };

  // Live "Figma-style" cursors for collaborators between drags. Key: userId.
  // Each entry is the most recent scroller-content position the remote user
  // pinged, plus their display label. We auto-expire each entry a few
  // seconds after the last update so a viewer who stops moving (or whose
  // socket dies before sending a `isLeave`) doesn't leave a stale pointer
  // pinned to the canvas forever. An explicit `isLeave` packet clears the
  // cursor immediately.
  const [remoteCursors, setRemoteCursors] = useState<
    Map<
      string,
      { x: number; y: number; name: string | null; email: string | null }
    >
  >(() => new Map());
  const remoteCursorTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const clearRemoteCursorTimer = (userId: string) => {
    const t = remoteCursorTimersRef.current[userId];
    if (t) {
      clearTimeout(t);
      delete remoteCursorTimersRef.current[userId];
    }
  };

  // Listen for asset status updates pushed via WebSocket
  const { isConnected: wsConnected, send: wsSend } = useWebSocket({
    userId: user?.id ? String(user.id) : undefined,
    autoConnect: !!user?.id,
    showToast: false,
    onMessage: (msg) => {
      const t = msg.type;
      if (t === "board_presence") {
        const d = msg.data as { boardId: string; viewers: BoardViewer[] };
        if (d.boardId !== boardId) return;
        const viewers = Array.isArray(d.viewers) ? d.viewers : [];
        setPresenceViewers(viewers);
        // Proactively drop any remote cursors for users who are no longer
        // present on this board (e.g. SPA navigation away or socket close
        // before an explicit `cursor isLeave`). This guarantees instant
        // cleanup instead of waiting up to 5s for the idle timer.
        const presentIds = new Set(viewers.map((v) => v.userId));
        setRemoteCursors((prev) => {
          let changed = false;
          const next = new Map(prev);
          for (const userId of Array.from(next.keys())) {
            if (!presentIds.has(userId)) {
              next.delete(userId);
              clearRemoteCursorTimer(userId);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        return;
      }
      if (t === "board_typing") {
        const d = msg.data as {
          boardId: string;
          userId: string;
          name: string | null;
          email: string | null;
          isTyping: boolean;
        };
        if (d.boardId !== boardId) return;
        const selfId = user?.id ? String(user.id) : null;
        if (selfId && d.userId === selfId) return;
        const label = (d.name && d.name.trim()) || (d.email && d.email.trim()) || "Someone";
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (d.isTyping) {
            next[d.userId] = label;
          } else {
            delete next[d.userId];
          }
          return next;
        });
        // Reset the per-user expiry. Sender re-broadcasts every keystroke
        // (debounced), so we should clear the indicator if we don't hear
        // from them for ~5s.
        const existing = typingTimersRef.current[d.userId];
        if (existing) clearTimeout(existing);
        if (d.isTyping) {
          typingTimersRef.current[d.userId] = setTimeout(() => {
            setTypingUsers((prev) => {
              if (!(d.userId in prev)) return prev;
              const next = { ...prev };
              delete next[d.userId];
              return next;
            });
            delete typingTimersRef.current[d.userId];
          }, 5000);
        } else {
          delete typingTimersRef.current[d.userId];
        }
        return;
      }
      if (t === "board_cursor") {
        const d = msg.data as {
          boardId: string;
          userId: string;
          name: string | null;
          email: string | null;
          x: number | null;
          y: number | null;
          isLeave: boolean;
        };
        if (d.boardId !== boardId) return;
        const selfId = user?.id ? String(user.id) : null;
        if (selfId && d.userId === selfId) return;
        if (d.isLeave || d.x === null || d.y === null) {
          clearRemoteCursorTimer(d.userId);
          setRemoteCursors((prev) => {
            if (!prev.has(d.userId)) return prev;
            const next = new Map(prev);
            next.delete(d.userId);
            return next;
          });
          return;
        }
        const x = d.x;
        const y = d.y;
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          // Keep name/email separate so the cursor renderer can derive both
          // a user-colored chip with initials and a tooltip with the full
          // label using the shared presence helpers.
          next.set(d.userId, { x, y, name: d.name, email: d.email });
          return next;
        });
        clearRemoteCursorTimer(d.userId);
        // Idle expiry: 5s without an update drops the cursor so a viewer
        // who walks away (or whose socket silently dies before sending an
        // explicit leave) doesn't leave a stale pointer haunting the
        // canvas forever.
        remoteCursorTimersRef.current[d.userId] = setTimeout(() => {
          setRemoteCursors((cur) => {
            if (!cur.has(d.userId)) return cur;
            const out = new Map(cur);
            out.delete(d.userId);
            return out;
          });
          delete remoteCursorTimersRef.current[d.userId];
        }, 5000);
        return;
      }
      if (t === "board_asset_dragging") {
        const d = msg.data as {
          boardId: string;
          userId: string;
          name: string | null;
          email: string | null;
          moves: Array<{ id: string; positionX: number; positionY: number }>;
          isEnd: boolean;
        };
        if (d.boardId !== boardId) return;
        // Defensive: server already filters self-broadcasts via socket
        // identity, but if it ever gets through (e.g. multi-tab), suppress
        // it here so the user's own drag doesn't render a ghost on top of
        // their real one.
        const selfId = user?.id ? String(user.id) : null;
        if (selfId && d.userId === selfId) return;
        setRemoteDrags((prev) => {
          const next = new Map(prev);
          if (d.isEnd) {
            // Clear every asset this user was dragging — match by userId so
            // a stale entry left over from another asset on the same drag
            // also gets purged.
            for (const [aid, entry] of prev) {
              if (entry.userId === d.userId) {
                next.delete(aid);
                clearRemoteDragTimer(aid);
              }
            }
            return next;
          }
          for (const m of d.moves) {
            next.set(m.id, {
              positionX: m.positionX,
              positionY: m.positionY,
              userId: d.userId,
              name: d.name,
              email: d.email,
            });
            clearRemoteDragTimer(m.id);
            // Safety expiry: if the dragger goes silent for 3s without an
            // explicit end packet (e.g. they closed their tab mid-drag),
            // drop the ghost so it doesn't haunt the canvas forever.
            remoteDragTimersRef.current[m.id] = setTimeout(() => {
              setRemoteDrags((cur) => {
                if (!cur.has(m.id)) return cur;
                const out = new Map(cur);
                out.delete(m.id);
                return out;
              });
              delete remoteDragTimersRef.current[m.id];
            }, 3000);
          }
          return next;
        });
        return;
      }
      if (t === "board_asset_status") {
        const d = msg.data as {
          boardId: string;
          batchId: string;
          batchLabel?: string | null;
          assetId: string;
          status: string;
          assetUrl?: string | null;
          thumbnailUrl?: string | null;
          durationSeconds?: number | null;
          modelLabel?: string | null;
          rejectionReason?: string | null;
          // The full asset row is included by the server on creation
          // broadcasts (Task #244) so we can splice a brand-new tile into
          // the cache without refetching the entire board. Status-only
          // updates may omit it; the patch path below doesn't need it.
          fullAsset?: CanvasBatch["assets"][number] & { batchId?: string; batchLabel?: string | null };
        };
        if (d.boardId !== boardId) return;
        const cached = queryClient.getQueryData<BoardResponse>([
          "/api/boards",
          boardId,
        ]);
        const isKnownAsset =
          !!cached &&
          (cached.assets.some((a) => a.id === d.assetId) ||
            cached.batches.some((b) =>
              b.assets.some((a) => a.id === d.assetId),
            ));
        // Collaborator just uploaded a brand-new tile? If the server fanned
        // out the full asset shape (Task #244), splice it into the cache
        // directly so it appears instantly — no full board refetch, no
        // loading flash. Only fall back to invalidating the board query
        // when the payload is missing required fields (older server, or a
        // status update for an asset we never learned about).
        if (!isKnownAsset) {
          // We need a non-empty cache to splice into; if the board hasn't
          // even loaded yet, invalidating ensures the next fetch picks up
          // the new tile rather than silently dropping the frame.
          const incoming = d.fullAsset;
          const incomingHasMinimumShape =
            !!incoming &&
            typeof incoming === "object" &&
            incoming.id === d.assetId &&
            typeof incoming.kind === "string" &&
            incoming.kind.length > 0;
          if (cached && incomingHasMinimumShape && incoming) {
            const incomingBatchId = incoming.batchId ?? d.batchId;
            const incomingBatchLabel = incoming.batchLabel ?? d.batchLabel ?? null;
            queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) => {
              if (!prev) return prev;
              // Defensive guard against double-delivery: if the asset
              // already exists by the time this runs (e.g. the same frame
              // arrived twice or the user just refetched), keep the cache
              // unchanged rather than duplicating the tile.
              if (
                prev.assets.some((a) => a.id === incoming.id) ||
                prev.batches.some((b) => b.assets.some((a) => a.id === incoming.id))
              ) {
                return prev;
              }
              const batches = prev.batches.slice();
              const idx = batches.findIndex((b) => b.batchId === incomingBatchId);
              if (idx >= 0) {
                batches[idx] = {
                  ...batches[idx],
                  assets: [...batches[idx].assets, incoming],
                };
              } else {
                batches.push({
                  batchId: incomingBatchId,
                  batchLabel: incomingBatchLabel,
                  assets: [incoming],
                });
              }
              return {
                ...prev,
                batches,
                assets: [...prev.assets, incoming],
              };
            });
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
          return;
        }
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
          positionX?: number;
          positionY?: number;
        };
        if (d.boardId !== boardId) return;
        // The canonical post-drop position just landed — drop any in-flight
        // ghost we're holding for this tile so the real tile takes over.
        if (d.positionX !== undefined || d.positionY !== undefined) {
          setRemoteDrags((prev) => {
            if (!prev.has(d.assetId)) return prev;
            const next = new Map(prev);
            next.delete(d.assetId);
            return next;
          });
          clearRemoteDragTimer(d.assetId);
        }
        queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) => {
          if (!prev) return prev;
          const patchAsset = <T extends { id: string }>(a: T): T => {
            if (a.id !== d.assetId) return a;
            return {
              ...a,
              ...(d.content !== undefined ? { content: d.content } : {}),
              ...(d.positionX !== undefined ? { positionX: d.positionX } : {}),
              ...(d.positionY !== undefined ? { positionY: d.positionY } : {}),
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
      if (t === "board_access_revoked") {
        const d = msg.data as { boardId?: string };
        if (!d?.boardId || d.boardId !== boardId) return;
        // The owner just revoked our access. Drop every cached entry tied
        // to this board so the chat panel and board view can't keep
        // displaying messages or assets we're no longer allowed to see,
        // tell the user what happened, and bounce them back to the boards
        // home. The REST endpoints are already gated on the share row, so
        // any in-flight refetch will return 404 — this just prevents the
        // stale UI from sitting there until the next refresh.
        queryClient.removeQueries({ queryKey: ["/api/boards", boardId] });
        queryClient.removeQueries({ queryKey: ["/api/boards", boardId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
        toast({
          title: "Access removed",
          description: "The owner removed you from this board.",
        });
        setLocation("/boards");
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

  // Send presence_join whenever we have a live socket and a board id, and
  // presence_leave when leaving the page (or switching to another board).
  // We re-send the join after a reconnect because the server's presence
  // map is purged when the underlying socket closes.
  useEffect(() => {
    if (!boardId || !wsConnected) return;
    wsSend({ type: "presence_join", boardId });
    return () => {
      // Send a final cursor leave so peers drop our pointer instantly on
      // SPA navigation, instead of waiting on their idle timer.
      wsSend({ type: "cursor", boardId, isLeave: true });
      wsSend({ type: "presence_leave", boardId });
    };
  }, [boardId, wsConnected, wsSend]);

  // Clear typing indicators and viewer list when navigating between boards
  // so the next board's header doesn't briefly show stale collaborators.
  useEffect(() => {
    setPresenceViewers([]);
    setTypingUsers({});
    for (const t of Object.values(typingTimersRef.current)) clearTimeout(t);
    typingTimersRef.current = {};
    setRemoteDrags(new Map());
    for (const t of Object.values(remoteDragTimersRef.current)) clearTimeout(t);
    remoteDragTimersRef.current = {};
    setRemoteCursors(new Map());
    for (const t of Object.values(remoteCursorTimersRef.current)) clearTimeout(t);
    remoteCursorTimersRef.current = {};
  }, [boardId]);

  // Throttled "I'm typing" beacon for the chat input. Re-sends every 2s while
  // the user keeps typing so the recipients' 5s expiry timer keeps being
  // reset; sends a final `false` when they stop or send.
  const lastTypingPingRef = useRef<number>(0);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChatTypingChange = useCallback(
    (isTyping: boolean) => {
      if (!boardId || !wsConnected) return;
      if (isTyping) {
        const now = Date.now();
        if (now - lastTypingPingRef.current > 2000) {
          wsSend({ type: "typing", boardId, isTyping: true });
          lastTypingPingRef.current = now;
        }
        if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = setTimeout(() => {
          wsSend({ type: "typing", boardId, isTyping: false });
          lastTypingPingRef.current = 0;
        }, 3000);
      } else {
        if (stopTypingTimerRef.current) {
          clearTimeout(stopTypingTimerRef.current);
          stopTypingTimerRef.current = null;
        }
        wsSend({ type: "typing", boardId, isTyping: false });
        lastTypingPingRef.current = 0;
      }
    },
    [boardId, wsConnected, wsSend],
  );

  // Build a stable list of "other" viewers (excluding me) for header avatars.
  const currentUserIdStr = user?.id ? String(user.id) : null;
  const otherViewers = useMemo(
    () => presenceViewers.filter((v) => v.userId !== currentUserIdStr),
    [presenceViewers, currentUserIdStr],
  );
  const typingNames = useMemo(() => Object.values(typingUsers), [typingUsers]);

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

      const buildBody = (overrideProvider?: string) => ({
        message: text,
        mode,
        provider: overrideProvider ?? provider,
        generationMode,
        referencedAssetIds,
        ...(provider === "seedance" && !overrideProvider ? { seedanceOptions } : {}),
        ...(mode === "brainstorm" ? { chatModel } : {}),
      });

      // Use raw fetch so we can inspect the error body before throwing,
      // which lets us auto-recover from known codes (e.g. v2v_luma_unavailable).
      const { getAuthHeaders } = await import("@/lib/authToken");
      const doFetch = (body: object, signal?: AbortSignal) =>
        fetch(`/api/boards/${boardId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify(body),
          signal,
        });

      const res = await doFetch(buildBody(), controller.signal);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? `${res.status}: ${res.statusText}`);
      }
      return data;
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
      // Try to parse a structured server error for a friendlier message.
      let errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.code === "v2v_disabled") {
          errText = "Video-to-video is disabled in this build. Use Text-to-Video or Image-to-Video.";
        } else if (parsed?.error) {
          errText = parsed.error;
        }
      } catch {
        // not JSON, use as-is
      }
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

  const updateChatHistoryCap = useMutation({
    mutationFn: async (cap: number) => {
      const res = await apiRequest("PATCH", `/api/boards/${boardId}`, {
        chatHistoryCap: cap,
      });
      return res.json();
    },
    onSuccess: (data: { chatHistoryCap?: number }) => {
      // Patch the cached board so the input + auto-trim path immediately
      // reflect the new cap without waiting for a refetch.
      queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) =>
        prev
          ? { ...prev, chatHistoryCap: data?.chatHistoryCap ?? prev.chatHistoryCap }
          : prev,
      );
      toast({
        title: "Chat history limit updated",
        description: `Keeping the last ${data?.chatHistoryCap ?? "?"} messages on this board.`,
      });
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({
        title: "Couldn't update chat limit",
        description: errText,
        variant: "destructive",
      });
    },
  });

  // Clearing the chat is an irreversible hard delete on the server. To give
  // owners a safety net for misclicks, we defer the actual DELETE by 10s and
  // surface an "Undo" toast (matching the upload-cancel pattern above). The
  // local transcript is wiped immediately so the panel reflects the action,
  // but the server isn't touched until the undo window expires.
  const CLEAR_UNDO_WINDOW_MS = 10_000;
  const pendingClearRef = useRef<{
    snapshot: ChatMessage[];
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [isClearingChat, setIsClearingChat] = useState(false);

  const performClearOnServer = useCallback(async () => {
    if (!boardId) return;
    try {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/messages`);
      await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "messages"] });
    } catch (e) {
      // The local transcript was already wiped optimistically; if the server
      // delete fails the UI must not stay falsely empty. Reset hydration so
      // the next /messages query overwrites local state with the server's
      // truth, and refetch immediately.
      hydratedBoardRef.current = null;
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "messages"] });
      const errText = (e as Error)?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't clear chat", description: errText, variant: "destructive" });
    }
  }, [boardId, toast]);

  const handleClearChat = useCallback(() => {
    if (pendingClearRef.current) return;
    if (messages.length === 0) return;
    const snapshot = messages;
    setMessages([]);
    setIsClearingChat(true);
    const timer = setTimeout(() => {
      pendingClearRef.current = null;
      setIsClearingChat(false);
      void performClearOnServer();
    }, CLEAR_UNDO_WINDOW_MS);
    pendingClearRef.current = { snapshot, timer };
    toast({
      title: "Chat cleared",
      description: "Messages will be permanently deleted in 10 seconds.",
      duration: CLEAR_UNDO_WINDOW_MS,
      action: (
        <ToastAction
          altText="Undo clearing the chat"
          onClick={() => {
            const pending = pendingClearRef.current;
            if (!pending) return;
            clearTimeout(pending.timer);
            pendingClearRef.current = null;
            setMessages(pending.snapshot);
            setIsClearingChat(false);
            toast({
              title: "Chat restored",
              description: "We brought your messages back.",
            });
          }}
          data-testid="button-undo-clear-chat"
        >
          Undo
        </ToastAction>
      ),
    });
  }, [messages, performClearOnServer, toast]);

  // If the user navigates away while a clear is still pending, commit it now
  // so the server matches their last visible action instead of silently
  // discarding the delete.
  useEffect(
    () => () => {
      const pending = pendingClearRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingClearRef.current = null;
      void performClearOnServer();
    },
    [performClearOnServer],
  );

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

  // Leave / delete both use the shared optimistic mutations
  // (see use-leave-board.ts and use-delete-board.ts) so the grid's list cache
  // stays in sync with the detail page and the toast copy + endpoint paths
  // can't drift between surfaces. The hooks handle cache rollback + toasts;
  // the detail page only adds navigation back to /boards on success.
  const leaveBoard = useLeaveBoardMutation();
  const leaveBoardFromDetail = () => {
    if (!boardId) return;
    leaveBoard.mutate(boardId, {
      onSuccess: () => setLocation("/boards"),
    });
  };
  const deleteBoard = useDeleteBoardMutation();
  const deleteBoardFromDetail = () => {
    if (!boardId) return;
    deleteBoard.mutate(boardId, {
      onSuccess: () => setLocation("/boards"),
    });
  };

  // Rename uses the shared optimistic mutation (see use-rename-board.ts) so
  // the new title appears instantly in the header (and inside the chat panel,
  // which reads `board.title` straight from the same cache entry) and the
  // home grid stays in sync without any duplicated rollback / toast logic.
  const renameBoard = useRenameBoardMutation();

  // Inline title editing: only owners can flip into edit mode. We keep the
  // draft in local state so a stray cache update mid-edit (e.g. a presence
  // ping refetch) doesn't clobber what the user is typing.
  const BOARD_TITLE_MAX = 200;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const startEditingTitle = useCallback(() => {
    const current = boardQuery.data?.title ?? "";
    setTitleDraft(current);
    setIsEditingTitle(true);
  }, [boardQuery.data?.title]);
  const cancelTitleEdit = useCallback(() => {
    setIsEditingTitle(false);
  }, []);
  const commitTitleEdit = useCallback(() => {
    const trimmed = titleDraft.trim();
    const currentTitle = (boardQuery.data?.title ?? "").trim();
    // No-op when blank, unchanged, or over the cap. We silently dismiss
    // edit mode in those cases so blur-without-change doesn't fire a
    // useless PATCH or surface an error toast.
    if (
      !boardId ||
      trimmed.length === 0 ||
      trimmed.length > BOARD_TITLE_MAX ||
      trimmed === currentTitle
    ) {
      setIsEditingTitle(false);
      return;
    }
    renameBoard.mutate({ boardId, title: trimmed });
    setIsEditingTitle(false);
  }, [titleDraft, boardQuery.data?.title, renameBoard, boardId]);

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

  const moveAssets = useMutation({
    mutationFn: async (
      moves: Array<{ id: string; positionX: number; positionY: number }>,
    ) => {
      if (moves.length === 0) return [];
      // Use the bulk endpoint so a group drag is a single atomic round-trip
      // instead of one PATCH per tile. Server applies the whole batch in a
      // transaction — the group never lands half-moved.
      const res = await apiRequest(
        "PATCH",
        `/api/boards/${boardId}/assets/positions`,
        { moves },
      );
      return res.json();
    },
    onMutate: (moves) => {
      // Optimistic: update cached positions immediately so dropped tiles
      // don't snap back to their old spot while the PATCHes are in flight.
      const byId = new Map(moves.map((m) => [m.id, m] as const));
      queryClient.setQueryData<BoardResponse>(["/api/boards", boardId], (prev) => {
        if (!prev) return prev;
        const patch = <T extends { id: string }>(a: T): T => {
          const m = byId.get(a.id);
          return m ? { ...a, positionX: m.positionX, positionY: m.positionY } : a;
        };
        return {
          ...prev,
          batches: prev.batches.map((b) => ({ ...b, assets: b.assets.map(patch) })),
          assets: prev.assets.map(patch),
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
    onError: (e: Error) => {
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({ title: "Couldn't move tiles", description: errText, variant: "destructive" });
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
      // The Video intent is a guided, image-first flow: generate image
      // options, pick one, then animate it with Luma/VEO. Spell the steps out
      // so the user doesn't expect a one-click text-to-video result.
      const seedContent =
        seedParams.intent === "video"
          ? [
              "Here's how the video flow works:",
              "1) I'll generate a few image options from your prompt.",
              "2) Click the image you like best on the board to select it.",
              "3) Pick Luma or Google VEO in the Build bar.",
              "4) Send again to animate that image into a video.",
              "",
              `Press send to generate the image options: "${seedParams.seed}"`,
            ].join("\n")
          : `Seeded from ${sourceLabel}. Press send to start: "${seedParams.seed}"`;
      setMessages((m) => [
        ...m,
        {
          id: `seed-${boardId}`,
          role: "assistant",
          content: seedContent,
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
          {board.isOwner !== false && isEditingTitle ? (
            <input
              ref={titleInputRef}
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitleEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelTitleEdit();
                }
              }}
              onBlur={commitTitleEdit}
              maxLength={BOARD_TITLE_MAX}
              aria-label="Board name"
              placeholder="Board name"
              className="text-[10px] font-semibold tracking-wider uppercase bg-white border border-neutral-300 rounded px-2 py-1 outline-none focus:border-neutral-500 text-neutral-900 min-w-[160px] dark:bg-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-500 dark:text-neutral-100"
              data-testid="input-board-title"
            />
          ) : board.isOwner !== false ? (
            <button
              type="button"
              onClick={startEditingTitle}
              title="Rename board"
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60"
              data-testid="button-title"
            >
              <span className="text-[10px] font-semibold tracking-wider text-neutral-600 dark:text-neutral-300">
                {titleHead} {titleTail && <span className="text-neutral-900 dark:text-neutral-100">{titleTail}</span>}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2 py-1"
              data-testid="text-board-title"
            >
              <span className="text-[10px] font-semibold tracking-wider text-neutral-600 dark:text-neutral-300">
                {titleHead} {titleTail && <span className="text-neutral-900 dark:text-neutral-100">{titleTail}</span>}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {board.isShared && otherViewers.length > 0 && (
            <PresenceAvatars viewers={otherViewers} />
          )}
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
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            title="Board settings"
            aria-label="Board settings"
            className="w-8 h-8 rounded hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60"
            data-testid="button-settings"
          >
            <SettingsIcon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </button>
          {board.isOwner !== false ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (deleteBoard.isPending) return;
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm(
                      "Delete this board and all of its assets? This cannot be undone.",
                    )
                  )
                    return;
                  deleteBoardFromDetail();
                }}
                disabled={deleteBoard.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-300 text-neutral-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-[12px] font-medium disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:hover:border-red-900"
                data-testid="button-delete-board"
                title="Delete this board"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteBoard.isPending ? "Deleting…" : "Delete"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900"
                data-testid="button-share"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (leaveBoard.isPending) return;
                setLeaveConfirmOpen(true);
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

      <div className="flex-1 flex overflow-hidden relative">
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
            onMoveAssets={(moves) => moveAssets.mutate(moves)}
            onTileDragging={(moves, isEnd) => {
              if (!boardId || !wsConnected) return;
              wsSend({ type: "asset_dragging", boardId, moves, isEnd });
            }}
            remoteDrags={remoteDrags}
            onCursorMove={(x, y) => {
              if (!boardId || !wsConnected) return;
              if (x === null || y === null) {
                wsSend({ type: "cursor", boardId, isLeave: true });
              } else {
                wsSend({ type: "cursor", boardId, x, y });
              }
            }}
            remoteCursors={remoteCursors}
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
        {/* Generation confirmation overlay — shown over the whole board+chat area */}
        {pendingGenText !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-6 w-80 flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-neutral-200 border-t-neutral-700 dark:border-neutral-700 dark:border-t-neutral-200 animate-spin" />
              <div className="text-center">
                <p className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">Ready to generate?</p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1">Want to make more changes before starting?</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-[12px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  onClick={() => {
                    setPendingGenText(null);
                    setMode("brainstorm");
                  }}
                >
                  Yes, make changes
                </button>
                <button
                  type="button"
                  className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[12px] font-medium hover:bg-neutral-700 dark:hover:bg-neutral-300 transition-colors"
                  onClick={() => {
                    const text = pendingGenText;
                    setPendingGenText(null);
                    sendChat.mutate(text);
                  }}
                >
                  Generate now
                </button>
              </div>
            </div>
          </div>
        )}
        {chatOpen && (
          <>
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
              // In create mode, show a confirmation step before firing the
              // generation API so the user can make last-minute changes.
              if (mode === "create") {
                setPendingGenText(text);
                return;
              }
              sendChat.mutate(text);
            }}
            isSending={sendChat.isPending}
            onStop={handleStopChat}
            pendingInput={pendingInput}
            onPendingInputApplied={() => setPendingInput(null)}
            onClearChat={
              board.isOwner !== false ? handleClearChat : undefined
            }
            isClearingChat={isClearingChat}
            chatHistoryCap={board.chatHistoryCap}
            onChangeChatHistoryCap={
              board.isOwner !== false
                ? (n) => updateChatHistoryCap.mutate(n)
                : undefined
            }
            isSavingChatHistoryCap={updateChatHistoryCap.isPending}
            typingUserNames={board.isShared ? typingNames : []}
            onTypingChange={board.isShared ? handleChatTypingChange : undefined}
            width={chatPanelWidth}
            onWidthChange={handleChatPanelWidthChange}
            onCollapse={() => setChatOpen(false)}
          />
          </>
        )}
      </div>
      <ShareBoardDialog boardId={board.id} open={shareOpen} onOpenChange={setShareOpen} />
      <DrawingModal open={drawOpen} onCancel={() => setDrawOpen(false)} onSave={handleSaveDrawing} />
      <RecordModal open={recordOpen} onCancel={() => setRecordOpen(false)} onSave={handleSaveRecording} />
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent data-testid="dialog-leave-board">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this board?</AlertDialogTitle>
            <AlertDialogDescription>
              {`You'll lose access to "${board.title}". The owner will need to share it with you again to get back in.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-leave-board">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={leaveBoard.isPending}
              onClick={(e) => {
                e.preventDefault();
                leaveBoardFromDetail();
                setLeaveConfirmOpen(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-leave-board"
            >
              Leave board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
