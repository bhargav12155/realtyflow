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
    | "avatar_ready";
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
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${userId}`;

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
          if (showToast && message.type !== "notification") {
            toast({
              title: formatMessageType(message.type),
              description: message.data.message || JSON.stringify(message.data),
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
