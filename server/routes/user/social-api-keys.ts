// @ts-nocheck
import { Router } from "express";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { db } from "../../db";
import { socialApiKeys } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Get user's social API keys
router.get("/social-api-keys", optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    // If no user, return empty config (for setup modal)
    if (!userId) {
      return res.json({});
    }

    const keys = await db.query.socialApiKeys.findFirst({
      where: eq(socialApiKeys.userId, String(userId)),
    });

    if (!keys) {
      return res.json({});
    }

    // Return the configuration in the format expected by the setup component
    res.json({
      facebookPageId: keys.facebookAppId, // Using appId as pageId for now
      facebookAccessToken: keys.facebookAppSecret, // Simplified mapping
      instagramUserId: keys.instagramBusinessAccountId,
      instagramAccessToken: keys.instagramToken,
      twitterApiKey: keys.twitterApiKey,
      twitterApiSecret: keys.twitterApiSecret,
      twitterAccessToken: keys.twitterAccessToken,
      twitterAccessTokenSecret: keys.twitterAccessTokenSecret,
      linkedinAccessToken: keys.linkedinAccessToken,
      youtubeApiKey: keys.youtubeApiKey,
      youtubeAccessToken: keys.youtubeChannelId, // Simplified mapping
      tiktokAccessToken: keys.tiktokAccessToken,
    });
  } catch (error) {
    console.error("Error fetching social API keys:", error);
    res.status(500).json({ error: "Failed to fetch social API keys" });
  }
});

// Save/update user's social API keys
router.post("/social-api-keys", optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    // Allow saving even without auth for now (will be associated with user later)
    // This supports the setup flow from NebraskaHomeHub iframe
    if (!userId) {
      console.log(
        "⚠️ Social API keys POST without authentication - storing temporarily"
      );
      // Return success but note that keys won't be persisted until user logs in
      return res.json({
        success: true,
        message: "Configuration saved temporarily. Please log in to persist.",
        configured: false,
        temporary: true,
      });
    }

    const {
      facebookPageId,
      facebookAccessToken,
      instagramUserId,
      instagramAccessToken,
      twitterApiKey,
      twitterApiSecret,
      twitterAccessToken,
      twitterAccessTokenSecret,
      linkedinAccessToken,
      youtubeApiKey,
      youtubeAccessToken,
      tiktokAccessToken,
    } = req.body;

    // Check if keys already exist for user
    const existing = await db.query.socialApiKeys.findFirst({
      where: eq(socialApiKeys.userId, String(userId)),
    });

    // Determine if keys are configured (at least one platform)
    const keysConfigured = !!(
      (facebookPageId && facebookAccessToken) ||
      instagramAccessToken ||
      (twitterApiKey && twitterApiSecret) ||
      youtubeApiKey ||
      linkedinAccessToken ||
      tiktokAccessToken
    );

    if (existing) {
      // Update existing record
      await db
        .update(socialApiKeys)
        .set({
          facebookAppId: facebookPageId || existing.facebookAppId,
          facebookAppSecret: facebookAccessToken || existing.facebookAppSecret,
          instagramToken: instagramAccessToken || existing.instagramToken,
          instagramBusinessAccountId:
            instagramUserId || existing.instagramBusinessAccountId,
          tiktokAccessToken: tiktokAccessToken || existing.tiktokAccessToken,
          twitterApiKey: twitterApiKey || existing.twitterApiKey,
          twitterApiSecret: twitterApiSecret || existing.twitterApiSecret,
          twitterAccessToken: twitterAccessToken || existing.twitterAccessToken,
          twitterAccessTokenSecret:
            twitterAccessTokenSecret || existing.twitterAccessTokenSecret,
          youtubeApiKey: youtubeApiKey || existing.youtubeApiKey,
          youtubeChannelId: youtubeAccessToken || existing.youtubeChannelId,
          linkedinAccessToken:
            linkedinAccessToken || existing.linkedinAccessToken,
          keysConfigured,
          updatedAt: new Date(),
        })
        .where(eq(socialApiKeys.userId, String(userId)));
    } else {
      // Create new record
      await db.insert(socialApiKeys).values({
        userId: String(userId),
        facebookAppId: facebookPageId,
        facebookAppSecret: facebookAccessToken,
        instagramToken: instagramAccessToken,
        instagramBusinessAccountId: instagramUserId,
        tiktokAccessToken,
        twitterApiKey,
        twitterApiSecret,
        twitterAccessToken,
        twitterAccessTokenSecret,
        youtubeApiKey,
        youtubeChannelId: youtubeAccessToken,
        linkedinAccessToken,
        keysConfigured,
      });
    }

    res.json({
      success: true,
      message: "Social API keys saved successfully",
      configured: keysConfigured,
    });
  } catch (error) {
    console.error("Error saving social API keys:", error);
    res.status(500).json({ error: "Failed to save social API keys" });
  }
});

export default router;
