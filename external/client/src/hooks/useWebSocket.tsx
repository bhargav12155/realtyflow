import { useToast } from "@/hooks/use-toast";
import { useCallback, useEffect, useRef, useState } from "react";

interface WebSocketMessage {
  type:
    | "content_published"
    | "social_post_scheduled"
    | "notification"
    | "status_update"
    | "photo_generated"
    | "video_created"
    | "avatar_group_created"
    | "motion_added"
    | "sound_effect_added"
    | "avatar_ready"
    | "video_generation_complete"
    | "video_generation_failed"
    | "look_generation_complete"
    | "look_generation_failed"
    | "motion_complete"
    | "sjinn_video_ready"
    | "sora2_video_ready"
    | "voice_clone_complete"
    | "voice_clone_failed"
    | "board_asset_status"
    | "board_asset_updated"
    | "board_auto_eval"
    | "board_access_revoked"
    | "notification_created"
    | "photo_avatar_status_update"
    | "board_presence"
    | "board_typing"
    | "board_asset_dragging"
    | "board_cursor";
  data: any;
  timestamp: string;
  userId?: number;
  link?: string;
}

interface UseWebSocketOptions {
  userId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  autoConnect?: boolean;
  showToast?: boolean;
}

const SILENT_TOAST_TYPES = new Set<WebSocketMessage["type"]>([
  "notification",
  "board_presence",
  "board_typing",
  "board_cursor",
  "board_asset_dragging",
  "board_asset_updated",
  "photo_avatar_status_update",
]);

function summarizeStatusToast(message: WebSocketMessage): { title: string; description: string } | null {
  const data = (message.data ?? {}) as {
    scope?: string;
    status?: string;
    kind?: string;
    rejectionReason?: string | null;
    message?: string;
  };
  const isAssetStatus = message.type === "board_asset_status" || data.scope === "board_asset";
  if (!isAssetStatus) return null;
  if (typeof data.message === "string" && data.message.trim().length > 0) {
    return { title: "Board update", description: data.message.trim() };
  }
  if (data.status === "failed" || (data.rejectionReason && data.rejectionReason.trim().length > 0)) {
    return {
      title: "Generation failed",
      description: data.rejectionReason?.trim() || "An asset failed to generate.",
    };
  }
  if (data.status === "ready" || data.status === "completed") {
    const kind = data.kind ? `${data.kind} ` : "";
    return { title: "Asset ready", description: `Your ${kind}asset is ready.` };
  }
  // Hide noisy in-progress statuses like queued/generating.
  return null;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { userId, onMessage, autoConnect = false, showToast = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Don't connect if no userId provided
    if (!userId) {
      console.warn("⚠️ Cannot connect to WebSocket: No userId provided");
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Auth is enforced server-side via the httpOnly authToken cookie.
      // The userId query param is for diagnostics only — the server ignores it.
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${encodeURIComponent(userId)}`;

      console.log("🔌 Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsConnected(true);

        if (showToast) {
          toast({
            title: "Connected",
            description: "Real-time updates enabled",
            duration: 2000,
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log("📨 WebSocket message:", message);

          setLastMessage(message);

          // Call custom handler if provided
          if (onMessage) {
            onMessage(message);
          }

          // Show toast notifications for important events
          if (showToast && !SILENT_TOAST_TYPES.has(message.type)) {
            const summary = summarizeStatusToast(message);
            if (summary === null && (message.type === "status_update" || message.type === "board_asset_status")) {
              return;
            }
            toast({
              title: summary?.title || formatMessageType(message.type),
              description:
                summary?.description ||
                (typeof message.data?.message === "string" && message.data.message.trim().length > 0
                  ? message.data.message
                  : "New update received."),
              duration: 4000,
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket disconnected");
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("🔄 Attempting to reconnect...");
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [userId, showToast, toast]);
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected. Cannot send message.");
    }
  }, []);

  useEffect(() => {
    if (autoConnect && userId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // Only reconnect when userId or autoConnect changes, not when connect function changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, userId]);

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    send,
  };
}

function formatMessageType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
