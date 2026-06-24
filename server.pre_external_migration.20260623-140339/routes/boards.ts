import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import {
  storage as defaultStorage,
  type IStorage,
  BOARD_MESSAGES_CAP_MIN,
  BOARD_MESSAGES_CAP_MAX,
} from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  insertBoardAssetSchema,
  sanitizeDrawingContent,
  DRAWING_MAX_CONTENT_BYTES,
} from "@shared/schema";
import { realtimeService } from "../websocket";
import {
  sendBoardSharedEmail,
  sendBoardUnsharedEmail,
  sendBoardLeftEmail,
  getAppBaseUrl,
} from "../services/mailer";
// Reuse the chat handler's broadcast helpers so non-chat batch entry points
// (uploads via POST /assets, status flips via PATCH /assets/:id) fan out the
// same queued/generating/ready/failed frames to every connected board
// participant — Task #242. The chat-mode "create" handler already does this
// (Task #241); without this, a stranger viewing a shared board would either
// see uploads appear silently after a manual refresh or see a generation
// tile stuck on "Generating…" forever.
import { pushAssetStatus, resolveBoardRecipients } from "./boards-chat";

export const ASSET_KINDS = [
  "image",
  "video",
  "audio",
  // Tool-created kinds added by the bottom toolbar's sticky/text/frame/draw
  // buttons. They live as board assets so collaborators see them on the
  // canvas, but they have no provider-generated media URL.
  "sticky",
  "text",
  "frame",
  "drawing",
] as const;
export const ASSET_PROVIDERS = [
  "luma",
  "runway",
  "sora2",
  "seedance",
  "veo",
  "kling",
  "gemini-image",
  "openai-image",
  "heygen",
  // Direct user upload from the bottom toolbar's image/video/+ buttons.
  // Not a generation provider — the assetUrl points at the uploaded file.
  "upload",
  // Created on the canvas by a bottom-toolbar tool (sticky note, text,
  // frame, drawing, in-browser audio recording). Not a generation source.
  "tool",
] as const;

const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isShared: z.boolean().optional(),
  // Owner-controlled per-board cap on persisted chat messages. Bounded to
  // keep the conversation useful (>= MIN) while preventing runaway growth.
  chatHistoryCap: z
    .number()
    .int()
    .min(BOARD_MESSAGES_CAP_MIN)
    .max(BOARD_MESSAGES_CAP_MAX)
    .optional(),
  // Per-board owner toggle: when false, server skips collaborator
  // join/leave transactional emails for this board. In-app notifications
  // continue regardless.
  notifyOnCollaboratorChange: z.boolean().optional(),
});

export const BOARD_INTENTS = [
  "social-post",
  "blog-article",
  "image",
  "video",
] as const;
export type BoardIntent = (typeof BOARD_INTENTS)[number];

const createBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isShared: z.boolean().optional(),
  // Optional seed payload (e.g. when launched from a Discover template). The
  // server doesn't persist these — they're echoed back to the client so the
  // newly opened board page can prefill the chat.
  seedPrompt: z.string().min(1).max(8000).optional(),
  seedProvider: z.enum(ASSET_PROVIDERS).optional(),
  seedGenerationMode: z.enum(["text-to-video", "image-to-video", "video-to-video"]).optional(),
  seedTemplateId: z.string().min(1).max(120).optional(),
  seedIntent: z.enum(BOARD_INTENTS).optional(),
  // Optional chat-mode hint: "plan" lands in conversational/brainstorm mode,
  // "build" lands in generation/create mode. Echoed back like the other seed
  // fields so the board page can pick the right starting mode.
  seedMode: z.enum(["plan", "build"]).optional(),
});
export const ASSET_STATUSES = ["queued", "generating", "ready", "failed", "rejected"] as const;

const createAssetSchema = insertBoardAssetSchema
  .omit({ boardId: true })
  .extend({
    kind: z.enum(ASSET_KINDS),
    provider: z.enum(ASSET_PROVIDERS),
    status: z.enum(ASSET_STATUSES).optional(),
    content: z.string().max(DRAWING_MAX_CONTENT_BYTES).nullable().optional(),
  })
  .transform((data, ctx) => {
    // Drawing assets persist a JSON DrawingPayload in `content`. Validate the
    // shape server-side and replace the field with the canonical re-serialized
    // form so a malicious client can't smuggle arbitrary SVG / script markup
    // that would be rendered to every collaborator.
    if (data.kind === "drawing" && data.content != null) {
      const sanitized = sanitizeDrawingContent(data.content);
      if (sanitized == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: "Invalid drawing payload",
        });
        return z.NEVER;
      }
      return { ...data, content: sanitized };
    }
    if (data.kind !== "drawing" && typeof data.content === "string" && data.content.length > 10_000) {
      // Non-drawing kinds keep the original 10k cap on free-text content.
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        path: ["content"],
        type: "string",
        maximum: 10_000,
        inclusive: true,
        message: "content too long",
      });
      return z.NEVER;
    }
    return data;
  });

// Cap the batch so a buggy/malicious client can't open a long-running
// transaction by submitting tens of thousands of moves at once. The
// largest realistic group selection on the canvas is well under this.
export const BULK_MOVE_MAX = 500;
const bulkMoveAssetsSchema = z.object({
  moves: z
    .array(
      z.object({
        id: z.string().min(1),
        positionX: z.number(),
        positionY: z.number(),
      }),
    )
    .min(1)
    .max(BULK_MOVE_MAX),
});

const updateAssetSchema = z.object({
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  status: z.enum(["queued", "generating", "ready", "failed", "rejected"]).optional(),
  rejectionReason: z.string().nullable().optional(),
  assetUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  modelLabel: z.string().nullable().optional(),
  batchLabel: z.string().nullable().optional(),
  // Drawing assets store a JSON DrawingPayload (validated below in the
  // route handler once we know the asset's kind) which can be larger than
  // free-text content; cap at the same DRAWING_MAX_CONTENT_BYTES ceiling
  // the create schema uses.
  content: z.string().max(DRAWING_MAX_CONTENT_BYTES).nullable().optional(),
});

// =====================================================
// Board chat — v2v validation gate
// =====================================================
// The full unified Brainstorm/Create handler is implemented in a separate task.
// What we ship here is the public API surface + the validation rule the UI
// (and other callers) must obey: Video → Video generation mode is only valid
// when the selected provider supports it (Luma or Runway today).

export const V2V_PROVIDERS = new Set<string>(["luma", "runway"]);
export const BOARD_CHAT_GENERATION_MODES = [
  "text-to-video",
  "image-to-video",
  "video-to-video",
] as const;
export type BoardChatGenerationMode = (typeof BOARD_CHAT_GENERATION_MODES)[number];

// Providers the chat handler is allowed to dispatch to. "upload" and "tool"
// are board asset providers (uploaded files / on-board tool kinds like
// stickies, frames, drawings) but never generation targets, so they are
// intentionally excluded here even though they are part of `ASSET_PROVIDERS`.
export const CHAT_PROVIDERS = ASSET_PROVIDERS.filter(
  (p) => p !== "upload" && p !== "tool",
) as Exclude<(typeof ASSET_PROVIDERS)[number], "upload" | "tool">[];

export const boardChatPayloadSchema = z.object({
  message: z.string().min(1).max(8000),
  mode: z.enum(["brainstorm", "create"]).default("create"),
  provider: z.enum(CHAT_PROVIDERS as [string, ...string[]]),
  generationMode: z.enum(BOARD_CHAT_GENERATION_MODES).optional(),
  referencedAssetIds: z.array(z.string()).optional().default([]),
});

export type BoardChatPayload = z.infer<typeof boardChatPayloadSchema>;

export class BoardChatValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "BoardChatValidationError";
  }
}

export function assertProviderSupportsGenerationMode(
  provider: string,
  generationMode?: BoardChatGenerationMode,
): void {
  if (generationMode === "video-to-video" && !V2V_PROVIDERS.has(provider)) {
    throw new BoardChatValidationError(
      `Video → video is only available on Luma or Runway, not ${provider}.`,
    );
  }
}

export function registerBoardsRoutes(
  app: Express,
  deps: { storage?: IStorage; auth?: RequestHandler } = {},
) {
  const storage = deps.storage ?? defaultStorage;
  // Allow tests to inject a permissive auth middleware. Defaults to real requireAuth.
  const auth =
    deps.auth ??
    (deps.storage
      ? (req: Request, _res: Response, next: NextFunction) => {
          if (!req.user) req.user = { id: "test-user", type: "agent", email: "test@example.com" };
          next();
        }
      : requireAuth);

  // List all boards the current user owns OR has been shared with. Each board
  // carries an `isOwner` flag so the home tabs ("All", "Shared", "Mine") can
  // filter without another round trip.
  app.get("/api/boards", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const boards = await storage.getAccessibleBoardsForUser(userId);

      // Batch the three N+1 hotspots into fixed-cost lookups: one query for
      // all share rows on owned boards, one query for all owner records on
      // shared boards, and one query for the per-board asset summaries
      // (count + up to 4 thumbnails) used to render the board cards.
      const ownedBoardIds = boards.filter((b) => b.isOwner).map((b) => b.id);
      const sharedOwnerIds = boards.filter((b) => !b.isOwner).map((b) => b.userId);
      const allBoardIds = boards.map((b) => b.id);

      const [sharesByBoard, ownerUsers, assetSummariesByBoard] = await Promise.all([
        ownedBoardIds.length
          ? storage.getBoardSharesForBoards(ownedBoardIds)
          : Promise.resolve(new Map<string, Awaited<ReturnType<IStorage["getBoardShares"]>>>()),
        sharedOwnerIds.length
          ? storage.getUsersByIds(sharedOwnerIds)
          : Promise.resolve([] as Awaited<ReturnType<IStorage["getUsersByIds"]>>),
        allBoardIds.length
          ? storage.getBoardAssetSummariesForBoards(allBoardIds)
          : Promise.resolve(
              new Map<string, Awaited<ReturnType<IStorage["getBoardAssetSummariesForBoards"]>> extends Map<string, infer V> ? V : never>(),
            ),
      ]);
      const ownersById = new Map(ownerUsers.map((u) => [u.id, u]));

      const enriched = boards.map((board) => {
        const summary = assetSummariesByBoard.get(board.id) ?? {
          assetCount: 0,
          thumbnails: [],
        };
        const thumbnails = summary.thumbnails.map((a) => ({
          id: a.id,
          thumbnailUrl: a.thumbnailUrl || a.assetUrl,
          kind: a.kind,
        }));

        // Collaborator summary so the board card can render an avatar
        // stack without an extra round trip. Owners see who they've shared
        // with; recipients see who owns the board.
        let collaborators: { userId: string; name: string | null; email: string | null }[] = [];
        let owner: { id: string; name: string | null; email: string | null } | null = null;
        if (board.isOwner) {
          const shares = sharesByBoard.get(board.id) ?? [];
          collaborators = shares.map((s) => ({
            userId: s.userId,
            name: s.name,
            email: s.email,
          }));
        } else {
          const ownerUser = ownersById.get(board.userId);
          if (ownerUser) {
            owner = {
              id: ownerUser.id,
              name: ownerUser.name ?? null,
              email: ownerUser.email ?? null,
            };
          } else {
            owner = { id: board.userId, name: null, email: null };
          }
        }

        return {
          ...board,
          // Always send an explicit boolean so the frontend never has to
          // guess. The destructive "Delete board" action depends on this
          // flag being unambiguous — see BoardCard's showDelete logic.
          isOwner: board.isOwner === true,
          assetCount: summary.assetCount,
          thumbnails,
          collaborators,
          owner,
        };
      });

      res.json(enriched);
    } catch (error: unknown) {
      console.error("[boards] list error:", error);
      res.status(500).json({ error: "Failed to list boards" });
    }
  });

  // List candidate users to share a board with (everyone except the current
  // user). The dialog renders this so the owner can pick recipients.
  app.get("/api/boards/share-candidates", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const all = await storage.getAllUsers();
      const candidates = all
        .filter((u) => u.id !== userId)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, username: u.username }));
      res.json(candidates);
    } catch (error: unknown) {
      console.error("[boards] share candidates error:", error);
      res.status(500).json({ error: "Failed to list share candidates" });
    }
  });

  // Create a new board
  app.post("/api/boards", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const parsed = createBoardSchema.parse(req.body ?? {});
      const board = await storage.createBoard({
        userId,
        title: parsed.title || parsed.seedPrompt?.slice(0, 80) || "Untitled board",
        isShared: parsed.isShared ?? false,
      });
      res.json({
        ...board,
        seed: parsed.seedPrompt || parsed.seedIntent || parsed.seedMode
          ? {
              prompt: parsed.seedPrompt ?? null,
              provider: parsed.seedProvider ?? null,
              generationMode: parsed.seedGenerationMode ?? null,
              templateId: parsed.seedTemplateId ?? null,
              intent: parsed.seedIntent ?? null,
              chatMode: parsed.seedMode ?? null,
            }
          : null,
      });
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create error:", error);
      res.status(500).json({ error: "Failed to create board" });
    }
  });

  // Get a board with all assets grouped by batchId. Accessible to the owner
  // and any user the board has been shared with. Assets are read with the
  // owner's userId so shared viewers see the same canvas.
  app.get("/api/boards/:id", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getAccessibleBoardForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const assets = await storage.getBoardAssetsForUser(board.id, board.userId);
      const batchMap = new Map<string, { batchId: string; batchLabel: string | null; assets: typeof assets }>();
      for (const a of assets) {
        const entry = batchMap.get(a.batchId) ?? {
          batchId: a.batchId,
          batchLabel: a.batchLabel,
          assets: [],
        };
        entry.assets.push(a);
        batchMap.set(a.batchId, entry);
      }
      res.json({
        ...board,
        batches: Array.from(batchMap.values()),
        assets,
      });
    } catch (error: unknown) {
      console.error("[boards] get error:", error);
      res.status(500).json({ error: "Failed to get board" });
    }
  });

  // List who a board is shared with (owner only).
  app.get("/api/boards/:id/shares", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const board = await storage.getBoardByIdForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const shares = await storage.getBoardShares(board.id, userId);
      res.json(shares);
    } catch (error: unknown) {
      console.error("[boards] list shares error:", error);
      res.status(500).json({ error: "Failed to list shares" });
    }
  });

  // Share a board with another user (owner only). Idempotent.
  app.post("/api/boards/:id/shares", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const parsed = z.object({ userId: z.string().min(1) }).parse(req.body ?? {});
      if (parsed.userId === userId) {
        return res.status(400).json({ error: "Cannot share a board with yourself" });
      }
      const board = await storage.getBoardByIdForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const share = await storage.shareBoard(req.params.id, userId, parsed.userId);
      if (!share) return res.status(404).json({ error: "Board not found" });
      // Notify the recipient (best-effort — never block the share itself).
      // We resolve the sharer + recipient once and then fan out to the
      // in-app notification and the transactional email in parallel; either
      // failure is swallowed so the share itself always succeeds.
      const sharer = await storage.getUser(userId).catch(() => undefined);
      const recipient = await storage.getUser(parsed.userId).catch(() => undefined);
      const sharerDisplayName = sharer?.name ?? sharer?.email ?? "A teammate";

      try {
        const notification = await storage.createNotification({
          userId: parsed.userId,
          type: "board_shared",
          data: {
            boardId: board.id,
            boardTitle: board.title,
            sharedByUserId: userId,
            sharedByName: sharer?.name ?? sharer?.email ?? null,
          },
        });
        // Push a real-time event so the recipient's bell badge updates
        // instantly. Wrapped in its own try/catch so a socket failure can't
        // mask the successful share+notification.
        try {
          realtimeService.notifyNotificationCreated(parsed.userId, {
            notificationId: notification.id,
            type: notification.type,
            data: notification.data,
          });
        } catch (wsError) {
          console.error(
            "[boards] notify share recipient via websocket failed",
            JSON.stringify({
              event: "notification.ws.failed",
              type: "board_shared",
              boardId: board.id,
              recipientUserId: parsed.userId,
              error: (wsError as Error)?.message ?? String(wsError),
            }),
          );
        }
      } catch (notifyError) {
        // Best-effort: never let a notification failure roll back a successful
        // share. Log loudly with structured context so prod outages (e.g.
        // missing notifications table) are visible in monitoring.
        console.error(
          "[boards] notify share recipient failed",
          JSON.stringify({
            event: "notification.create.failed",
            type: "board_shared",
            boardId: board.id,
            recipientUserId: parsed.userId,
            sharedByUserId: userId,
            error: (notifyError as Error)?.message ?? String(notifyError),
          }),
        );
      }

      // Fan out the email after the in-app notification. We honor the
      // recipient's emailNotifications opt-out (default true), and skip
      // entirely if we don't have a destination address. Wrapped in
      // try/catch to keep the same best-effort guarantee as above.
      try {
        const recipientEmail = recipient?.email?.trim();
        const optedOut = recipient && recipient.emailNotifications === false;
        const boardMuted = board.notifyOnCollaboratorChange === false;
        if (!recipientEmail) {
          console.warn(
            "[boards] skipping share email — recipient has no email",
            JSON.stringify({ event: "share.email.skipped.no_address", boardId: board.id, recipientUserId: parsed.userId }),
          );
        } else if (boardMuted) {
          console.log(
            "[boards] skipping share email — board muted by owner",
            JSON.stringify({ event: "share.email.skipped.board_muted", boardId: board.id, recipientUserId: parsed.userId }),
          );
        } else if (optedOut) {
          console.log(
            "[boards] skipping share email — recipient opted out",
            JSON.stringify({ event: "share.email.skipped.opt_out", boardId: board.id, recipientUserId: parsed.userId }),
          );
        } else {
          const baseUrl = getAppBaseUrl(req.get("host"));
          const boardUrl = `${baseUrl}/boards/${encodeURIComponent(board.id)}`;
          await sendBoardSharedEmail({
            recipientEmail,
            recipientName: recipient?.name ?? null,
            sharerName: sharerDisplayName,
            boardTitle: board.title,
            boardUrl,
          });
        }
      } catch (emailError) {
        console.error(
          "[boards] send share email failed",
          JSON.stringify({
            event: "share.email.failed",
            boardId: board.id,
            recipientUserId: parsed.userId,
            sharedByUserId: userId,
            error: (emailError as Error)?.message ?? String(emailError),
          }),
        );
      }
      res.json(share);
    } catch (error: unknown) {
      if ((error as { issues?: unknown })?.issues) {
        return res.status(400).json({ error: "Invalid body", issues: (error as { issues: unknown }).issues });
      }
      console.error("[boards] share error:", error);
      res.status(500).json({ error: "Failed to share board" });
    }
  });

  // Recipient-initiated leave: a non-owner removes themselves from a shared board.
  // Returns 404 when the user has no share row (e.g. not a recipient, or the
  // owner calling this endpoint — owners should delete the board instead).
  app.delete("/api/boards/:id/share/me", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      // Resolve the board (and therefore the owner) *before* leaving so we
      // can fan out the heads-up notification + email after the share row
      // is gone. We use the accessible-for-user lookup because the caller
      // is a recipient, not the owner.
      const board = await storage.getAccessibleBoardForUser(req.params.id, userId);
      const ok = await storage.leaveSharedBoard(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Not a shared recipient of this board" });

      // Best-effort fan-out to the owner. Mirrors the explicit-remove path:
      // persisted notification + opt-out-respecting transactional email.
      if (board && board.userId !== userId) {
        const owner = await storage.getUser(board.userId).catch(() => undefined);
        const leaver = await storage.getUser(userId).catch(() => undefined);
        const leaverDisplayName = leaver?.name ?? leaver?.email ?? "A teammate";

        try {
          const notification = await storage.createNotification({
            userId: board.userId,
            type: "board_left",
            data: {
              boardId: board.id,
              boardTitle: board.title,
              leftByUserId: userId,
              leftByName: leaver?.name ?? leaver?.email ?? null,
            },
          });
          try {
            realtimeService.notifyNotificationCreated(board.userId, {
              notificationId: notification.id,
              type: notification.type,
              data: notification.data,
            });
          } catch (wsError) {
            console.error(
              "[boards] notify owner of leave via websocket failed",
              JSON.stringify({
                event: "notification.ws.failed",
                type: "board_left",
                boardId: board.id,
                ownerUserId: board.userId,
                error: (wsError as Error)?.message ?? String(wsError),
              }),
            );
          }
        } catch (notifyError) {
          console.error(
            "[boards] notify owner of leave failed",
            JSON.stringify({
              event: "notification.create.failed",
              type: "board_left",
              boardId: board.id,
              ownerUserId: board.userId,
              leftByUserId: userId,
              error: (notifyError as Error)?.message ?? String(notifyError),
            }),
          );
        }

        try {
          const ownerEmail = owner?.email?.trim();
          const optedOut = owner && owner.emailNotifications === false;
          const boardMuted = board.notifyOnCollaboratorChange === false;
          if (!ownerEmail) {
            console.warn(
              "[boards] skipping leave email — owner has no email",
              JSON.stringify({ event: "leave.email.skipped.no_address", boardId: board.id, ownerUserId: board.userId }),
            );
          } else if (boardMuted) {
            console.log(
              "[boards] skipping leave email — board muted by owner",
              JSON.stringify({ event: "leave.email.skipped.board_muted", boardId: board.id, ownerUserId: board.userId }),
            );
          } else if (optedOut) {
            console.log(
              "[boards] skipping leave email — owner opted out",
              JSON.stringify({ event: "leave.email.skipped.opt_out", boardId: board.id, ownerUserId: board.userId }),
            );
          } else {
            const baseUrl = getAppBaseUrl(req.get("host"));
            const boardUrl = `${baseUrl}/boards/${encodeURIComponent(board.id)}`;
            await sendBoardLeftEmail({
              ownerEmail,
              ownerName: owner?.name ?? null,
              leaverName: leaverDisplayName,
              boardTitle: board.title,
              boardUrl,
            });
          }
        } catch (emailError) {
          console.error(
            "[boards] send leave email failed",
            JSON.stringify({
              event: "leave.email.failed",
              boardId: board.id,
              ownerUserId: board.userId,
              leftByUserId: userId,
              error: (emailError as Error)?.message ?? String(emailError),
            }),
          );
        }
      }

      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] leave share error:", error);
      res.status(500).json({ error: "Failed to leave board" });
    }
  });

  // Remove a share (owner only).
  app.delete("/api/boards/:id/shares/:userId", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      // Resolve the board *before* unsharing so we still know its title even
      // after the share row is gone. We also need it to gate the operation
      // to the owner.
      const board = await storage.getBoardByIdForUser(req.params.id, userId);
      if (!board) return res.status(404).json({ error: "Board not found" });
      const ok = await storage.unshareBoard(req.params.id, userId, req.params.userId);
      if (!ok) return res.status(404).json({ error: "Share not found" });
      // Best-effort: push a real-time event to the removed user so any open
      // board page (chat panel + canvas) reacts immediately instead of
      // continuing to show stale data until the next refetch. The REST
      // endpoints already gate access via `getAccessibleBoardForUser`, so
      // this WS push is purely a UX accelerator — never block the unshare on
      // a socket failure.
      try {
        realtimeService.sendToUser(req.params.userId, {
          type: "board_access_revoked",
          data: { boardId: req.params.id },
          timestamp: new Date().toISOString(),
        });
      } catch (wsErr) {
        console.warn(
          "[boards] notify removed collaborator failed",
          wsErr instanceof Error ? wsErr.message : wsErr,
        );
      }

      // Persist a notification so the removed user finds out the next time
      // they open the bell, even if they were nowhere near the board when
      // access was revoked. Mirrors the share-with-you path: bell entry +
      // opt-out-respecting transactional email, both best-effort.
      const remover = await storage.getUser(userId).catch(() => undefined);
      const removed = await storage.getUser(req.params.userId).catch(() => undefined);
      const removerDisplayName = remover?.name ?? remover?.email ?? "A teammate";

      try {
        const notification = await storage.createNotification({
          userId: req.params.userId,
          type: "board_unshared",
          data: {
            boardId: board.id,
            boardTitle: board.title,
            removedByUserId: userId,
            removedByName: remover?.name ?? remover?.email ?? null,
          },
        });
        try {
          realtimeService.notifyNotificationCreated(req.params.userId, {
            notificationId: notification.id,
            type: notification.type,
            data: notification.data,
          });
        } catch (wsError) {
          console.error(
            "[boards] notify unshare recipient via websocket failed",
            JSON.stringify({
              event: "notification.ws.failed",
              type: "board_unshared",
              boardId: board.id,
              recipientUserId: req.params.userId,
              error: (wsError as Error)?.message ?? String(wsError),
            }),
          );
        }
      } catch (notifyError) {
        console.error(
          "[boards] notify unshare recipient failed",
          JSON.stringify({
            event: "notification.create.failed",
            type: "board_unshared",
            boardId: board.id,
            recipientUserId: req.params.userId,
            removedByUserId: userId,
            error: (notifyError as Error)?.message ?? String(notifyError),
          }),
        );
      }

      try {
        const recipientEmail = removed?.email?.trim();
        const optedOut = removed && removed.emailNotifications === false;
        const boardMuted = board.notifyOnCollaboratorChange === false;
        if (!recipientEmail) {
          console.warn(
            "[boards] skipping unshare email — recipient has no email",
            JSON.stringify({ event: "unshare.email.skipped.no_address", boardId: board.id, recipientUserId: req.params.userId }),
          );
        } else if (boardMuted) {
          console.log(
            "[boards] skipping unshare email — board muted by owner",
            JSON.stringify({ event: "unshare.email.skipped.board_muted", boardId: board.id, recipientUserId: req.params.userId }),
          );
        } else if (optedOut) {
          console.log(
            "[boards] skipping unshare email — recipient opted out",
            JSON.stringify({ event: "unshare.email.skipped.opt_out", boardId: board.id, recipientUserId: req.params.userId }),
          );
        } else {
          await sendBoardUnsharedEmail({
            recipientEmail,
            recipientName: removed?.name ?? null,
            removerName: removerDisplayName,
            boardTitle: board.title,
          });
        }
      } catch (emailError) {
        console.error(
          "[boards] send unshare email failed",
          JSON.stringify({
            event: "unshare.email.failed",
            boardId: board.id,
            recipientUserId: req.params.userId,
            removedByUserId: userId,
            error: (emailError as Error)?.message ?? String(emailError),
          }),
        );
      }
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] unshare error:", error);
      res.status(500).json({ error: "Failed to remove share" });
    }
  });

  // Update board (rename, share)
  app.patch("/api/boards/:id", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const updates = updateBoardSchema.parse(req.body ?? {});
      const updated = await storage.updateBoardForUser(req.params.id, userId, updates);
      if (!updated) return res.status(404).json({ error: "Board not found" });
      res.json(updated);
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update error:", error);
      res.status(500).json({ error: "Failed to update board" });
    }
  });

  // Delete board
  app.delete("/api/boards/:id", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.deleteBoardForUser(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Board not found" });
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] delete error:", error);
      res.status(500).json({ error: "Failed to delete board" });
    }
  });

  // Add an asset to a board
  app.post("/api/boards/:id/assets", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const parsed = createAssetSchema.parse(req.body ?? {});
      const asset = await storage.createBoardAssetForUser(req.params.id, userId, parsed);
      if (!asset) return res.status(404).json({ error: "Board not found" });
      // Fan the new tile out to every board participant (owner + every share
      // recipient + the actor) so collaborators see uploads, stickies,
      // drawings, and any other non-chat-created asset appear on their
      // canvas in real time — without this, a stranger viewing a shared
      // board would only see the new tile after a manual refresh
      // (Task #242). Best-effort: a broadcast failure must never fail the
      // POST itself, so we swallow any error after logging it.
      try {
        const recipients = await resolveBoardRecipients(
          storage,
          req.params.id,
          userId,
        );
        pushAssetStatus(recipients, req.params.id, asset);
      } catch (broadcastErr) {
        console.warn(
          "[boards] broadcast asset create failed:",
          broadcastErr instanceof Error ? broadcastErr.message : broadcastErr,
        );
      }
      res.json(asset);
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] create asset error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  // Bulk position update for the group-drag flow. Group drag used to fire
  // one PATCH per selected tile in parallel, which flooded the server with
  // round-trips and could leave the group half-moved if any one PATCH
  // failed. This endpoint takes the entire batch and applies it in a single
  // transaction so the move is atomic — either every tile lands or none of
  // them do.
  app.patch("/api/boards/:id/assets/positions", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const parsed = bulkMoveAssetsSchema.parse(req.body ?? {});
      const updated = await storage.bulkUpdateBoardAssetPositionsForUser(
        req.params.id,
        userId,
        parsed.moves,
      );
      if (!updated) return res.status(404).json({ error: "One or more assets not found" });
      res.json(updated);
    } catch (error: unknown) {
      if ((error as { issues?: unknown })?.issues) {
        return res.status(400).json({ error: "Invalid body", issues: (error as { issues: unknown }).issues });
      }
      console.error("[boards] bulk move assets error:", error);
      res.status(500).json({ error: "Failed to move assets" });
    }
  });

  // Update an asset (position, status, rejection reason, etc.)
  app.patch("/api/boards/:id/assets/:assetId", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const updates = updateAssetSchema.parse(req.body ?? {});
      // For drawing assets the `content` blob is a JSON DrawingPayload that
      // must be validated server-side before we persist it (see createAsset
      // route for the same check). We have to look up the existing asset to
      // know the kind because PATCH bodies don't include it.
      if (typeof updates.content === "string") {
        const existing = await storage.getBoardAssetByIdForUser(
          req.params.id,
          req.params.assetId,
          userId,
        );
        if (!existing) return res.status(404).json({ error: "Asset not found" });
        if (existing.kind === "drawing") {
          const sanitized = sanitizeDrawingContent(updates.content);
          if (sanitized == null) {
            return res.status(400).json({ error: "Invalid drawing payload" });
          }
          updates.content = sanitized;
        } else if (updates.content.length > 10_000) {
          // Free-text content (sticky/text/frame) keeps its original 10k cap;
          // only drawing payloads are allowed to grow up to the schema-level
          // 100k ceiling because they're structured JSON.
          return res.status(400).json({ error: "Invalid body", issues: [{ path: ["content"], message: "content too long" }] });
        }
      }
      const updated = await storage.updateBoardAssetForUser(
        req.params.id,
        req.params.assetId,
        userId,
        updates,
      );
      if (!updated) return res.status(404).json({ error: "Asset not found" });
      // Resolve every connected board participant (owner + every share
      // recipient + the actor) once and reuse it for both broadcast paths
      // below: content/position changes use `notifyBoardAssetUpdated`
      // (a typed asset patch), while generation-progress fields
      // (status / assetUrl / thumbnailUrl / durationSeconds /
      // rejectionReason / modelLabel) use `pushAssetStatus` so non-chat
      // upload-and-PATCH flows fan out the same queued/generating/ready/
      // failed frames the chat-mode "create" handler already emits — Task
      // #242. Both paths swallow broadcast failures so a transient WS hiccup
      // can never fail the PATCH itself.
      const positionChanged =
        updates.positionX !== undefined || updates.positionY !== undefined;
      const statusFieldsChanged =
        updates.status !== undefined ||
        updates.assetUrl !== undefined ||
        updates.thumbnailUrl !== undefined ||
        updates.durationSeconds !== undefined ||
        updates.rejectionReason !== undefined ||
        updates.modelLabel !== undefined;
      if (updates.content !== undefined || positionChanged || statusFieldsChanged) {
        try {
          const recipients = await resolveBoardRecipients(
            storage,
            req.params.id,
            userId,
          );
          if (updates.content !== undefined || positionChanged) {
            realtimeService.notifyBoardAssetUpdated(recipients, {
              boardId: req.params.id,
              batchId: updated.batchId,
              assetId: updated.id,
              ...(updates.content !== undefined ? { content: updated.content } : {}),
              ...(positionChanged
                ? { positionX: updated.positionX, positionY: updated.positionY }
                : {}),
            });
          }
          if (statusFieldsChanged) {
            pushAssetStatus(recipients, req.params.id, updated);
          }
        } catch (broadcastErr) {
          console.warn(
            "[boards] broadcast asset update failed:",
            broadcastErr instanceof Error ? broadcastErr.message : broadcastErr,
          );
        }
      }
      res.json(updated);
    } catch (error: unknown) {
      if (error?.issues) return res.status(400).json({ error: "Invalid body", issues: error.issues });
      console.error("[boards] update asset error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  // Delete an asset
  app.delete("/api/boards/:id/assets/:assetId", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const ok = await storage.deleteBoardAssetForUser(req.params.id, req.params.assetId, userId);
      if (!ok) return res.status(404).json({ error: "Asset not found" });
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("[boards] delete asset error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // NOTE: POST /api/boards/:id/chat is registered in `routes/boards-chat.ts`
  // (the full Brainstorm/Create handler with auto-eval). The chat schema and
  // validation helpers above are exported so that handler — and tests — can
  // share them.
}
