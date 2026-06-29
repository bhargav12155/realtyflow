import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import type { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "./middleware/auth";

const DEBUG_WEBSOCKET_LOGS =
  process.env.DEBUG_WEBSOCKET_LOGS === "1"
  || process.env.DEBUG_WEBSOCKET_LOGS === "true"
  || (process.env.DEBUG || "").split(",").map((v) => v.trim()).includes("websocket");
const WS_AUTH_REJECT_LOG_INTERVAL_MS = 30_000;

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
  type: "content_published" | "social_post_scheduled" | "notification" | "status_update" | "photo_generated" | "video_created" | "avatar_group_created" | "motion_added" | "sound_effect_added" | "avatar_ready" | "training_status_update" | "video_generation_complete" | "video_generation_failed" | "motion_complete" | "look_generation_complete" | "look_generation_failed" | "whatsapp_bulk_progress" | "whatsapp_bulk_complete" | "sjinn_video_ready" | "sora2_video_ready" | "voice_clone_complete" | "voice_clone_failed" | "board_asset_status" | "board_asset_updated" | "board_auto_eval" | "board_access_revoked" | "notification_created" | "admin_alert" | "board_presence" | "board_typing" | "board_asset_dragging" | "board_cursor";
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
  // Per-board presence tracking. Each entry stores the set of sockets that
  // joined the board's presence channel for a given user, plus the user's
  // display info so we can render avatars without an extra round trip on
  // the client. Sockets are removed on close or explicit `presence_leave`,
  // and the user entry is dropped once their last socket leaves.
  private boardPresence: Map<
    string,
    Map<string, { name: string | null; email: string | null; sockets: Set<WebSocket> }>
  > = new Map();
  // Reverse index: which boards each socket joined, so a single close can
  // tear down every membership without scanning the whole presence map.
  private socketBoards: WeakMap<WebSocket, Set<string>> = new WeakMap();
  // Cache of resolved {name, email} per userId so a chatty client (lots of
  // typing events) doesn't hammer storage. Best-effort only.
  private userInfoCache: Map<string, { name: string | null; email: string | null }> = new Map();
  private lastWsAuthRejectLogAt = 0;
  private suppressedWsAuthRejectCount = 0;

  private logWsUpgradeAuthReject() {
    if (DEBUG_WEBSOCKET_LOGS) {
      console.warn("⚠️ WebSocket upgrade rejected: invalid or missing JWT");
      return;
    }

    const now = Date.now();
    if (now - this.lastWsAuthRejectLogAt >= WS_AUTH_REJECT_LOG_INTERVAL_MS) {
      if (this.suppressedWsAuthRejectCount > 0) {
        console.warn(
          `⚠️ WebSocket upgrade rejected: invalid or missing JWT (plus ${this.suppressedWsAuthRejectCount} more in last ${Math.round(WS_AUTH_REJECT_LOG_INTERVAL_MS / 1000)}s)`,
        );
      } else {
        console.warn("⚠️ WebSocket upgrade rejected: invalid or missing JWT");
      }
      this.lastWsAuthRejectLogAt = now;
      this.suppressedWsAuthRejectCount = 0;
      return;
    }

    this.suppressedWsAuthRejectCount += 1;
  }

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      noServer: true,
    });

    server.on("upgrade", (req, socket, head) => {
      // Important: only consume upgrades for our realtime endpoint. Any
      // other upgrade path (for example Vite HMR in dev) must be ignored so
      // other listeners can handle it.
      const pathname = (req.url || "/").split("?")[0];
      if (pathname !== "/ws") {
        return;
      }

      const auth = authenticateRequest(req);
      if (!auth) {
        this.logWsUpgradeAuthReject();
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      (req as any)._wsUserId = auth.userId;
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit("connection", ws, req);
      });
    });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      // The verified userId was stashed by verifyClient. Re-verify defensively
      // in case the upgrade happened without it (should not occur in practice).
      const verified = (req as any)._wsUserId as string | undefined;
      const fallback = verified ? { userId: verified } : authenticateRequest(req);
      if (!fallback) {
        if (DEBUG_WEBSOCKET_LOGS) {
          console.warn("⚠️ WebSocket connection rejected: authentication missing post-upgrade");
        }
        ws.close(1008, "Authentication required");
        return;
      }
      const userId = fallback.userId;
      if (DEBUG_WEBSOCKET_LOGS) {
        console.log(`✅ WebSocket client authenticated: userId=${userId}`);
      }

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
          // Presence + typing are the only inbound messages we currently
          // accept. Anything else is logged so unexpected payloads don't
          // disappear silently, but is otherwise ignored.
          if (data && typeof data === "object" && typeof data.type === "string") {
            const boardId = typeof data.boardId === "string" ? data.boardId : null;
            if (data.type === "presence_join" && boardId) {
              void this.handlePresenceJoin(ws, userId, boardId);
              return;
            }
            if (data.type === "presence_leave" && boardId) {
              this.handlePresenceLeave(ws, userId, boardId);
              return;
            }
            if (data.type === "typing" && boardId) {
              this.handleTyping(ws, userId, boardId, !!data.isTyping);
              return;
            }
            if (data.type === "cursor" && boardId) {
              const isLeave = !!data.isLeave;
              const x = typeof data.x === "number" ? data.x : null;
              const y = typeof data.y === "number" ? data.y : null;
              if (isLeave || (x !== null && y !== null)) {
                void this.handleBoardCursor(
                  ws,
                  userId,
                  boardId,
                  isLeave ? null : { x: x as number, y: y as number },
                );
              }
              return;
            }
            if (data.type === "asset_dragging" && boardId) {
              const movesRaw = Array.isArray(data.moves) ? data.moves : [];
              const moves: Array<{
                id: string;
                positionX: number;
                positionY: number;
              }> = [];
              for (const m of movesRaw) {
                if (
                  m &&
                  typeof m === "object" &&
                  typeof m.id === "string" &&
                  typeof m.positionX === "number" &&
                  typeof m.positionY === "number"
                ) {
                  moves.push({
                    id: m.id,
                    positionX: Math.round(m.positionX),
                    positionY: Math.round(m.positionY),
                  });
                }
              }
              if (moves.length > 0 || data.isEnd) {
                void this.handleAssetDragging(
                  ws,
                  userId,
                  boardId,
                  moves,
                  !!data.isEnd,
                );
              }
              return;
            }
          }
          console.log("📨 Received message:", data);
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
        // Tear down any presence memberships this socket held so other
        // viewers see the user disappear from the header without waiting
        // for an idle timeout.
        const joinedBoards = this.socketBoards.get(ws);
        if (joinedBoards) {
          for (const bId of joinedBoards) {
            this.handlePresenceLeave(ws, userId, bId, { skipReverseIndex: true });
          }
          this.socketBoards.delete(ws);
        }
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

  // Notify when a board asset's generation status changes.
  //
  // When the change is the *creation* of a brand-new asset (e.g. a
  // collaborator just uploaded a tile, dropped a sticky, or saved a
  // drawing), pass `fullAsset` with the complete asset row so subscribers
  // can splice the tile into their cache directly — without that, the
  // client only knows the assetId and is forced to refetch the entire
  // board (every batch, every chat history slice) just to render the new
  // tile (Task #244). Status-only updates (queued → generating → ready
  // for an already-cached asset) can omit `fullAsset` since the patch
  // path doesn't need it.
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
      fullAsset?: unknown;
    },
  ) {
    this.sendToUser(userId, {
      type: "board_asset_status",
      data: payload,
      timestamp: new Date().toISOString(),
    });
  }

  // Notify all collaborators on a board that an asset's editable fields
  // (e.g. content for sticky/text/frame inline edits, or positionX/Y after
  // a drag) have been updated. Sent to each provided userId so every
  // viewer's canvas refreshes live.
  notifyBoardAssetUpdated(
    userIds: string[],
    payload: {
      boardId: string;
      batchId: string;
      assetId: string;
      content?: string | null;
      positionX?: number;
      positionY?: number;
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

    // Persist a notification record per admin user so the dashboard's
    // notification bell can render the alert after a page refresh — and
    // so admins who weren't online when the alert fired still see it
    // next time they sign in. Best-effort and fully async: a storage
    // failure must never prevent the realtime broadcast above from
    // happening, and the per-event reporters call this synchronously.
    void this.persistAdminAlertForAdmins(payload).catch((err) => {
      console.warn(
        "[websocket] failed to persist admin alert notification(s)",
        err,
      );
    });
  }

  private async persistAdminAlertForAdmins(payload: {
    source: string;
    severity: "info" | "warning" | "error";
    title: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    // Dynamic import to avoid a circular import between websocket and
    // storage (storage imports the realtimeService for board events).
    const { storage, isAdminAlertSnoozedFromUser } = await import("./storage");
    const users = await storage.getAllUsers();
    const admins = users.filter(
      (u) => (u as { role?: string }).role === "admin",
    );
    for (const admin of admins) {
      try {
        // Honor a per-admin snooze: while active, the realtime broadcast
        // above already reached connected admin sockets, but we skip the
        // notification row so the bell doesn't stack up during incidents.
        // The snooze is read from the user row we already loaded, so this
        // remains a synchronous check on the hot path.
        if (isAdminAlertSnoozedFromUser(admin)) {
          continue;
        }
        const notification = await storage.createNotification({
          userId: admin.id,
          type: "admin_alert",
          data: {
            source: payload.source,
            severity: payload.severity,
            title: payload.title,
            message: payload.message,
            context: payload.context ?? {},
          },
        });
        try {
          this.notifyNotificationCreated(admin.id, {
            notificationId: notification.id,
            type: notification.type,
            data: notification.data,
          });
        } catch {
          // The realtime push is just an optimization; the polling
          // fallback in NotificationsBell will pick it up on the next
          // refetch even if the socket push fails.
        }
      } catch (err) {
        console.warn(
          "[websocket] failed to persist admin alert notification",
          { adminId: admin.id, err },
        );
      }
    }
  }

  // Test/diagnostics helper: returns the number of admin sockets currently
  // tagged. Used in tests to assert admin scoping.
  getAdminSocketCount(): number {
    return this.adminClients.size;
  }

  // === Board presence ======================================================

  private async resolveUserInfo(
    userId: string,
  ): Promise<{ name: string | null; email: string | null }> {
    const cached = this.userInfoCache.get(userId);
    if (cached) return cached;
    let info: { name: string | null; email: string | null } = { name: null, email: null };
    try {
      const { storage } = await import("./storage");
      const u = await storage.getUser(userId);
      if (u) {
        info = {
          name: (u as { name?: string | null }).name ?? null,
          email: (u as { email?: string | null }).email ?? null,
        };
      }
    } catch (err) {
      console.warn("[websocket] failed to resolve user info for presence", err);
    }
    this.userInfoCache.set(userId, info);
    return info;
  }

  private async handlePresenceJoin(
    ws: WebSocket,
    userId: string,
    boardId: string,
  ): Promise<void> {
    const info = await this.resolveUserInfo(userId);
    let users = this.boardPresence.get(boardId);
    if (!users) {
      users = new Map();
      this.boardPresence.set(boardId, users);
    }
    let entry = users.get(userId);
    if (!entry) {
      entry = { name: info.name, email: info.email, sockets: new Set() };
      users.set(userId, entry);
    }
    entry.sockets.add(ws);
    let socketBoards = this.socketBoards.get(ws);
    if (!socketBoards) {
      socketBoards = new Set();
      this.socketBoards.set(ws, socketBoards);
    }
    socketBoards.add(boardId);
    this.broadcastBoardPresence(boardId);
  }

  private handlePresenceLeave(
    ws: WebSocket,
    userId: string,
    boardId: string,
    opts: { skipReverseIndex?: boolean } = {},
  ): void {
    const users = this.boardPresence.get(boardId);
    if (!users) return;
    const entry = users.get(userId);
    if (entry) {
      entry.sockets.delete(ws);
      if (entry.sockets.size === 0) {
        users.delete(userId);
      }
    }
    if (users.size === 0) {
      this.boardPresence.delete(boardId);
    }
    if (!opts.skipReverseIndex) {
      const socketBoards = this.socketBoards.get(ws);
      if (socketBoards) {
        socketBoards.delete(boardId);
        if (socketBoards.size === 0) this.socketBoards.delete(ws);
      }
    }
    this.broadcastBoardPresence(boardId);
  }

  private handleTyping(
    ws: WebSocket,
    userId: string,
    boardId: string,
    isTyping: boolean,
  ): void {
    const users = this.boardPresence.get(boardId);
    if (!users) return;
    // Only notify viewers who have presence on this board, and skip the
    // sender's own sockets — they don't need to be told about themselves.
    const info = users.get(userId);
    const message: WebSocketMessage = {
      type: "board_typing",
      data: {
        boardId,
        userId,
        name: info?.name ?? null,
        email: info?.email ?? null,
        isTyping,
      },
      timestamp: new Date().toISOString(),
    };
    for (const [otherUserId, entry] of users) {
      if (otherUserId === userId) continue;
      for (const sock of entry.sockets) {
        if (sock !== ws) this.sendToClient(sock, message);
      }
    }
  }

  private async handleBoardCursor(
    ws: WebSocket,
    userId: string,
    boardId: string,
    pos: { x: number; y: number } | null,
  ): Promise<void> {
    // Cursor fan-out rides on the existing board presence channel: only
    // sockets that joined this board's presence map receive the broadcast.
    // The sender's own sockets are excluded so a viewer never sees a ghost
    // of their own pointer.
    const users = this.boardPresence.get(boardId);
    if (!users) return;
    let info = users.get(userId);
    if (!info) {
      // Defensive: if the cursor packet beat the presence_join (or arrives
      // from a tab that didn't join for some reason), still resolve their
      // display info from cache so recipients can label the cursor.
      info = {
        ...(await this.resolveUserInfo(userId)),
        sockets: new Set(),
      };
    }
    const message: WebSocketMessage = {
      type: "board_cursor",
      data: {
        boardId,
        userId,
        name: info.name ?? null,
        email: info.email ?? null,
        x: pos ? Math.round(pos.x) : null,
        y: pos ? Math.round(pos.y) : null,
        isLeave: pos === null,
      },
      timestamp: new Date().toISOString(),
    };
    for (const [otherUserId, entry] of users) {
      if (otherUserId === userId) continue;
      for (const sock of entry.sockets) {
        if (sock !== ws) this.sendToClient(sock, message);
      }
    }
  }

  private async handleAssetDragging(
    ws: WebSocket,
    userId: string,
    boardId: string,
    moves: Array<{ id: string; positionX: number; positionY: number }>,
    isEnd: boolean,
  ): Promise<void> {
    // We rely on the existing board presence channel: only sockets that
    // joined this board's presence map are eligible recipients. The sender's
    // own sockets are excluded so a user never sees their own ghost.
    const users = this.boardPresence.get(boardId);
    if (!users) return;
    let info = users.get(userId);
    if (!info) {
      // Sender hasn't joined presence (shouldn't happen with the page
      // wiring, but be defensive). Still resolve their name from cache so
      // recipients can label the ghost properly.
      info = {
        ...(await this.resolveUserInfo(userId)),
        sockets: new Set(),
      };
    }
    const message: WebSocketMessage = {
      type: "board_asset_dragging",
      data: {
        boardId,
        userId,
        name: info.name ?? null,
        email: info.email ?? null,
        moves,
        isEnd,
      },
      timestamp: new Date().toISOString(),
    };
    for (const [otherUserId, entry] of users) {
      if (otherUserId === userId) continue;
      for (const sock of entry.sockets) {
        if (sock !== ws) this.sendToClient(sock, message);
      }
    }
  }

  private broadcastBoardPresence(boardId: string): void {
    const users = this.boardPresence.get(boardId);
    const viewers = users
      ? Array.from(users.entries()).map(([id, e]) => ({
          userId: id,
          name: e.name,
          email: e.email,
        }))
      : [];
    const message: WebSocketMessage = {
      type: "board_presence",
      data: { boardId, viewers },
      timestamp: new Date().toISOString(),
    };
    if (!users) return;
    for (const entry of users.values()) {
      for (const sock of entry.sockets) {
        this.sendToClient(sock, message);
      }
    }
  }

  // Test/diagnostics helper: returns the current viewers for a board.
  getBoardViewers(boardId: string): Array<{ userId: string; name: string | null; email: string | null }> {
    const users = this.boardPresence.get(boardId);
    if (!users) return [];
    return Array.from(users.entries()).map(([id, e]) => ({
      userId: id,
      name: e.name,
      email: e.email,
    }));
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
