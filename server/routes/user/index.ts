import { Router, Request, Response } from "express";
import settingsRoutes from "./settings";
import socialLinksRoutes from "./social-links";
import socialApiKeysRoutes from "./social-api-keys";
import { requireAuth } from "../../middleware/auth";
import { db } from "../../db";
import { users, publicUsers } from "../../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Get current user profile
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userType = req.userType;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "User ID not found" });
    }

    if (userType === "agent") {
      // Fetch agent user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId as string))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        type: "agent",
      });
    } else if (userType === "public") {
      // Fetch public user from database
      const [user] = await db
        .select()
        .from(publicUsers)
        .where(eq(publicUsers.id, parseInt(userId as string)))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        agentSlug: user.agentSlug,
        type: "public",
      });
    }

    return res.status(400).json({ error: "Invalid user type" });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Register user-related routes
router.use("/settings", settingsRoutes);
router.use("/social-links", socialLinksRoutes);
router.use(socialApiKeysRoutes);

export default router;
