import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage as defaultStorage, type IStorage } from "../storage";
import { requireAuth } from "../middleware/auth";

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
}
