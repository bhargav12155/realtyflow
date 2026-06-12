import { Router } from "express";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifyJWT } from "../../auth/jwt";

const router = Router();

// Middleware to ensure request is authenticated
router.use(verifyJWT);

// Get user settings
router.get("/settings", async (req, res) => {
  try {
    // @ts-ignore - req.user is set by verifyJWT middleware
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch user settings from database
    const result = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        facebookUrl: true,
        instagramUrl: true,
        linkedinUrl: true,
        xUrl: true,
        customWebhook: true,
        emailNotifications: true,
      },
    });

    return res.json(
      result || {
        facebookUrl: "",
        instagramUrl: "",
        linkedinUrl: "",
        xUrl: "",
        customWebhook: "",
        emailNotifications: true,
      }
    );
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update user settings
router.post("/settings", async (req, res) => {
  try {
    // @ts-ignore - req.user is set by verifyJWT middleware
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      facebookUrl,
      instagramUrl,
      linkedinUrl,
      xUrl,
      customWebhook,
      emailNotifications,
    } = req.body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (facebookUrl !== undefined) updates.facebookUrl = facebookUrl;
    if (instagramUrl !== undefined) updates.instagramUrl = instagramUrl;
    if (linkedinUrl !== undefined) updates.linkedinUrl = linkedinUrl;
    if (xUrl !== undefined) updates.xUrl = xUrl;
    if (customWebhook !== undefined) updates.customWebhook = customWebhook;
    if (typeof emailNotifications === "boolean") {
      updates.emailNotifications = emailNotifications;
    }

    // Update user settings in database
    await db.update(users).set(updates).where(eq(users.id, userId));

    return res.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
