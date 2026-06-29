/**
 * Admin routes for managing user credits and billing.
 *
 * GET  /api/admin/billing/wallet/:userId — view user's wallet and recent ledger
 * POST /api/admin/billing/topup — add credits to user account
 * GET  /api/admin/billing/usage — view recent AI usage events
 */

import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import type { IStorage } from "../storage";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { walletLedger, aiUsageEvents } from "@shared/schema";

const topupSchema = z.object({
  userId: z.string().min(1),
  amountCredits: z.number().int().min(1).max(100000),
  reason: z.string().min(1).max(200),
});

export interface AdminBillingDeps {
  storage: IStorage;
  requireAdmin: RequestHandler;
}

export function registerAdminBillingRoutes(
  app: Express,
  deps: AdminBillingDeps,
): void {
  const { storage, requireAdmin } = deps;

  // GET /api/admin/billing/wallet/:userId
  // View user's wallet balance and recent ledger entries
  app.get(
    "/api/admin/billing/wallet/:userId",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = req.params.userId;
        const wallet = await storage.getWalletAccount(userId);

        // Fetch recent ledger entries (last 50)
        const ledgerEntries = await db
          .select()
          .from(walletLedger)
          .where(eq(walletLedger.userId, userId))
          .orderBy(desc(walletLedger.createdAt))
          .limit(50);

        return res.json({
          wallet,
          recentLedger: ledgerEntries,
        });
      } catch (error) {
        console.error("[admin-billing] GET wallet failed:", error);
        return res.status(500).json({ error: "Failed to load wallet" });
      }
    },
  );

  // POST /api/admin/billing/topup
  // Add credits to a user's account
  app.post(
    "/api/admin/billing/topup",
    requireAdmin,
    async (req: Request & { user?: { id?: string | number } }, res: Response) => {
      const parsed = topupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      const { userId, amountCredits, reason } = parsed.data;
      const adminId = String(req.user?.id ?? "admin");

      try {
        const result = await storage.creditWalletCredits(
          userId,
          amountCredits,
          `admin_topup_${reason}`,
          {
            requestId: `admin_${Date.now()}`,
            metadata: {
              adminId,
              reason,
            },
          },
        );

        return res.json({
          success: true,
          userId,
          creditsAdded: amountCredits,
          newBalance: result.balance,
          reason,
        });
      } catch (error) {
        console.error("[admin-billing] topup failed:", error);
        return res.status(500).json({ error: "Failed to add credits" });
      }
    },
  );

  // GET /api/admin/billing/usage
  // View recent AI usage events
  app.get(
    "/api/admin/billing/usage",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const limit = Math.min(
          parseInt(req.query.limit as string, 10) || 100,
          1000,
        );

        const events = await db
          .select()
          .from(aiUsageEvents)
          .orderBy(desc(aiUsageEvents.createdAt))
          .limit(limit);

        const summary = {
          totalEvents: events.length,
          byStatus: {
            charged: events.filter((e) => e.status === "charged").length,
            refunded: events.filter((e) => e.status === "refunded").length,
            blocked: events.filter((e) => e.status === "blocked").length,
          },
          byProvider: {} as Record<string, number>,
          totalChargedCredits: 0,
          totalRefundedCredits: 0,
        };

        for (const e of events) {
          summary.byProvider[e.provider] = (summary.byProvider[e.provider] ?? 0) + 1;
          if (e.status === "charged" && e.actualCredits) {
            summary.totalChargedCredits += e.actualCredits;
          }
          if (e.status === "refunded" && e.actualCredits) {
            summary.totalRefundedCredits += Math.abs(e.actualCredits);
          }
        }

        return res.json({
          summary,
          events,
        });
      } catch (error) {
        console.error("[admin-billing] GET usage failed:", error);
        return res.status(500).json({ error: "Failed to load usage events" });
      }
    },
  );
}
