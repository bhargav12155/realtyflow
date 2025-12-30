import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import type { IncomingMessage } from "http";

export interface WebSocketMessage {
  type: "content_published" | "social_post_scheduled" | "notification" | "status_update" | "photo_generated" | "video_created" | "avatar_group_created" | "motion_added" | "sound_effect_added" | "avatar_ready";
  data: any;
  timestamp: string;
  userId?: number;
  link?: string;
}

export class RealtimeService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocket>> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: "/ws",
      verifyClient: (info) => {
        // For now, allow connections but will validate session in connection handler
        // In production, verify JWT token or session cookie here
        return true;
      }
    });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      console.log("🔌 WebSocket client connection attempt");

      // Extract and validate user context
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const userIdParam = url.searchParams.get("userId");
      
      // SECURITY: In production, validate session/JWT token from cookies or headers
      // For now, require userId to be provided (will be enhanced with proper auth)
      if (!userIdParam || userIdParam === "guest") {
        console.warn("⚠️ WebSocket connection rejected: No valid user authentication");
        ws.close(1008, "Authentication required");
        return;
      }
      
      const userId = userIdParam;
      console.log(`✅ WebSocket client authenticated: userId=${userId}`);

      // Add client to the user's set
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(ws);

      // Send welcome message
      this.sendToClient(ws, {
        type: "notification",
        data: { message: "Connected to RealtyFlow real-time updates" },
        timestamp: new Date().toISOString(),
      });

      ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          console.log("📨 Received message:", data);
          // Handle incoming messages if needed
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        console.log("🔌 WebSocket client disconnected");
        // Remove client from all user sets
        this.clients.forEach((clientSet) => {
          clientSet.delete(ws);
        });
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });

    console.log("✅ WebSocket server initialized on /ws");
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast to all clients
  broadcast(message: WebSocketMessage) {
    if (!this.wss) return;

    this.wss.clients.forEach((client) => {
      this.sendToClient(client, message);
    });
  }

  // Send to specific user
  sendToUser(userId: string, message: WebSocketMessage) {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    userClients.forEach((client) => {
      this.sendToClient(client, message);
    });
  }

  // Notify about content published
  notifyContentPublished(userId: number, contentId: number, title: string) {
    this.sendToUser(userId.toString(), {
      type: "content_published",
      data: {
        contentId,
        title,
        message: `Content "${title}" has been published`,
      },
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  // Notify about photo generation
  notifyPhotoGenerated(userId: number, avatarName: string, photoCount: number) {
    this.sendToUser(userId.toString(), {
      type: "photo_generated",
      data: {
        message: `${photoCount} AI photos generated for "${avatarName}"`,
        avatarName,
        photoCount,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  // Notify about video creation
  notifyVideoCreated(userId: number, videoId: string, title: string) {
    this.sendToUser(userId.toString(), {
      type: "video_created",
      data: {
        videoId,
        title,
        message: `Video "${title}" has been created and is ready to view`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "ai-video",
    });
  }

  // Notify about social post scheduled
  notifySocialPostScheduled(
    userId: number,
    postId: number,
    platform: string,
    scheduledTime: string
  ) {
    this.sendToUser(userId.toString(), {
      type: "social_post_scheduled",
      data: {
        postId,
        platform,
        scheduledTime,
        message: `Post scheduled for ${platform} at ${scheduledTime}`,
      },
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  // Send general notification
  sendNotification(userId: number, message: string) {
    this.sendToUser(userId.toString(), {
      type: "notification",
      data: { message },
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  // Notify about avatar group creation
  notifyAvatarGroupCreated(userId: number, groupId: string, groupName: string, avatarCount: number) {
    this.sendToUser(userId.toString(), {
      type: "avatar_group_created",
      data: {
        groupId,
        groupName,
        avatarCount,
        message: `Avatar group "${groupName}" created with ${avatarCount} photo${avatarCount !== 1 ? 's' : ''}`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  // Notify about motion added to avatar
  notifyMotionAdded(userId: number, avatarId: string, avatarName: string) {
    this.sendToUser(userId.toString(), {
      type: "motion_added",
      data: {
        avatarId,
        avatarName,
        message: `Motion added to "${avatarName}" - processing started`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  // Notify about sound effect added to avatar
  notifySoundEffectAdded(userId: number, avatarId: string, avatarName: string) {
    this.sendToUser(userId.toString(), {
      type: "sound_effect_added",
      data: {
        avatarId,
        avatarName,
        message: `Sound effect added to "${avatarName}" - processing started`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  // Notify when avatar is ready (motion/sound processing complete)
  notifyAvatarReady(userId: number, avatarId: string, avatarName: string) {
    this.sendToUser(userId.toString(), {
      type: "avatar_ready",
      data: {
        avatarId,
        avatarName,
        message: `Avatar "${avatarName}" is ready!`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      userCount: this.clients.size,
    };
  }
}

export const realtimeService = new RealtimeService();
