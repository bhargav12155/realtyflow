import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import type { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "./middleware/auth";

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function authenticateRequest(req: IncomingMessage): { userId: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  let token: string | undefined;
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    token = auth.slice("Bearer ".length).trim();
  }
  if (!token) {
    const cookies = parseCookieHeader(
      Array.isArray(req.headers.cookie) ? req.headers.cookie.join("; ") : req.headers.cookie,
    );
    if (cookies.authToken) token = cookies.authToken;
  }
  if (!token) {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const t = url.searchParams.get("token");
      if (t) token = t;
    } catch {
      /* ignore */
    }
  }
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    if (!decoded || decoded.id === undefined || decoded.id === null) return null;
    return { userId: String(decoded.id) };
  } catch {
    return null;
  }
}

export interface WebSocketMessage {
  type: "content_published" | "social_post_scheduled" | "notification" | "status_update" | "photo_generated" | "video_created" | "avatar_group_created" | "motion_added" | "sound_effect_added" | "avatar_ready" | "training_status_update" | "video_generation_complete" | "video_generation_failed" | "motion_complete" | "look_generation_complete" | "look_generation_failed" | "whatsapp_bulk_progress" | "whatsapp_bulk_complete" | "sjinn_video_ready" | "sora2_video_ready" | "voice_clone_complete" | "voice_clone_failed" | "board_asset_status" | "board_asset_updated" | "board_auto_eval" | "notification_created" | "admin_alert";
  data: any;
  timestamp: string;
  userId?: number;
  link?: string;
}

export class RealtimeService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocket>> = new Map();
  // Sockets owned by users whose `role === "admin"`. Populated lazily at
  // connection time and cleaned up on close. Used by `broadcastAdminAlert`
  // so internal operational alerts are scoped to operators only and never
  // leak to ordinary users.
  private adminClients: Set<WebSocket> = new Set();

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      verifyClient: (info, done) => {
        // SECURITY: authenticate at the upgrade level so unauthenticated
        // sockets are rejected before the handshake completes. The user
        // identity is derived only from a verified JWT (cookie / Bearer
        // token / ?token=). Any client-supplied ?userId= is ignored.
        const auth = authenticateRequest(info.req);
        if (!auth) {
          console.warn("⚠️ WebSocket upgrade rejected: invalid or missing JWT");
          return done(false, 401, "Unauthorized");
        }
        (info.req as any)._wsUserId = auth.userId;
        return done(true);
      },
    });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      // The verified userId was stashed by verifyClient. Re-verify defensively
      // in case the upgrade happened without it (should not occur in practice).
      const verified = (req as any)._wsUserId as string | undefined;
      const fallback = verified ? { userId: verified } : authenticateRequest(req);
      if (!fallback) {
        console.warn("⚠️ WebSocket connection rejected: authentication missing post-upgrade");
        ws.close(1008, "Authentication required");
        return;
      }
      const userId = fallback.userId;
      console.log(`✅ WebSocket client authenticated: userId=${userId}`);

      // Add client to the user's set
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(ws);

      // Lazily resolve the user's role so admin-only broadcasts can target
      // the right sockets. Done as a dynamic import to avoid a circular
      // import between websocket and storage. Failures are swallowed so
      // an unrelated DB hiccup never tears down a websocket connection.
      void (async () => {
        try {
          const { storage } = await import("./storage");
          const user = await storage.getUser(userId);
          if (user && (user as { role?: string }).role === "admin") {
            this.adminClients.add(ws);
          }
        } catch (err) {
          console.warn(
            "[websocket] failed to resolve admin role for socket",
            err,
          );
        }
      })();

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
        this.adminClients.delete(ws);
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

  // Notify about a HeyGen photo-avatar lifecycle update (training progress,
  // look generation, consent change, etc). Used by the v3 webhook handler so
  // the dashboard can react without polling. `userId` may be a string here
  // because HeyGen events are keyed by app-side user id (uuid).
  notifyPhotoAvatarStatus(
    userId: string | number,
    payload: {
      groupId?: string;
      lookId?: string;
      status: string;
      eventType: string;
      message?: string;
    },
  ) {
    this.sendToUser(String(userId), {
      type: "photo_avatar_status_update",
      data: payload,
      timestamp: new Date().toISOString(),
      userId: typeof userId === "number" ? userId : undefined,
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

  // Notify about training status change
  notifyTrainingStatusUpdate(userId: number, groupId: string, groupName: string, status: string) {
    this.sendToUser(userId.toString(), {
      type: "training_status_update",
      data: {
        groupId,
        groupName,
        status,
        message: status === "ready" 
          ? `Avatar group "${groupName}" training is complete!` 
          : `Avatar group "${groupName}" training status: ${status}`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  // Notify about video generation complete (from HeyGen webhook)
  notifyVideoGenerationComplete(userId: number, videoId: string, videoUrl: string, title?: string) {
    this.sendToUser(userId.toString(), {
      type: "video_generation_complete",
      data: {
        videoId,
        videoUrl,
        title: title || "Your video",
        message: `Video "${title || 'Your video'}" is ready to view!`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "ai-video",
    });
  }

  // Notify about video generation failed (from HeyGen webhook)
  notifyVideoGenerationFailed(userId: number, videoId: string, error: string, title?: string) {
    this.sendToUser(userId.toString(), {
      type: "video_generation_failed",
      data: {
        videoId,
        title: title || "Your video",
        error,
        message: `Video "${title || 'Your video'}" generation failed: ${error}`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "ai-video",
    });
  }

  // Notify about motion animation complete
  notifyMotionComplete(userId: number, avatarId: string, avatarName: string, motionPreviewUrl?: string) {
    this.sendToUser(userId.toString(), {
      type: "motion_complete",
      data: {
        avatarId,
        avatarName,
        motionPreviewUrl,
        message: `Motion animation for "${avatarName}" is complete!`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  notifyLookGenerationComplete(userId: number, groupId: string, lookName: string, imageCount: number) {
    this.sendToUser(userId.toString(), {
      type: "look_generation_complete" as any,
      data: {
        groupId,
        lookName,
        imageCount,
        message: `AI look "${lookName}" is ready! ${imageCount} image${imageCount !== 1 ? 's' : ''} generated.`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  notifyLookGenerationFailed(userId: number, groupId: string, lookName: string, error: string) {
    this.sendToUser(userId.toString(), {
      type: "look_generation_failed" as any,
      data: {
        groupId,
        lookName,
        error,
        message: `AI look "${lookName}" generation failed: ${error}`,
      },
      timestamp: new Date().toISOString(),
      userId,
      link: "photo-avatars",
    });
  }

  // Notify when a custom voice clone has finished successfully
  notifyVoiceCloneComplete(
    userId: string,
    voiceId: string,
    voiceName: string,
    heygenVoiceId?: string | null,
  ) {
    this.sendToUser(userId, {
      type: "voice_clone_complete",
      data: {
        voiceId,
        voiceName,
        heygenVoiceId: heygenVoiceId ?? null,
        message: `Voice "${voiceName}" is ready to use!`,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Notify when a custom voice clone has failed
  notifyVoiceCloneFailed(
    userId: string,
    voiceId: string,
    voiceName: string,
    error: string,
  ) {
    this.sendToUser(userId, {
      type: "voice_clone_failed",
      data: {
        voiceId,
        voiceName,
        error,
        message: `Voice "${voiceName}" clone failed: ${error}`,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Notify when a board asset's generation status changes
  notifyBoardAssetStatus(
    userId: string,
    payload: {
      boardId: string;
      batchId: string;
      assetId: string;
      status: string;
      assetUrl?: string | null;
      thumbnailUrl?: string | null;
      durationSeconds?: number | null;
      modelLabel?: string | null;
      provider?: string | null;
      rejectionReason?: string | null;
    },
  ) {
    this.sendToUser(userId, {
      type: "board_asset_status",
      data: payload,
      timestamp: new Date().toISOString(),
    });
  }

  // Notify all collaborators on a board that an asset's editable fields
  // (e.g. content for sticky/text/frame inline edits) have been updated.
  // Sent to each provided userId so every viewer's canvas refreshes live.
  notifyBoardAssetUpdated(
    userIds: string[],
    payload: {
      boardId: string;
      batchId: string;
      assetId: string;
      content?: string | null;
    },
  ) {
    const message: WebSocketMessage = {
      type: "board_asset_updated",
      data: payload,
      timestamp: new Date().toISOString(),
    };
    for (const uid of userIds) {
      this.sendToUser(uid, message);
    }
  }

  // Notify when a board batch finishes auto-evaluation
  notifyBoardAutoEval(
    userId: string,
    payload: {
      boardId: string;
      batchId: string;
      winnerAssetId: string;
      rejected: Array<{ assetId: string; reason: string }>;
      modelUsed: string;
    },
  ) {
    this.sendToUser(userId, {
      type: "board_auto_eval",
      data: payload,
      timestamp: new Date().toISOString(),
    });
  }

  // Notify a recipient that a new in-app notification has been created.
  // Sent so the bell badge can refresh without waiting for the polling
  // interval. Falls back gracefully when the recipient has no socket.
  notifyNotificationCreated(
    userId: string,
    payload: {
      notificationId: string;
      type: string;
      data?: unknown;
    },
  ) {
    this.sendToUser(userId, {
      type: "notification_created",
      data: payload,
      timestamp: new Date().toISOString(),
    });
  }

  // Send an admin alert to admin sockets only. The dashboard's notification
  // bell renders these so operators are paged about infrastructure-level
  // issues (e.g. HeyGen response shape drift) without waiting for a user
  // to file a bug report. Non-admin sockets MUST NOT receive these — the
  // payload's `context` may include internal details (endpoints, ids,
  // schema-drift summaries) that ordinary users should not see.
  broadcastAdminAlert(payload: {
    source: string;
    severity: "info" | "warning" | "error";
    title: string;
    message: string;
    context?: Record<string, unknown>;
  }) {
    const message: WebSocketMessage = {
      type: "admin_alert",
      data: payload,
      timestamp: new Date().toISOString(),
    };
    this.adminClients.forEach((client) => {
      this.sendToClient(client, message);
    });
  }

  // Test/diagnostics helper: returns the number of admin sockets currently
  // tagged. Used in tests to assert admin scoping.
  getAdminSocketCount(): number {
    return this.adminClients.size;
  }

  notifySjinnVideoReady(userId: string, videoUrl: string, taskId: string) {
    this.sendToUser(userId, {
      type: "sjinn_video_ready",
      data: {
        taskId,
        videoUrl,
        message: `Your AI video is ready! View it here: ${videoUrl}`,
      },
      timestamp: new Date().toISOString(),
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
