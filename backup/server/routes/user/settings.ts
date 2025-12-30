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
      },
    });

    return res.json(
      result || {
        facebookUrl: "",
        instagramUrl: "",
        linkedinUrl: "",
        xUrl: "",
        customWebhook: "",
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

    const { facebookUrl, instagramUrl, linkedinUrl, xUrl, customWebhook } =
      req.body;

    // Update user settings in database
    await db
      .update(users)
      .set({
        facebookUrl,
        instagramUrl,
        linkedinUrl,
        xUrl,
        customWebhook,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

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
