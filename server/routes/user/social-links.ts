import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

console.log("🔥 [SOCIAL-LINKS MODULE] Routes file loaded!");

const router = Router();

// Default social links
const DEFAULT_SOCIAL_LINKS = {
  facebookUrl: "https://www.facebook.com/profile.php?id=61581294927027#",
  twitterUrl: "https://x.com/GoldenB93877",
  linkedinUrl:
    "https://www.linkedin.com/in/mygolden-brick-697253388/recent-activity/all/",
  instagramUrl: "https://instagram.com/bjorkgroup",
  youtubeUrl: "https://www.youtube.com/feed/playlists",
  tiktokUrl: "https://tiktok.com/@bjorkgroup",
};

// Get user's social links (GET /api/user/social-links)
router.get("/social-links", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("🔍 [GET SOCIAL LINKS] User ID:", userId);

    if (!userId) {
      console.log("❌ [GET SOCIAL LINKS] No user ID - unauthorized");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        facebookUrl: true,
        instagramUrl: true,
        linkedinUrl: true,
        xUrl: true,
        youtubeUrl: true,
        tiktokUrl: true,
      },
    });

    console.log("📊 [GET SOCIAL LINKS] User data from DB:", user);

    if (!user) {
      console.log("❌ [GET SOCIAL LINKS] User not found in database");
      return res.status(404).json({ error: "User not found" });
    }

    const responseData = {
      facebookUrl: user.facebookUrl || DEFAULT_SOCIAL_LINKS.facebookUrl,
      instagramUrl: user.instagramUrl || DEFAULT_SOCIAL_LINKS.instagramUrl,
      linkedinUrl: user.linkedinUrl || DEFAULT_SOCIAL_LINKS.linkedinUrl,
      xUrl: user.xUrl || DEFAULT_SOCIAL_LINKS.twitterUrl,
      youtubeUrl: user.youtubeUrl || DEFAULT_SOCIAL_LINKS.youtubeUrl,
      tiktokUrl: user.tiktokUrl || DEFAULT_SOCIAL_LINKS.tiktokUrl,
    };

    console.log("📤 [GET SOCIAL LINKS] Sending response:", responseData);

    res.json(responseData);
  } catch (error) {
    console.error("❌ [GET SOCIAL LINKS] Error:", error);
    res.status(500).json({ error: "Failed to fetch social links" });
  }
});

// Save/update user's social links (POST /api/user/social-links)
router.post("/social-links", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("🔗 [SAVE SOCIAL LINKS] User ID:", userId);

    if (!userId) {
      console.log("❌ [SAVE SOCIAL LINKS] No user ID - unauthorized");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      facebookUrl,
      instagramUrl,
      linkedinUrl,
      xUrl,
      youtubeUrl,
      tiktokUrl,
    } = req.body;

    console.log("📥 [SAVE SOCIAL LINKS] Received data:", {
      facebookUrl,
      instagramUrl,
      linkedinUrl,
      xUrl,
      youtubeUrl,
      tiktokUrl,
    });

    // Update user record
    const updateData = {
      facebookUrl: facebookUrl || null,
      instagramUrl: instagramUrl || null,
      linkedinUrl: linkedinUrl || null,
      xUrl: xUrl || null,
      youtubeUrl: youtubeUrl || null,
      tiktokUrl: tiktokUrl || null,
      updatedAt: new Date(),
    };

    console.log("💾 [SAVE SOCIAL LINKS] Updating database with:", updateData);

    await db.update(users).set(updateData).where(eq(users.id, userId));

    console.log("✅ [SAVE SOCIAL LINKS] Database updated successfully");

    const responseData = {
      success: true,
      message: "Social links saved successfully",
      socialLinks: {
        facebookUrl: facebookUrl || DEFAULT_SOCIAL_LINKS.facebookUrl,
        instagramUrl: instagramUrl || DEFAULT_SOCIAL_LINKS.instagramUrl,
        linkedinUrl: linkedinUrl || DEFAULT_SOCIAL_LINKS.linkedinUrl,
        xUrl: xUrl || DEFAULT_SOCIAL_LINKS.twitterUrl,
        youtubeUrl: youtubeUrl || DEFAULT_SOCIAL_LINKS.youtubeUrl,
        tiktokUrl: tiktokUrl || DEFAULT_SOCIAL_LINKS.tiktokUrl,
      },
    };

    console.log("📤 [SAVE SOCIAL LINKS] Sending response:", responseData);

    res.json(responseData);
  } catch (error) {
    console.error("❌ [SAVE SOCIAL LINKS] Error:", error);
    res.status(500).json({ error: "Failed to save social links" });
  }
});

export default router;
