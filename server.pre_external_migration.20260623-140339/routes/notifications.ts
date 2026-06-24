import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { storage as defaultStorage, type IStorage } from "../storage";
import { requireAuth } from "../middleware/auth";

const SNOOZE_BODY_SCHEMA = z.object({
  // null/undefined or 0 cancels the snooze; otherwise the number of
  // minutes from "now" to suppress new admin_alert persistence for.
  minutes: z.number().int().nonnegative().max(7 * 24 * 60).nullable().optional(),
});

const CLEAR_BY_TYPE_BODY_SCHEMA = z.object({
  // Restrict to known notification types to avoid the bulk endpoint
  // being repurposed to clear arbitrary types.
  type: z.enum(["admin_alert", "board_shared"]),
});

export function registerNotificationsRoutes(
  app: Express,
  deps: { storage?: IStorage; auth?: RequestHandler } = {},
) {
  const storage = deps.storage ?? defaultStorage;
  const auth =
    deps.auth ??
    (deps.storage
      ? (req: Request, _res: Response, next: NextFunction) => {
          if (!req.user) req.user = { id: "test-user", type: "agent", email: "test@example.com" };
          next();
        }
      : requireAuth);

  // List the current user's notifications, newest first.
  app.get("/api/notifications", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const items = await storage.getNotificationsForUser(userId);
      res.json(items);
    } catch (error: unknown) {
      console.error("[notifications] list error:", error);
      res.status(500).json({ error: "Failed to list notifications" });
    }
  });

  // Mark one notification as read (dismiss).
  app.post("/api/notifications/:id/read", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const updated = await storage.markNotificationRead(req.params.id, userId);
      if (!updated) return res.status(404).json({ error: "Notification not found" });
      res.json(updated);
    } catch (error: unknown) {
      console.error("[notifications] mark read error:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  // Mark all of the current user's unread notifications as read.
  app.post("/api/notifications/read-all", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const count = await storage.markAllNotificationsRead(userId);
      res.json({ updated: count });
    } catch (error: unknown) {
      console.error("[notifications] mark all read error:", error);
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });

  // Bulk-dismiss notifications of a single type for the current user. The
  // admin notification bell uses this with `type: "admin_alert"` so a noisy
  // upstream incident can be cleared without also clobbering board-share
  // notifications.
  app.post("/api/notifications/clear-by-type", auth, async (req: Request, res: Response) => {
    const parsed = CLEAR_BY_TYPE_BODY_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid type", details: parsed.error.flatten() });
    }
    try {
      const userId = String(req.user!.id);
      const count = await storage.markNotificationsReadByType(userId, parsed.data.type);
      res.json({ updated: count, type: parsed.data.type });
    } catch (error: unknown) {
      console.error("[notifications] clear by type error:", error);
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  });

  // Read the current user's admin_alert snooze window. Returns
  // `{ until: ISOString | null }`. Used by the bell to render the
  // active snooze chip after a refresh.
  app.get("/api/notifications/admin-alert-snooze", auth, async (req: Request, res: Response) => {
    try {
      const userId = String(req.user!.id);
      const until = await storage.getAdminAlertSnoozeUntil(userId);
      res.json({ until: until ? until.toISOString() : null });
    } catch (error: unknown) {
      console.error("[notifications] get snooze error:", error);
      res.status(500).json({ error: "Failed to read snooze" });
    }
  });

  // Set or clear the current user's admin_alert snooze window. While a
  // snooze is active, websocket.persistAdminAlertForAdmins will skip
  // creating notification rows for this user (real-time admin sockets
  // still receive the broadcast — snooze only suppresses bell stacking).
  app.post("/api/notifications/admin-alert-snooze", auth, async (req: Request, res: Response) => {
    const parsed = SNOOZE_BODY_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid snooze", details: parsed.error.flatten() });
    }
    try {
      const userId = String(req.user!.id);
      const minutes = parsed.data.minutes ?? null;
      const until = minutes && minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;
      await storage.setAdminAlertSnoozeUntil(userId, until);
      res.json({ until: until ? until.toISOString() : null });
    } catch (error: unknown) {
      console.error("[notifications] set snooze error:", error);
      res.status(500).json({ error: "Failed to set snooze" });
    }
  });
}
