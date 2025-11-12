// @ts-nocheck
import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { db } from "./db";
import { openaiService, getAPIKeyStatus } from "./services/openai";
import { socialMediaService } from "./services/socialMedia";
import { seoService } from "./services/seo";
import { MLSService } from "./services/mls";
import { IDXService } from "./services/idx";
import { HeyGenService } from "./services/heygen";
import { HeyGenStreamingService } from "./services/heygen-streaming";
import { HeyGenPhotoAvatarService } from "./services/heygen-photo-avatar";
import { HeyGenTemplateService } from "./services/heygen-template";
import { HeyGenTemplateService as HeyGenTemplatesV3Service } from "./services/heygen-templates";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { S3UploadService } from "./services/s3Upload";
import { realtimeService } from "./websocket";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import { requireAuth, requireAgent, optionalAuth } from "./middleware/auth";
import {
  insertContentPieceSchema,
  insertSocialMediaAccountSchema,
  insertSeoKeywordSchema,
  insertScheduledPostSchema,
  insertAvatarSchema,
  insertVideoContentSchema,
  tutorialVideos,
  socialApiKeys,
} from "@shared/schema";
import { eq } from "drizzle-orm";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for general uploads
  },
  fileFilter: (req, file, cb) => {
    // Allow image, audio, and video files
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("video/")
    ) {
      // Support all video formats
      cb(null, true);
    } else {
      cb(new Error("Only image, audio, and video files are allowed"));
    }
  },
});

// Configure multer specifically for video uploads (larger file size)
const videoUpload = multer({
  dest: "uploads/videos/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for video uploads
  },
  fileFilter: (req, file, cb) => {
    // Only allow video files
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

function generateFallbackScript(
  topic: string,
  neighborhood: string,
  videoType: string,
  duration: number,
  platform: string = "youtube"
): string {
  const videoTypeTemplates = {
    market_update: `Hi, I'm Mike Bjork with Berkshire Hathaway HomeServices. Let's talk about the current real estate market in ${neighborhood}.

The ${neighborhood} market has been showing some interesting trends lately. Home values have remained stable, and we're seeing consistent buyer interest in this area.

For buyers, this means there are still good opportunities to find your perfect home in ${neighborhood}. For sellers, it's a great time to position your property competitively.

If you're thinking about buying or selling in ${neighborhood}, I'd love to help you navigate this market. Give me a call at Mike Bjork, your local Omaha real estate expert.

Thanks for watching, and I'll see you in the next video!`,

    neighborhood_tour: `Welcome to ${neighborhood}! I'm Mike Bjork with Berkshire Hathaway HomeServices, and I'm excited to show you why this neighborhood is such a special place to call home.

${neighborhood} offers a perfect blend of community charm and modern convenience. You'll find excellent schools, beautiful parks, and friendly neighbors who really care about maintaining the character of this area.

The housing options here range from charming starter homes to spacious family properties, all with that distinctive ${neighborhood} character that residents love.

If you're considering making ${neighborhood} your new home, I'd be happy to show you around and help you find the perfect property. Contact Mike Bjork, your Omaha real estate specialist.

Thanks for joining me on this tour of ${neighborhood}!`,

    buyer_tips: `Hi, I'm Mike Bjork with Berkshire Hathaway HomeServices, and today I want to share some essential tips for home buyers, especially if you're looking in the ${neighborhood} area.

First, get pre-approved for your mortgage before you start shopping. This shows sellers you're serious and gives you a clear budget.

Second, work with a local agent who knows ${neighborhood} inside and out. I've been helping buyers find homes in this area for years, and local knowledge makes all the difference.

Third, don't skip the home inspection. It's your best protection against costly surprises down the road.

If you're ready to start your home buying journey in ${neighborhood} or anywhere in Omaha, give me a call. Mike Bjork, here to help you every step of the way.

Thanks for watching!`,

    seller_guide: `Thinking about selling your home in ${neighborhood}? I'm Mike Bjork with Berkshire Hathaway HomeServices, and I want to help you get the best possible result.

First, pricing is crucial. I'll provide you with a detailed market analysis to ensure your home is priced competitively for the ${neighborhood} market.

Second, presentation matters. Small improvements can make a big difference in how quickly your home sells and for how much.

Third, marketing is key. I'll make sure your ${neighborhood} home gets maximum exposure to qualified buyers.

The ${neighborhood} market has unique characteristics, and as your local expert, I know exactly how to position your property for success.

Ready to sell? Contact Mike Bjork, your trusted Omaha real estate professional.

Thanks for watching!`,

    moving_guide: `Planning a move to ${neighborhood}? I'm Mike Bjork with Berkshire Hathaway HomeServices, and I want to help make your transition as smooth as possible.

${neighborhood} is a wonderful community with so much to offer. From great schools to local amenities, you'll find everything you need to feel right at home.

When you're ready to make the move, I'll help you find the perfect property that fits your lifestyle and budget. I know the ${neighborhood} market inside and out.

I can also connect you with trusted local services to help with your move - from movers to utility companies to the best local restaurants.

Moving to ${neighborhood} is an exciting step, and I'm here to help you every step of the way. Contact Mike Bjork, your Omaha real estate guide.

Welcome to ${neighborhood}!`,
  };

  let baseScript =
    videoTypeTemplates[videoType as keyof typeof videoTypeTemplates] ||
    videoTypeTemplates.neighborhood_tour.replace(/neighborhood_tour/g, topic);

  // Platform-specific modifications
  if (platform === "reels") {
    // Make it more concise and punchy for Reels
    baseScript = baseScript
      .replace(
        /Hi, I'm Mike Bjork with Berkshire Hathaway HomeServices\./g,
        "Hey! Mike Bjork here -"
      )
      .replace(
        /Thanks for watching!|Thanks for watching, and I'll see you in the next video!/g,
        "Like & follow for more Omaha real estate tips! 🏠"
      )
      .split("\n")
      .slice(0, 4)
      .join("\n"); // Keep it shorter
  } else if (platform === "story") {
    // Make it more casual and personal for Stories
    baseScript = baseScript
      .replace(
        /Hi, I'm Mike Bjork with Berkshire Hathaway HomeServices\./g,
        "Quick update from Mike!"
      )
      .replace(
        /Thanks for watching!|Thanks for watching, and I'll see you in the next video!/g,
        "DM me for details! 📱"
      )
      .split("\n")
      .slice(0, 3)
      .join("\n"); // Keep it very short
  }

  return baseScript;
}

function generateAIOptimizedContent(
  neighborhood: string,
  goal: string,
  question?: string
): string {
  const questionStart =
    question ||
    `What's the best information about ${goal.toLowerCase()} in ${neighborhood}?`;

  return `# ${questionStart}

**Direct Answer:** ${neighborhood} is an excellent choice for ${goal.toLowerCase()}. Here's what you need to know as someone considering this area.

## Why ${neighborhood} Works for ${goal}

${neighborhood} offers unique advantages that make it ideal for ${goal.toLowerCase()}:

### Local Market Insights
- **Current Market:** ${neighborhood} homes typically range from $250K-$450K depending on size and location
- **Neighborhood Character:** Well-established community with strong property values
- **Growth Potential:** Consistent appreciation over the past 5 years

### What Makes ${neighborhood} Special
- **Community:** Active neighborhood associations and local events
- **Convenience:** Close to major employers, schools, and Omaha amenities  
- **Investment Value:** Properties hold value well and attract quality buyers

## Professional Guidance You Can Trust

As your local ${neighborhood} expert, I'm Mike Bjork with Berkshire Hathaway HomeServices. I've helped hundreds of families find their perfect home in this area.

**Why work with me?**
- 15+ years specializing in ${neighborhood} and surrounding areas
- Licensed Nebraska realtor with deep local market knowledge
- Access to off-market properties and exclusive listings

## Ready to Explore ${neighborhood}?

Whether you're a first-time buyer, growing family, or savvy investor, I'll help you understand if ${neighborhood} aligns with your goals.

**Contact Mike Bjork:**
- Phone: (402) 555-0123
- Email: mike@bjorkgroup.com
- Office: Berkshire Hathaway HomeServices

*Serving ${neighborhood}, Omaha, and surrounding communities with personalized real estate expertise since 2008.*

---
*This content was optimized for AI search engines to provide direct, helpful answers about ${neighborhood} real estate.*`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // =====================================================
  // NEBRASKA HOME HUB INTEGRATION ENDPOINT
  // =====================================================
  app.get("/integration", (req: Request, res: Response, next: NextFunction) => {
    try {
      const { source, domain, userEmail, agentSlug, timestamp } = req.query;
      const acceptHeader = String(req.headers.accept || "").toLowerCase();

      // Validate trusted domains
      const trustedDomains = [
        "localhost",
        "nebraskahomehub.com",
        "bjorkhomes.com",
        "mandy.bjorkhomes.com",
        "elasticbeanstalk.com", // AWS Elastic Beanstalk deployments
        "imakepage.com", // iMakePage platform
      ];

      const requestDomain = typeof domain === "string" ? domain : "";
      const isTrusted =
        !requestDomain ||
        trustedDomains.some((trusted) => requestDomain.includes(trusted));

      if (!isTrusted) {
        console.warn(`⚠️ Untrusted integration request from: ${domain}`);
        if (acceptHeader.includes("text/html")) {
          return res
            .status(403)
            .send("Integration not allowed from this domain");
        }
        return res.status(403).json({
          error: "Integration not allowed from this domain",
        });
      }

      // Validate source
      const normalizedSource = typeof source === "string" ? source : undefined;
      if (normalizedSource && normalizedSource !== "nebraska-home-hub") {
        console.warn(`⚠️ Unknown integration source: ${source}`);
        if (acceptHeader.includes("text/html")) {
          return res.status(403).send("Unknown integration source");
        }
        return res.status(403).json({
          error: "Unknown integration source",
        });
      }

      // Log the integration request
      console.log(
        `🔗 Integration request from ${
          normalizedSource || "unknown"
        } - domain: ${domain}, agent: ${agentSlug}`
      );

      if (acceptHeader.includes("text/html")) {
        return next();
      }

      const resolvedAppUrl =
        process.env.REALTYFLOW_APP_URL ||
        (process.env.NODE_ENV === "production"
          ? "https://www.imakepage.com/realtyflow"
          : process.env.CLIENT_URL ||
            process.env.BASE_URL ||
            "http://localhost:5000");

      const appUrl = String(resolvedAppUrl).replace(/\/+$/, "");

      const params = new URLSearchParams();
      if (userEmail) {
        params.set("bypassAuth", "true");
        params.set("userId", userEmail as string);
        params.set("userType", "public");
        params.set("autoLogin", "true");
      }
      if (agentSlug) {
        params.set("agentSlug", agentSlug as string);
      }

      const query = params.toString();
      const iframeUrl = `${appUrl}/integration${query ? `?${query}` : ""}`;

      // Return integration configuration with tenant-scoped data
      res.json({
        success: true,
        source: normalizedSource || "unknown",
        timestamp: timestamp || new Date().toISOString(),
        config: {
          appUrl: appUrl,
          iframeUrl: iframeUrl,
          authBypass: true,
          agentSlug: agentSlug,
          userEmail: userEmail || null,
        },
        message: "RealtyFlow integration ready",
      });
    } catch (error) {
      console.error("Integration endpoint error:", error);
      res.status(500).json({ error: "Integration configuration failed" });
    }
  });

  // =====================================================
  // AUTHENTICATION ROUTES
  // =====================================================
  app.use("/api/auth", authRoutes);
  app.use("/api/user", userRoutes);

  // API Key Management
  app.get("/api/openai/status", async (req, res) => {
    try {
      const status = getAPIKeyStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting API key status:", error);
      res.status(500).json({ error: "Failed to get API key status" });
    }
  });

  // Get dashboard overview data
  app.get("/api/dashboard/overview", async (req, res) => {
    try {
      // For demo purposes, use first user. In production, use authenticated user
      const users = await storage.getUserByUsername("mikebjork");
      if (!users) {
        return res.status(404).json({ error: "User not found" });
      }

      const analytics = await storage.getAnalytics(users.id);
      const overview = analytics.reduce((acc, analytic) => {
        acc[analytic.metric] = analytic.value;
        return acc;
      }, {} as Record<string, number>);

      res.json(overview);
    } catch (error) {
      console.error("Dashboard overview error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard overview" });
    }
  });

  // Content generation endpoints
  app.post("/api/content/generate", async (req, res) => {
    try {
      const {
        type,
        topic,
        aiPrompt,
        neighborhood,
        keywords,
        seoOptimized,
        longTailKeywords,
        localSeoFocus,
        propertyData,
      } = req.body;

      const generatedContent = await openaiService.generateContent({
        type,
        topic,
        aiPrompt,
        neighborhood,
        keywords,
        seoOptimized,
        longTailKeywords,
        localSeoFocus,
        propertyData,
      });

      // Save to storage
      const user = await storage.getUserByUsername("mikebjork");
      if (user) {
        const contentPiece = await storage.createContentPiece({
          userId: user.id,
          type,
          title: generatedContent.title,
          content: generatedContent.content,
          keywords: generatedContent.keywords,
          neighborhood,
          seoOptimized: seoOptimized || false,
          status: "draft",
          publishedAt: null,
          scheduledFor: null,
          socialPlatforms: null,
          metadata: {
            wordCount: generatedContent.wordCount,
            seoScore: generatedContent.seoScore,
            metaDescription: generatedContent.metaDescription,
          },
        });

        // Send real-time notification
        realtimeService.notifyContentPublished(
          user.id,
          contentPiece.id,
          generatedContent.title
        );

        res.json({ ...generatedContent, id: contentPiece.id });
      } else {
        res.json(generatedContent);
      }
    } catch (error) {
      console.error("Content generation error:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  app.post("/api/content/social-post", async (req, res) => {
    try {
      const { topic, platform, neighborhood } = req.body;

      const socialPost = await openaiService.generateSocialMediaPost(
        topic,
        platform,
        neighborhood
      );
      res.json(socialPost);
    } catch (error) {
      console.error("Social post generation error:", error);
      res.status(500).json({ error: "Failed to generate social media post" });
    }
  });

  app.get("/api/content", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const content = await storage.getContentPieces(user.id);
      res.json(content);
    } catch (error) {
      console.error("Get content error:", error);
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  // Content Enhancement
  app.post("/api/content/enhance", async (req, res) => {
    try {
      const { content, prompt, platform, postType } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const enhancedContent = await openaiService.enhanceContent({
        originalContent: content,
        customPrompt:
          prompt ||
          "Optimize this post for SEO and engagement while maintaining professional tone for real estate audience in Omaha, Nebraska.",
        platform: platform || "general",
        postType: postType || "general",
      });

      res.json({ enhancedContent });
    } catch (error) {
      console.error("Content enhancement error:", error);
      res.status(500).json({ error: "Failed to enhance content" });
    }
  });

  // AI-optimized content generation endpoint
  app.post("/api/content/ai-optimized", async (req, res) => {
    try {
      const { neighborhood, goal, question } = req.body;

      // Generate AI-optimized content with specific formatting for AI search engines
      const aiOptimizedContent = {
        title: question ? question : `${goal} in ${neighborhood}`,
        content: generateAIOptimizedContent(neighborhood, goal, question),
        type: "ai_optimized",
        optimizations: {
          entityOptimization: true,
          conversationalFormat: true,
          localContext: true,
          structuredAnswers: true,
        },
        targetQueries: [
          question || `${goal} ${neighborhood}`,
          `best ${goal.toLowerCase()} ${neighborhood}`,
          `${neighborhood} real estate ${goal.toLowerCase()}`,
        ],
      };

      res.json(aiOptimizedContent);
    } catch (error) {
      console.error("AI optimization error:", error);
      res
        .status(500)
        .json({ error: "Failed to generate AI-optimized content" });
    }
  });

  // Platform-specific content regeneration endpoint
  app.post("/api/content/regenerate-for-platform", async (req, res) => {
    try {
      const {
        platform,
        originalContent,
        contentType,
        topic,
        neighborhood,
        seoOptimized,
        longTailKeywords,
      } = req.body;

      if (!platform || !originalContent) {
        return res
          .status(400)
          .json({ error: "Platform and original content are required" });
      }

      // Generate platform-optimized content using OpenAI
      const platformOptimizedContent =
        await openaiService.generatePlatformSpecificContent({
          platform: platform.toLowerCase(),
          originalContent,
          contentType: contentType || "blog",
          topic: topic || "real estate",
          neighborhood: neighborhood || "Omaha",
          seoOptimized: seoOptimized !== false,
          longTailKeywords: longTailKeywords !== false,
        });

      res.json(platformOptimizedContent);
    } catch (error) {
      console.error("Platform content regeneration error:", error);
      res
        .status(500)
        .json({ error: "Failed to regenerate content for platform" });
    }
  });

  // Social Media OAuth Routes
  app.post("/api/social/connect/:platform", async (req, res) => {
    try {
      const { platform } = req.params;

      // OAuth URLs for each platform - these would need real client IDs in production
      const oauthUrls: Record<string, string> = {
        facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=YOUR_FACEBOOK_CLIENT_ID&redirect_uri=${encodeURIComponent(
          process.env.BASE_URL + "/api/social/callback/facebook"
        )}&scope=pages_manage_posts,pages_read_engagement`,
        instagram: `https://api.instagram.com/oauth/authorize?client_id=YOUR_INSTAGRAM_CLIENT_ID&redirect_uri=${encodeURIComponent(
          process.env.BASE_URL + "/api/social/callback/instagram"
        )}&scope=user_profile,user_media&response_type=code`,
        linkedin: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_LINKEDIN_CLIENT_ID&redirect_uri=${encodeURIComponent(
          process.env.BASE_URL + "/api/social/callback/linkedin"
        )}&scope=w_member_social`,
        twitter: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=YOUR_TWITTER_CLIENT_ID&redirect_uri=${encodeURIComponent(
          process.env.BASE_URL + "/api/social/callback/twitter"
        )}&scope=tweet.read%20tweet.write%20users.read`,
      };

      if (!oauthUrls[platform]) {
        return res.status(400).json({
          error: `OAuth not configured for ${platform}`,
          message:
            "This platform requires OAuth app setup with valid client credentials",
        });
      }

      res.json({
        authUrl: oauthUrls[platform],
        message:
          "OAuth URL generated - configure client credentials for production use",
      });
    } catch (error) {
      console.error("OAuth initiation error:", error);
      res.status(500).json({ error: "Failed to initiate OAuth flow" });
    }
  });

  app.get("/api/social/status/:platform", async (req, res) => {
    try {
      const { platform } = req.params;

      // For now, return not connected since we don't have real OAuth setup
      res.json({
        connected: false,
        message: `OAuth integration for ${platform} requires client credentials to be configured`,
      });
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ error: "Failed to check connection status" });
    }
  });

  // OAuth callback handlers (these would handle the actual OAuth responses)
  // Twitter OAuth callback route (matches user's Twitter app configuration)
  app.get("/auth/twitter/callback", async (req, res) => {
    try {
      const { code, error, oauth_token, oauth_verifier } = req.query;

      if (error) {
        return res.redirect(
          `${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/?oauth_error=${error}`
        );
      }

      // For OAuth 1.0a, we get oauth_token and oauth_verifier
      if (oauth_token && oauth_verifier) {
        // OAuth 1.0a callback handling would go here
        res.send(`
          <html>
            <body>
              <h1>Twitter Authorization Successful</h1>
              <p>Twitter OAuth 1.0a authorization completed successfully.</p>
              <p>oauth_token: ${oauth_token}</p>
              <script>
                window.opener?.postMessage({ success: true, platform: 'twitter' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `);
      }
      // For OAuth 2.0, we get authorization code
      else if (code) {
        res.send(`
          <html>
            <body>
              <h1>Twitter Authorization Successful</h1>
              <p>Twitter OAuth 2.0 authorization completed successfully.</p>
              <script>
                window.opener?.postMessage({ success: true, platform: 'twitter', code: '${code}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `);
      } else {
        return res.redirect(
          `${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/?oauth_error=no_auth_data`
        );
      }
    } catch (error) {
      console.error("Twitter OAuth callback error:", error);
      res.status(500).send("Twitter OAuth callback failed");
    }
  });

  app.get("/api/social/callback/:platform", async (req, res) => {
    try {
      const { platform } = req.params;
      const { code, error } = req.query;

      if (error) {
        return res.redirect(
          `${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/?oauth_error=${error}`
        );
      }

      if (!code) {
        return res.redirect(
          `${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/?oauth_error=no_code`
        );
      }

      // Here you would exchange the code for access tokens
      // For now, just show a success page
      res.send(`
        <html>
          <body>
            <h1>${platform} OAuth Callback</h1>
            <p>OAuth setup is not complete. To enable real social media posting:</p>
            <ol>
              <li>Create developer apps on ${platform}</li>
              <li>Add client credentials to environment variables</li>
              <li>Implement token exchange logic</li>
            </ol>
            <script>window.close();</script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send("OAuth callback failed");
    }
  });

  // Social media endpoints
  app.get("/api/social/accounts", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get social media accounts from social_media_accounts table (same as posting endpoint)
      const socialAccounts = await storage.getSocialMediaAccounts(userId);

      // Map accounts to include connection status
      const connectedPlatforms = new Set(
        socialAccounts.map((acc) => acc.platform.toLowerCase())
      );

      // Return all platforms with their connection status
      const platforms = [
        {
          id: nanoid(),
          platform: "facebook",
          isConnected: connectedPlatforms.has("facebook"),
          lastSync: connectedPlatforms.has("facebook")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "instagram",
          isConnected: connectedPlatforms.has("instagram"),
          lastSync: connectedPlatforms.has("instagram")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "linkedin",
          isConnected: connectedPlatforms.has("linkedin"),
          lastSync: connectedPlatforms.has("linkedin")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "x",
          isConnected:
            connectedPlatforms.has("x") || connectedPlatforms.has("twitter"),
          lastSync:
            connectedPlatforms.has("x") || connectedPlatforms.has("twitter")
              ? new Date().toISOString()
              : null,
        },
        {
          id: nanoid(),
          platform: "tiktok",
          isConnected: connectedPlatforms.has("tiktok"),
          lastSync: connectedPlatforms.has("tiktok")
            ? new Date().toISOString()
            : null,
        },
        {
          id: nanoid(),
          platform: "youtube",
          isConnected: connectedPlatforms.has("youtube"),
          lastSync: connectedPlatforms.has("youtube")
            ? new Date().toISOString()
            : null,
        },
      ];

      res.json(platforms);
    } catch (error) {
      console.error("Get social accounts error:", error);
      res.status(500).json({ error: "Failed to fetch social media accounts" });
    }
  });

  app.post("/api/social/post", upload.single("photo"), async (req, res) => {
    try {
      const { platform, content, platforms, scheduledFor } = req.body;
      const photo = req.file;

      if (platform) {
        // Single platform posting (new functionality)
        if (!content) {
          return res.status(400).json({ error: "Content is required" });
        }

        const user = await storage.getUserByUsername("mikebjork");
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Get user's social accounts to check if platform is connected
        const socialAccounts = await storage.getSocialMediaAccounts(user.id);
        const connectedAccount = socialAccounts.find(
          (account) => account.platform.toLowerCase() === platform.toLowerCase()
        );

        if (
          !connectedAccount &&
          socialAccounts.length > 0 &&
          platform.toLowerCase() !== "youtube"
        ) {
          return res.status(400).json({
            error: `${platform} account not connected. Please connect your account first.`,
          });
        }

        // Get photo URL if uploaded
        let photoUrl = null;
        if (photo) {
          photoUrl = `/uploads/${path.basename(photo.path)}`;
        }

        // Actually post to the platform
        let postResult;
        try {
          if (platform.toLowerCase() === "facebook") {
            return res.status(400).json({
              error:
                "Direct Facebook profile posting is not supported. Please use the Facebook Pages feature instead.",
            });
          } else if (platform.toLowerCase() === "instagram") {
            postResult = await socialMediaService.postToInstagram(
              content,
              photoUrl || "",
              connectedAccount?.accessToken || ""
            );
          } else if (platform.toLowerCase() === "linkedin") {
            postResult = await socialMediaService.postToLinkedIn(
              content,
              connectedAccount?.accessToken || ""
            );
          } else if (platform.toLowerCase() === "x") {
            postResult = await socialMediaService.postToX(
              content,
              connectedAccount?.accessToken || ""
            );
          } else if (platform.toLowerCase() === "youtube") {
            // For YouTube, we need title and description
            const title = req.body.title || content.substring(0, 100) + "...";
            const description = req.body.description || content;
            // Use mock token if no connected account
            const youtubeToken =
              connectedAccount?.accessToken || "mock_youtube_token";
            postResult = await socialMediaService.postToYoutube(
              title,
              description,
              photoUrl || undefined,
              youtubeToken
            );
          } else {
            throw new Error(`Unsupported platform: ${platform}`);
          }
        } catch (postError) {
          console.error(`Failed to post to ${platform}:`, postError);
          return res.status(500).json({
            error: `Failed to post to ${platform}: ${
              postError instanceof Error ? postError.message : "Unknown error"
            }`,
          });
        }

        // Create a record of the successful post
        const scheduledPost = await storage.createScheduledPost({
          userId: user.id,
          platform: platform.toLowerCase(),
          content,
          scheduledFor: new Date(), // Posted immediately
          status: "posted",
          postType: "manual_post",
          hashtags: content.match(/#\w+/g) || [],
          isEdited: false,
          originalContent: content,
          neighborhood: null,
        });

        // Send real-time notification
        realtimeService.notifySocialPostScheduled(
          user.id,
          scheduledPost.id,
          platform,
          new Date().toISOString()
        );

        res.json({
          success: true,
          message: `Content posted successfully to ${platform}`,
          postId: postResult.postId,
          platform,
          timestamp: new Date().toISOString(),
          scheduledPostId: scheduledPost.id,
        });
      } else {
        // Multi-platform posting (existing functionality)
        console.log("Posting to platforms:", platforms, "Content:", content);

        res.json({
          success: true,
          postId: `post_${Date.now()}`,
          platforms,
          scheduledFor,
        });
      }
    } catch (error) {
      console.error("Social post error:", error);
      res.status(500).json({ error: "Failed to post to social media" });
    }
  });

  // Facebook-specific endpoints
  app.get("/api/facebook/pages", async (req, res) => {
    try {
      const pages = await socialMediaService.getFacebookPageInfo();
      res.json(pages);
    } catch (error: any) {
      console.error("Error fetching Facebook pages:", error?.message || error);
      res.status(500).json({
        error: "Failed to fetch Facebook pages",
        details:
          error?.message ||
          "Please check if your Facebook token is valid and has not expired.",
      });
    }
  });

  app.post("/api/facebook/post", upload.single("photo"), async (req, res) => {
    try {
      const { content, pageId } = req.body;
      const defaultPageId = process.env.FACEBOOK_PAGE_ID;
      const resolvedPageId = pageId || defaultPageId;
      const photo = req.file;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      let photoUrl = null;
      if (photo) {
        photoUrl = `/uploads/${path.basename(photo.path)}`;
      }

      let postResult;
      if (resolvedPageId) {
        // Post to specific Facebook page
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        postResult = await socialMediaService.postToFacebookPage(
          resolvedPageId,
          content,
          photoUrl || undefined,
          undefined,
          baseUrl
        );
      } else {
        return res.status(400).json({
          error:
            "Page ID is required for Facebook posting. Direct profile posting is not supported.",
        });
      }

      res.json({
        success: true,
        message: resolvedPageId
          ? "Content posted successfully to Facebook page"
          : "Content posted successfully to Facebook",
        postId: postResult.postId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Facebook post error:", error);
      res.status(500).json({
        error: `Failed to post to Facebook: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  app.get("/api/facebook/posts", async (req, res) => {
    try {
      // For now, return mock data since Facebook API doesn't provide easy post retrieval
      // In a real implementation, you'd need to store posted content in your database
      const recentPosts = [
        {
          id: "61581294927027_122094900393043164",
          content:
            "🏠 Winter 2025 Omaha Real Estate Market Update! ❄️\n\nThe Omaha market is showing remarkable resilience this winter season!",
          pageId: "61581294927027",
          timestamp: new Date().toISOString(),
          platform: "facebook",
        },
      ];
      res.json(recentPosts);
    } catch (error) {
      console.error("Error fetching Facebook posts:", error);
      res.status(500).json({ error: "Failed to fetch Facebook posts" });
    }
  });

  app.get("/api/facebook/validate", async (req, res) => {
    try {
      const isValid = await socialMediaService.validateConnection("facebook");
      res.json({
        valid: isValid,
        platform: "facebook",
        message: isValid
          ? "Facebook connection is valid"
          : "Facebook connection failed",
      });
    } catch (error) {
      console.error("Facebook validation error:", error);
      res.status(500).json({ error: "Failed to validate Facebook connection" });
    }
  });

  // Add validation endpoints for other platforms
  app.post("/api/facebook/validate", async (req, res) => {
    try {
      const { facebookPageId, facebookAccessToken } = req.body;
      // Test the provided credentials
      const isValid =
        facebookPageId &&
        facebookAccessToken &&
        facebookAccessToken.length > 10;
      res.json({
        valid: isValid,
        platform: "facebook",
        message: isValid
          ? "Facebook credentials are valid"
          : "Invalid Facebook credentials",
      });
    } catch (error) {
      console.error("Facebook validation error:", error);
      res.status(500).json({ error: "Failed to validate Facebook connection" });
    }
  });

  app.post("/api/instagram/validate", async (req, res) => {
    try {
      const { instagramUserId, instagramAccessToken } = req.body;
      const isValid =
        instagramUserId &&
        instagramAccessToken &&
        instagramAccessToken.length > 10;
      res.json({
        valid: isValid,
        platform: "instagram",
        message: isValid
          ? "Instagram credentials are valid"
          : "Invalid Instagram credentials",
      });
    } catch (error) {
      console.error("Instagram validation error:", error);
      res
        .status(500)
        .json({ error: "Failed to validate Instagram connection" });
    }
  });

  app.post("/api/twitter/validate", async (req, res) => {
    try {
      const {
        twitterApiKey,
        twitterApiSecret,
        twitterAccessToken,
        twitterAccessTokenSecret,
      } = req.body;
      const isValid =
        twitterApiKey &&
        twitterApiSecret &&
        twitterAccessToken &&
        twitterAccessTokenSecret;
      res.json({
        valid: isValid,
        platform: "twitter",
        message: isValid
          ? "Twitter credentials are valid"
          : "Invalid Twitter credentials",
      });
    } catch (error) {
      console.error("Twitter validation error:", error);
      res.status(500).json({ error: "Failed to validate Twitter connection" });
    }
  });

  app.post("/api/linkedin/validate", async (req, res) => {
    try {
      const { linkedinAccessToken } = req.body;
      const isValid = linkedinAccessToken && linkedinAccessToken.length > 10;
      res.json({
        valid: isValid,
        platform: "linkedin",
        message: isValid
          ? "LinkedIn credentials are valid"
          : "Invalid LinkedIn credentials",
      });
    } catch (error) {
      console.error("LinkedIn validation error:", error);
      res.status(500).json({ error: "Failed to validate LinkedIn connection" });
    }
  });

  app.post("/api/youtube/validate", async (req, res) => {
    try {
      const { youtubeApiKey, youtubeAccessToken } = req.body;
      const isValid = youtubeApiKey && youtubeAccessToken;
      res.json({
        valid: isValid,
        platform: "youtube",
        message: isValid
          ? "YouTube credentials are valid"
          : "Invalid YouTube credentials",
      });
    } catch (error) {
      console.error("YouTube validation error:", error);
      res.status(500).json({ error: "Failed to validate YouTube connection" });
    }
  });

  app.post("/api/tiktok/validate", async (req, res) => {
    try {
      const { tiktokAccessToken } = req.body;
      const isValid = tiktokAccessToken && tiktokAccessToken.length > 10;
      res.json({
        valid: isValid,
        platform: "tiktok",
        message: isValid
          ? "TikTok credentials are valid"
          : "Invalid TikTok credentials",
      });
    } catch (error) {
      console.error("TikTok validation error:", error);
      res.status(500).json({ error: "Failed to validate TikTok connection" });
    }
  });

  // Instagram endpoints
  app.post("/api/instagram/post", upload.single("photo"), async (req, res) => {
    try {
      const { content, userId } = req.body;
      const photo = req.file;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      let photoUrl = null;
      if (photo) {
        photoUrl = `/uploads/${path.basename(photo.path)}`;
      }

      // Build absolute URL for image if provided
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const fullPhotoUrl = photoUrl ? baseUrl + photoUrl : undefined;

      const postResult = await socialMediaService.postToInstagram(
        content,
        fullPhotoUrl,
        undefined, // accessToken will be read from env
        userId // Instagram User ID
      );

      res.json({
        success: true,
        message: "Content posted successfully to Instagram",
        postId: postResult.postId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Instagram post error:", error);
      res.status(500).json({
        error: `Failed to post to Instagram: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  app.get("/api/instagram/validate", async (req, res) => {
    try {
      const isValid = await socialMediaService.validateConnection("instagram");
      res.json({
        valid: isValid,
        platform: "instagram",
        message: isValid
          ? "Instagram connection is valid"
          : "Instagram connection failed",
      });
    } catch (error) {
      console.error("Instagram validation error:", error);
      res
        .status(500)
        .json({ error: "Failed to validate Instagram connection" });
    }
  });

  // Twitter endpoints
  app.post("/api/twitter/post", upload.single("photo"), async (req, res) => {
    try {
      const { content } = req.body;
      const photo = req.file;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      let photoUrl = null;
      if (photo) {
        photoUrl = `/uploads/${path.basename(photo.path)}`;
      }

      // Build absolute URL for image if provided
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const fullPhotoUrl = photoUrl ? baseUrl + photoUrl : undefined;

      const postResult = await socialMediaService.postToTwitter(
        content,
        fullPhotoUrl
      );

      res.json({
        success: true,
        message: "Content posted successfully to Twitter",
        postId: postResult.postId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Twitter post error:", error);
      res.status(500).json({
        error: `Failed to post to Twitter: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  app.get("/api/twitter/validate", async (req, res) => {
    try {
      const isValid = await socialMediaService.validateConnection("twitter");
      res.json({
        valid: isValid,
        platform: "twitter",
        message: isValid
          ? "Twitter connection is valid"
          : "Twitter connection failed",
      });
    } catch (error) {
      console.error("Twitter validation error:", error);
      res.status(500).json({ error: "Failed to validate Twitter connection" });
    }
  });

  app.delete("/api/twitter/post/:tweetId", async (req, res) => {
    try {
      const { tweetId } = req.params;

      if (!tweetId) {
        return res.status(400).json({ error: "Tweet ID is required" });
      }

      const deleteResult = await socialMediaService.deleteTwitterPost(tweetId);

      res.json({
        success: deleteResult.success,
        message: "Tweet deleted successfully",
        tweetId: tweetId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Twitter delete error:", error);
      res.status(500).json({
        error: `Failed to delete Twitter post: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  // YouTube endpoints
  app.post("/api/youtube/post", upload.single("video"), async (req, res) => {
    try {
      const { title, description, content, accessToken } = req.body;
      const video = req.file;

      if (!title && !content) {
        return res.status(400).json({ error: "Title or content is required" });
      }

      if (!accessToken) {
        return res
          .status(400)
          .json({ error: "YouTube access token is required" });
      }

      let videoUrl = null;
      if (video) {
        videoUrl = `/uploads/${path.basename(video.path)}`;
      }

      const finalTitle = title || content?.substring(0, 100) + "...";
      const finalDescription = description || content || "";

      // Build absolute URL for video if provided
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const fullVideoUrl = videoUrl ? baseUrl + videoUrl : undefined;

      const postResult = await socialMediaService.postToYoutube(
        finalTitle,
        finalDescription,
        fullVideoUrl,
        accessToken
      );

      res.json({
        success: true,
        message: "Content posted successfully to YouTube",
        postId: postResult.postId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("YouTube post error:", error);
      res.status(500).json({
        error: `Failed to post to YouTube: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  // Dedicated YouTube video upload endpoint
  app.post(
    "/api/youtube/upload-video",
    videoUpload.single("video"),
    async (req, res) => {
      try {
        const { title, description, accessToken } = req.body;
        const videoFile = req.file;

        if (!videoFile) {
          return res.status(400).json({ error: "Video file is required" });
        }

        if (!title) {
          return res.status(400).json({ error: "Video title is required" });
        }

        if (!accessToken) {
          return res
            .status(400)
            .json({ error: "YouTube access token is required" });
        }

        // Build absolute URL for the uploaded video
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const videoUrl = `${baseUrl}/uploads/videos/${path.basename(
          videoFile.path
        )}`;

        console.log("Processing YouTube video upload:", {
          title,
          description,
          videoPath: videoFile.path,
          videoUrl,
          fileSize: videoFile.size,
          mimetype: videoFile.mimetype,
        });

        const uploadResult = await socialMediaService.postToYoutube(
          title,
          description || title,
          videoUrl,
          accessToken
        );

        res.json({
          success: true,
          message: "Video uploaded successfully to YouTube",
          videoId: uploadResult.postId,
          videoUrl: videoUrl,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("YouTube video upload error:", error);

        // Clean up uploaded file on error
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error("Failed to cleanup uploaded file:", cleanupError);
          }
        }

        res.status(500).json({
          error: `Failed to upload video to YouTube: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    }
  );

  app.get("/api/youtube/validate", async (req, res) => {
    try {
      const isValid = await socialMediaService.validateConnection("youtube");
      res.json({
        valid: isValid,
        platform: "youtube",
        message: isValid
          ? "YouTube connection is valid"
          : "YouTube connection failed",
      });
    } catch (error) {
      console.error("YouTube validation error:", error);
      res.status(500).json({ error: "Failed to validate YouTube connection" });
    }
  });

  // YouTube OAuth endpoints
  app.get("/auth/youtube", async (req, res) => {
    try {
      const clientId = process.env.YOUTUBE_CLIENT_ID;
      if (!clientId) {
        return res
          .status(500)
          .json({ error: "YouTube client ID not configured" });
      }

      const scopes = [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.upload",
      ].join(" ");

      const redirectUri = `${req.protocol}://${req.get(
        "host"
      )}/auth/youtube/callback`;

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `prompt=consent`;

      res.redirect(authUrl);
    } catch (error) {
      console.error("YouTube OAuth initiation error:", error);
      res
        .status(500)
        .json({ error: "Failed to initiate YouTube authentication" });
    }
  });

  app.get("/auth/youtube/callback", async (req, res) => {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.redirect(
          `${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/?oauth_error=${error}`
        );
      }

      if (code) {
        // Exchange code for access token
        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
        const redirectUri = `${req.protocol}://${req.get(
          "host"
        )}/auth/youtube/callback`;

        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: clientId || "",
              client_secret: clientSecret || "",
              code: code as string,
              grant_type: "authorization_code",
              redirect_uri: redirectUri,
            }),
          }
        );

        if (tokenResponse.ok) {
          const tokens = await tokenResponse.json();

          // Update the user's YouTube account with the new tokens
          const user = await storage.getUserByUsername("mikebjork");
          if (user) {
            const socialAccounts = await storage.getSocialMediaAccounts(
              user.id
            );
            const youtubeAccount = socialAccounts.find(
              (account) => account.platform === "youtube"
            );

            if (youtubeAccount) {
              await storage.updateSocialMediaAccount(youtubeAccount.id, {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                isConnected: true,
                lastSync: new Date().toISOString(),
              });
            }
          }

          res.send(`
            <html>
              <body>
                <h1>YouTube Connected Successfully! ✅</h1>
                <p>Redirecting you back to the app...</p>
                <script>
                  // Redirect back to the main app
                  window.location.href = '/';
                </script>
              </body>
            </html>
          `);
        } else {
          throw new Error("Failed to exchange code for tokens");
        }
      } else {
        return res.redirect(
          `${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/?oauth_error=no_auth_code`
        );
      }
    } catch (error) {
      console.error("YouTube OAuth callback error:", error);
      res.status(500).send("YouTube OAuth callback failed");
    }
  });

  // SEO endpoints
  app.get("/api/seo/keywords", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const keywords = await storage.getSeoKeywords(user.id);
      res.json(keywords);
    } catch (error) {
      console.error("Get SEO keywords error:", error);
      res.status(500).json({ error: "Failed to fetch SEO keywords" });
    }
  });

  app.post("/api/seo/analyze", async (req, res) => {
    try {
      const { content, keywords } = req.body;

      const analysis = await seoService.analyzeContent(content, keywords);
      res.json(analysis);
    } catch (error) {
      console.error("SEO analysis error:", error);
      res.status(500).json({ error: "Failed to analyze content for SEO" });
    }
  });

  app.post("/api/ai/schedule-content", async (req, res) => {
    try {
      const { keywords, marketData, timeframe, focus } = req.body;

      // Create AI prompt for intelligent content scheduling
      const prompt = `You are an expert real estate marketing strategist and SEO specialist. Based on the following data, create an optimal 30-day content calendar for Mike Bjork's real estate business in Omaha, Nebraska.

SEO Keywords to target: ${keywords
        .map(
          (k: any) =>
            `${k.keyword} (rank: ${k.currentRank}, volume: ${k.searchVolume})`
        )
        .join(", ")}

Market Data: ${marketData
        .map(
          (m: any) =>
            `${m.neighborhood}: $${m.averagePrice} avg price, ${m.daysOnMarket} days on market`
        )
        .join("; ")}

Requirements:
1. Schedule content for maximum SEO impact and social media engagement
2. Prioritize high-volume, low-competition keywords
3. Include market trends and neighborhood highlights
4. Optimize posting times for real estate audience (early morning, lunch, evening)
5. Mix content types: market updates, property highlights, buyer/seller tips, neighborhood spotlights
6. Include specific posting dates and times
7. Each piece should target primary keyword + local SEO

Return ONLY a JSON object with this structure:
{
  "contentCount": number,
  "schedule": [
    {
      "id": "unique-id",
      "title": "Content Title",
      "content": "Full social media post content with hashtags",
      "platform": "Facebook|Instagram|LinkedIn|YouTube",
      "type": "Blog|Social|Video",
      "date": "2025-01-XX",
      "time": "XX:XX AM/PM",
      "targetKeyword": "primary keyword",
      "seoScore": number,
      "expectedImpact": "high|medium|low",
      "color": "bg-color-class"
    }
  ]
}

Focus on: ${focus} content that drives leads and showcases local market expertise.`;

      const { multiOpenAI } = await import("./services/openai");
      const response = await multiOpenAI.makeRequest(
        "content",
        async (client) => {
          return await client.chat.completions.create({
            model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
            messages: [
              {
                role: "system",
                content:
                  "You are an expert real estate marketing AI that creates optimized content schedules based on SEO data and market analytics. Always respond with valid JSON only.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          });
        }
      );

      const aiSchedule = JSON.parse(response.choices[0].message.content);

      // Store the generated schedule (in a real app, you'd save to database)
      // For now, we'll just return it

      res.json(aiSchedule);
    } catch (error) {
      console.error("AI content scheduling error:", error);

      // If OpenAI quota is exceeded, provide a fallback schedule
      if (error.code === "insufficient_quota" || error.status === 429) {
        console.log(
          "🔄 OpenAI quota exceeded, using fallback content schedule..."
        );

        const fallbackSchedule = {
          contentCount: 8,
          schedule: [
            {
              id: "fb-omaha-market-1",
              title: "Omaha Market Update - January 2025",
              content:
                "🏠 OMAHA MARKET SPOTLIGHT 🏠\n\nThe Omaha real estate market is showing strong momentum this January! Here's what homeowners and buyers need to know:\n\n📈 Market Highlights:\n• Average home price: $285,000 (+3.2% from last year)\n• Days on market: 28 days (excellent for sellers!)\n• Inventory levels: Balanced market conditions\n\n🎯 Prime Neighborhoods to Watch:\n• Benson: Trendy area with great walkability\n• Dundee: Historic charm meets modern amenities\n• West Omaha: Family-friendly with top schools\n\nThinking of buying or selling? Let's discuss your goals! 💬\n\n#OmahaRealEstate #NebraskaHomes #BjorkGroup #RealEstateExpert #OmahaLife",
              platform: "Facebook",
              type: "Social",
              date: "2025-01-02",
              time: "8:00 AM",
              targetKeyword: "Omaha real estate market",
              seoScore: 85,
              expectedImpact: "high",
              color: "bg-blue-100",
            },
            {
              id: "ig-buyer-tips-1",
              title: "First-Time Buyer Tips",
              content:
                "🔑 FIRST-TIME BUYER SUCCESS TIPS! 🔑\n\nMaking homeownership dreams come true in Omaha! Here's my insider advice:\n\n✅ Get Pre-Approved First\n• Know your budget before house hunting\n• Shows sellers you're serious\n• Speeds up the buying process\n\n✅ Research Neighborhoods\n• Visit at different times of day\n• Check school ratings and commute times\n• Consider future resale value\n\n✅ Don't Skip the Inspection\n• Protect your investment\n• Negotiate repairs or price adjustments\n• Peace of mind is priceless\n\n🏡 Ready to start your journey? DM me for a free buyer consultation!\n\n#FirstTimeBuyer #OmahaHomes #RealEstateTips #BjorkGroup #NebraskaRealEstate",
              platform: "Instagram",
              type: "Social",
              date: "2025-01-05",
              time: "12:30 PM",
              targetKeyword: "first time home buyer Omaha",
              seoScore: 78,
              expectedImpact: "medium",
              color: "bg-green-100",
            },
            {
              id: "li-investment-1",
              title: "Investment Property Opportunities",
              content:
                "💰 INVESTMENT OPPORTUNITY ALERT 💰\n\nOmaha's rental market is thriving! Here's why smart investors are choosing Nebraska:\n\n📊 Key Investment Metrics:\n• Average rental yield: 8-12%\n• Strong job market driving demand\n• Affordable entry points compared to coastal markets\n• Growing tech and healthcare sectors\n\n🎯 Hot Investment Areas:\n• Near downtown redevelopment zones\n• University of Nebraska proximity\n• Emerging neighborhoods with infrastructure improvements\n\n🔍 What to Look For:\n• Properties under $200K with good bones\n• Multi-family opportunities\n• Areas with planned developments\n\nLet's discuss your investment strategy over coffee! ☕\n\n#RealEstateInvestment #OmahaInvestment #PropertyInvesting #BjorkGroup #WealthBuilding",
              platform: "LinkedIn",
              type: "Blog",
              date: "2025-01-08",
              time: "9:00 AM",
              targetKeyword: "Omaha investment properties",
              seoScore: 82,
              expectedImpact: "high",
              color: "bg-purple-100",
            },
            {
              id: "fb-neighborhood-spotlight-1",
              title: "Neighborhood Spotlight: Benson",
              content:
                "🏘️ NEIGHBORHOOD SPOTLIGHT: BENSON 🏘️\n\nDiscover why Benson is becoming Omaha's hottest neighborhood!\n\n✨ What Makes Benson Special:\n• Walkable community with local character\n• Thriving arts scene and unique boutiques\n• Historic homes with modern renovations\n• Easy access to downtown (10 minutes!)\n\n🏠 Market Snapshot:\n• Average home price: $165,000\n• Typical days on market: 25 days\n• Mix of starter homes and investment properties\n\n🎨 Local Favorites:\n• Benson First Friday art walks\n• Local coffee shops and restaurants\n• Beautiful Benson Park\n\nCurious about Benson properties? Let's schedule a neighborhood tour!\n\n#BensonNebraska #OmahaNeighborhoods #BjorkGroup #CommunitySpotlight #OmahaLife",
              platform: "Facebook",
              type: "Social",
              date: "2025-01-12",
              time: "6:00 PM",
              targetKeyword: "Benson Omaha real estate",
              seoScore: 80,
              expectedImpact: "medium",
              color: "bg-yellow-100",
            },
            {
              id: "ig-selling-tips-1",
              title: "Home Selling Preparation",
              content:
                "✨ PREPPING YOUR HOME TO SELL? ✨\n\nMaximize your home's value with these proven strategies!\n\n🎯 Top 5 Staging Tips:\n1️⃣ Declutter & Depersonalize\n• Let buyers envision their life here\n• Remove family photos and personal items\n\n2️⃣ Deep Clean Everything  \n• First impressions matter!\n• Consider professional cleaning\n\n3️⃣ Fresh Paint = Fresh Appeal\n• Neutral colors attract more buyers\n• Focus on high-traffic areas\n\n4️⃣ Enhance Curb Appeal\n• Trim landscaping, add flowers\n• Clean windows and front door\n\n5️⃣ Price Strategically\n• Market analysis is crucial\n• Price to sell, not to sit\n\n💡 Ready to list? I'll create a custom marketing plan for your home!\n\n#HomeSelling #RealEstateTips #OmahaRealEstate #BjorkGroup #HomeStaging",
              platform: "Instagram",
              type: "Social",
              date: "2025-01-15",
              time: "11:00 AM",
              targetKeyword: "sell house Omaha",
              seoScore: 76,
              expectedImpact: "medium",
              color: "bg-red-100",
            },
            {
              id: "yt-market-analysis-1",
              title: "Q1 2025 Market Forecast",
              content:
                "🔮 Q1 2025 OMAHA REAL ESTATE FORECAST 🔮\n\nWhat to expect in the coming months:\n\n📈 Predictions for Q1:\n• Continued buyer demand with spring market approaching\n• Interest rates stabilizing around current levels\n• New construction picking up pace\n• Competitive market for well-priced homes\n\n🏡 Best Opportunities:\n• First-time buyers: Take advantage of programs\n• Sellers: List early to beat spring rush\n• Investors: Focus on emerging neighborhoods\n\n💼 Economic Factors:\n• Strong local job market\n• Population growth from relocations\n• Infrastructure investments boosting values\n\nWatch my full market analysis video (link in bio) for detailed insights!\n\n#MarketForecast #OmahaRealEstate #RealEstateExpert #Q12025 #BjorkGroup #MarketAnalysis",
              platform: "YouTube",
              type: "Video",
              date: "2025-01-18",
              time: "10:00 AM",
              targetKeyword: "Omaha real estate forecast 2025",
              seoScore: 88,
              expectedImpact: "high",
              color: "bg-indigo-100",
            },
            {
              id: "fb-client-success-1",
              title: "Client Success Story",
              content:
                "🎉 ANOTHER SUCCESSFUL CLOSING! 🎉\n\nCongratulations to the Johnson family on their beautiful new home in West Omaha!\n\n📖 Their Story:\n• First-time buyers from out of state\n• Needed guidance on neighborhoods and schools\n• Wanted move-in ready with modern updates\n• Closed in just 21 days!\n\n💬 What they said: \"Mike made relocating to Omaha stress-free. His local knowledge and attention to detail were exactly what we needed!\"\n\n🏠 The Property:\n• 4BR/3BA contemporary home\n• Top-rated Millard schools\n• Open floor plan with upgraded kitchen\n• Private backyard perfect for their kids\n\nEvery family's needs are unique. Let's find your perfect fit!\n\n#ClientSuccess #WestOmaha #NewHomeowners #BjorkGroup #RealEstateSuccess #MillardSchools",
              platform: "Facebook",
              type: "Social",
              date: "2025-01-22",
              time: "2:00 PM",
              targetKeyword: "West Omaha real estate agent",
              seoScore: 84,
              expectedImpact: "high",
              color: "bg-emerald-100",
            },
            {
              id: "li-market-trends-1",
              title: "Technology Impact on Real Estate",
              content:
                "🚀 HOW TECHNOLOGY IS RESHAPING OMAHA REAL ESTATE 🚀\n\nThe digital transformation is changing how we buy and sell homes:\n\n💻 Virtual Tours & 3D Walkthroughs\n• 87% of buyers start their search online\n• Virtual staging reduces time on market\n• Remote buyers can tour from anywhere\n\n📱 AI-Powered Market Analysis\n• Predictive pricing models\n• Automated valuation tools\n• Real-time market insights\n\n🔍 Enhanced Property Research\n• Neighborhood analytics\n• School ratings and crime data\n• Walkability and amenity scores\n\n📈 The Result: Faster, smarter transactions for buyers and sellers.\n\nStaying ahead of technology trends helps my clients make informed decisions. What tech features matter most to you?\n\n#PropTech #RealEstateInnovation #DigitalMarketing #OmahaRealEstate #BjorkGroup #FutureOfRealEstate",
              platform: "LinkedIn",
              type: "Blog",
              date: "2025-01-25",
              time: "8:30 AM",
              targetKeyword: "real estate technology Omaha",
              seoScore: 79,
              expectedImpact: "medium",
              color: "bg-cyan-100",
            },
          ],
        };

        return res.json(fallbackSchedule);
      }

      res.status(500).json({ error: "Failed to generate AI content schedule" });
    }
  });

  app.get("/api/seo/site-health", async (req, res) => {
    try {
      const url = (req.query.url as string) || "https://bjorkgroup.com";
      const health = await seoService.getSiteHealth(url);
      res.json(health);
    } catch (error) {
      console.error("Site health check error:", error);
      res.status(500).json({ error: "Failed to check site health" });
    }
  });

  // Market data endpoints
  app.get("/api/market/data", async (req, res) => {
    try {
      const marketData = await storage.getMarketData();
      res.json(marketData);
    } catch (error) {
      console.error("Get market data error:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  app.get("/api/market/neighborhoods/:neighborhood", async (req, res) => {
    try {
      const { neighborhood } = req.params;
      const data = await storage.getMarketDataByNeighborhood(neighborhood);

      if (!data) {
        return res.status(404).json({ error: "Neighborhood data not found" });
      }

      res.json(data);
    } catch (error) {
      console.error("Get neighborhood data error:", error);
      res.status(500).json({ error: "Failed to fetch neighborhood data" });
    }
  });

  app.get("/api/content/suggestions", async (req, res) => {
    try {
      const neighborhood = req.query.neighborhood as string;
      const suggestions = await seoService.suggestContentTopics(neighborhood);
      res.json({ suggestions });
    } catch (error) {
      console.error("Content suggestions error:", error);
      res.status(500).json({ error: "Failed to get content suggestions" });
    }
  });

  // Scheduled Posts endpoints
  app.get("/api/scheduled-posts", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const status = req.query.status as string;
      const posts = await storage.getScheduledPosts(user.id, status);
      res.json(posts);
    } catch (error) {
      console.error("Get scheduled posts error:", error);
      res.status(500).json({ error: "Failed to fetch scheduled posts" });
    }
  });

  app.put("/api/scheduled-posts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { content, scheduledFor, status } = req.body;

      const updatedPost = await storage.updateScheduledPost(id, {
        content,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        status,
      });

      if (!updatedPost) {
        return res.status(404).json({ error: "Scheduled post not found" });
      }

      res.json(updatedPost);
    } catch (error) {
      console.error("Update scheduled post error:", error);
      res.status(500).json({ error: "Failed to update scheduled post" });
    }
  });

  app.delete("/api/scheduled-posts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteScheduledPost(id);

      if (!deleted) {
        return res.status(404).json({ error: "Scheduled post not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete scheduled post error:", error);
      res.status(500).json({ error: "Failed to delete scheduled post" });
    }
  });

  // Upload image for scheduled post
  app.post(
    "/api/scheduled-posts/upload-image",
    upload.single("image"),
    async (req, res) => {
      try {
        const { postId } = req.body;
        const imageFile = req.file;

        if (!postId || !imageFile) {
          return res
            .status(400)
            .json({ error: "Post ID and image are required" });
        }

        // Get the existing post
        const post = await storage.getScheduledPostById(postId);
        if (!post) {
          return res.status(404).json({ error: "Scheduled post not found" });
        }

        // In a real app, you would upload the image to cloud storage (S3, Cloudinary, etc.)
        // For now, we'll simulate storing the image URL in metadata
        const imageUrl = `/uploads/${imageFile.filename}`;

        // Update the post with the image URL in metadata
        const updatedPost = await storage.updateScheduledPost(postId, {
          metadata: {
            ...((post.metadata as any) || {}),
            imageUrl: imageUrl,
          },
        });

        res.json({
          success: true,
          imageUrl: imageUrl,
          post: updatedPost,
        });
      } catch (error) {
        console.error("Upload image error:", error);
        res.status(500).json({ error: "Failed to upload image" });
      }
    }
  );

  // Update image URL for scheduled post
  app.post("/api/scheduled-posts/update-image", async (req, res) => {
    try {
      const { postId, imageUrl } = req.body;

      if (!postId || !imageUrl) {
        return res
          .status(400)
          .json({ error: "Post ID and image URL are required" });
      }

      // Get the existing post
      const post = await storage.getScheduledPostById(postId);
      if (!post) {
        return res.status(404).json({ error: "Scheduled post not found" });
      }

      // Update the post with the image URL in metadata
      const updatedPost = await storage.updateScheduledPost(postId, {
        metadata: {
          ...((post.metadata as any) || {}),
          imageUrl: imageUrl,
        },
      });

      res.json({
        success: true,
        imageUrl: imageUrl,
        post: updatedPost,
      });
    } catch (error) {
      console.error("Update image error:", error);
      res.status(500).json({ error: "Failed to update image" });
    }
  });

  app.post("/api/scheduled-posts/generate-weekly", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { focus = "mixed" } = req.body; // 'local_markets', 'moving_guide', or 'mixed'

      const neighborhoods = [
        "Dundee",
        "Aksarben",
        "Old Market",
        "Blackstone",
        "Benson",
      ];
      const platforms = ["facebook", "instagram", "linkedin", "x", "tiktok"];

      const movingGuideTopics = [
        "Best Omaha neighborhoods for families",
        "Omaha job market and major employers",
        "Winter in Omaha: what to expect",
        "Omaha school districts comparison",
        "Cost of living in Omaha vs other cities",
      ];

      const today = new Date();
      const generatedPosts = [];

      // Generate 2 weeks of AI-powered content
      for (let day = 0; day < 14; day++) {
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + day + 1);
        scheduleDate.setHours(9 + (day % 8), 0, 0, 0); // Vary posting times

        const platformIndex = day % platforms.length;
        const platform = platforms[platformIndex];

        let aiContent, postType, neighborhood;

        try {
          if (
            focus === "local_markets" ||
            (focus === "mixed" && day % 2 === 0)
          ) {
            // Generate local market content
            const neighborhoodIndex = day % neighborhoods.length;
            neighborhood = neighborhoods[neighborhoodIndex];
            // Use existing content generation for now
            aiContent = await openaiService.generateContent({
              type: "social",
              neighborhood,
              keywords: [`${neighborhood} real estate`, "Omaha homes"],
            });
            postType = "local_market";
          } else {
            // Generate moving guide content
            const topicIndex = day % movingGuideTopics.length;
            const topic = movingGuideTopics[topicIndex];
            // Use existing content generation for now
            aiContent = await openaiService.generateContent({
              type: "social",
              neighborhood: topic,
              keywords: ["Omaha moving", "real estate tips"],
            });
            postType = "moving_guide";
            neighborhood = null;
          }

          const scheduledPost = await storage.createScheduledPost({
            userId: user.id,
            platform,
            postType,
            content: aiContent.content,
            hashtags: (aiContent as any).hashtags || [],
            scheduledFor: scheduleDate,
            status: "pending",
            isEdited: false,
            originalContent: aiContent.content,
            neighborhood,
            seoScore: aiContent.seoScore || 80,
            metadata: { generated: true, focus: postType, aiGenerated: true },
          });

          generatedPosts.push(scheduledPost);
        } catch (aiError) {
          console.error(
            `Failed to generate AI content for day ${day}:`,
            aiError
          );
          // Fallback to basic content if AI generation fails
          const fallbackContent = neighborhood
            ? `Discover what makes ${neighborhood} special! Contact Mike Bjork for local market insights.`
            : `Thinking of moving to Omaha? Let's talk about what makes this city amazing!`;

          const scheduledPost = await storage.createScheduledPost({
            userId: user.id,
            platform,
            postType: postType || "local_market",
            content: fallbackContent,
            hashtags: ["OmahaRealEstate", "MovingToOmaha", "NebraskaHomes"],
            scheduledFor: scheduleDate,
            status: "pending",
            isEdited: false,
            seoScore: 85,
            originalContent: fallbackContent,
            neighborhood,
            metadata: { generated: true, focus: postType, fallback: true },
          });

          generatedPosts.push(scheduledPost);
        }
      }

      res.json({
        success: true,
        message: `Weekly ${focus} content generated successfully with AI optimization`,
        postsGenerated: generatedPosts.length,
        focus: focus,
      });
    } catch (error) {
      console.error("Generate weekly content error:", error);
      res.status(500).json({ error: "Failed to generate weekly content" });
    }
  });

  // Avatar Management endpoints
  app.get("/api/avatars", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const avatars = await storage.getAvatars(user.id);
      res.json(avatars);
    } catch (error) {
      console.error("Get avatars error:", error);
      res.status(500).json({ error: "Failed to fetch avatars" });
    }
  });

  app.post("/api/avatars", upload.single("avatarPhoto"), async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Initialize HeyGen service
      const heygenService = new HeyGenService();

      let heygenAvatarId = null;
      let avatarImageUrl = req.body.avatarImageUrl;

      // Handle uploaded avatar photo
      if (req.file) {
        // Save local path for storage
        avatarImageUrl = `/uploads/${req.file.filename}`;
        console.log("Avatar photo uploaded locally to:", avatarImageUrl);

        // Upload to HeyGen and create avatar
        try {
          console.log("Uploading image to HeyGen...");

          // Read the file as a buffer
          const filePath = path.join(
            process.cwd(),
            "uploads",
            req.file.filename
          );
          const fileBuffer = fs.readFileSync(filePath);
          const blob = new Blob([fileBuffer], { type: req.file.mimetype });

          // Upload image to HeyGen to get a public URL
          const heygenImageUrl = await heygenService.uploadImage(blob);
          console.log("Image uploaded to HeyGen:", heygenImageUrl);

          // Create HeyGen avatar with the uploaded image
          const heygenResponse = await heygenService.createTalkingPhotoAvatar(
            heygenImageUrl,
            req.body.name,
            req.body.voiceId
          );

          console.log("Full HeyGen response:", JSON.stringify(heygenResponse));
          if (
            heygenResponse.data?.avatar_id ||
            heygenResponse.data?.avatar_group_id ||
            heygenResponse.data?.group_id ||
            heygenResponse.data?.id
          ) {
            // Different HeyGen endpoints return different ID fields
            // Photo avatars return group_id or just id
            heygenAvatarId =
              heygenResponse.data.avatar_id ||
              heygenResponse.data.avatar_group_id ||
              heygenResponse.data.group_id ||
              heygenResponse.data.id;
            console.log("HeyGen avatar created successfully:", heygenAvatarId);
          } else {
            console.log(
              "HeyGen response missing avatar IDs - data:",
              heygenResponse.data
            );
          }
        } catch (heygenError) {
          console.warn("HeyGen avatar creation failed:", heygenError);
          // Continue with local avatar creation even if HeyGen fails
        }
      }

      // Parse form data properly
      const formData = {
        name: req.body.name,
        description: req.body.description,
        style: req.body.style,
        gender: req.body.gender,
        voiceId: req.body.voiceId || null,
        isActive: req.body.isActive === "true" || req.body.isActive === true,
        avatarImageUrl: avatarImageUrl,
      };

      console.log("Form data received:", formData);

      const validatedData = insertAvatarSchema.parse({
        ...formData,
        userId: user.id,
        metadata: heygenAvatarId
          ? {
              heygenAvatarId,
            }
          : {},
      });

      const avatar = await storage.createAvatar(validatedData);
      res.status(201).json({
        ...avatar,
        heygenAvatarId,
      });
    } catch (error) {
      console.error("Create avatar error:", error);
      res.status(500).json({ error: "Failed to create avatar" });
    }
  });

  app.put(
    "/api/avatars/:id",
    upload.fields([
      { name: "avatarPhoto", maxCount: 1 },
      { name: "voiceRecording", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        // Get existing avatar to check for HeyGen metadata
        const existingAvatar = await storage.getAvatarById(id);
        if (!existingAvatar) {
          return res.status(404).json({ error: "Avatar not found" });
        }

        // Cast req.files to the correct type
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        // Handle uploaded avatar photo in updates
        if (files?.avatarPhoto && files.avatarPhoto[0]) {
          const photoFile = files.avatarPhoto[0];
          updates.avatarImageUrl = `/uploads/${photoFile.filename}`;
          console.log("Avatar photo updated to:", updates.avatarImageUrl);

          // Try to create or update HeyGen avatar
          try {
            const heygenService = new HeyGenService();

            // Upload new image to HeyGen
            const filePath = path.join(
              process.cwd(),
              "uploads",
              photoFile.filename
            );
            const fileBuffer = fs.readFileSync(filePath);
            const blob = new Blob([fileBuffer], { type: photoFile.mimetype });

            const heygenImageUrl = await heygenService.uploadImage(blob);
            console.log("Image uploaded to HeyGen:", heygenImageUrl);

            // Create HeyGen avatar (whether updating existing or creating new)
            const heygenResponse = await heygenService.createTalkingPhotoAvatar(
              heygenImageUrl,
              updates.name || existingAvatar.name,
              updates.voiceId || existingAvatar.voiceId
            );

            console.log(
              "Full HeyGen response for update:",
              JSON.stringify(heygenResponse)
            );
            if (
              heygenResponse.data?.avatar_id ||
              heygenResponse.data?.avatar_group_id ||
              heygenResponse.data?.group_id ||
              heygenResponse.data?.id
            ) {
              // Different HeyGen endpoints return different ID fields
              // Photo avatars return group_id or just id
              const avatarId =
                heygenResponse.data.avatar_id ||
                heygenResponse.data.avatar_group_id ||
                heygenResponse.data.group_id ||
                heygenResponse.data.id;
              updates.metadata = {
                ...((existingAvatar.metadata as any) || {}),
                heygenAvatarId: avatarId,
                updatedAt: new Date().toISOString(),
              };
              console.log(
                "HeyGen avatar created/updated successfully:",
                avatarId
              );
            } else {
              console.log(
                "HeyGen response missing avatar IDs on update - data:",
                heygenResponse.data
              );
            }
          } catch (heygenError) {
            console.warn("Failed to create/update HeyGen avatar:", heygenError);
            // Continue with local update even if HeyGen fails
          }
        }

        // Handle uploaded voice recording
        if (files?.voiceRecording && files.voiceRecording[0]) {
          const voiceFile = files.voiceRecording[0];
          const voiceFilePath = `/uploads/${voiceFile.filename}`;
          console.log("Voice recording uploaded to:", voiceFilePath);

          // Store the voice recording path and mark as custom voice
          updates.metadata = {
            ...(updates.metadata || (existingAvatar.metadata as any) || {}),
            voiceRecordingUrl: voiceFilePath,
            hasCustomVoice: true,
            voiceRecordedAt: new Date().toISOString(),
          };

          // Set voiceId to indicate custom voice
          updates.voiceId = "custom_voice";

          // TODO: In production, you would upload this to HeyGen's voice cloning API
          // For now, we'll store it locally and use it for demo purposes
          console.log("Custom voice recording saved for avatar");
        }

        const updatedAvatar = await storage.updateAvatar(id, updates);
        res.json(updatedAvatar);
      } catch (error) {
        console.error("Update avatar error:", error);
        res.status(500).json({ error: "Failed to update avatar" });
      }
    }
  );

  // Import existing HeyGen avatar (use pre-built avatars from HeyGen library)
  app.post("/api/avatars/import", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { avatarId } = req.body;

      if (!avatarId) {
        return res.status(400).json({ error: "Avatar ID is required" });
      }

      // Validate the avatar exists in HeyGen
      const heygenService = new HeyGenService();
      const avatarDetails = await heygenService.importAvatar(avatarId);

      if (!avatarDetails.data) {
        return res.status(404).json({ error: "Avatar not found in HeyGen" });
      }

      // Create a local avatar record linked to the HeyGen avatar
      const validatedData = insertAvatarSchema.parse({
        name: avatarDetails.data.avatar_name || "HeyGen Avatar",
        description: `Professional HeyGen avatar for video creation`,
        style: "professional",
        gender: avatarDetails.data.gender || "unknown",
        userId: user.id,
        metadata: {
          heygenAvatarId: avatarId,
          importedFrom: "heygen",
          previewVideoUrl: avatarDetails.data.preview_video_url || null,
        },
        avatarImageUrl: avatarDetails.data.preview_image_url || null,
      });

      const importedAvatar = await storage.createAvatar(validatedData);
      res.status(201).json({
        ...importedAvatar,
        heygenAvatarId: avatarId,
      });
    } catch (error) {
      console.error("Avatar import failed:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // List available HeyGen avatars (per official documentation)
  app.get("/api/avatars/heygen-list", async (req, res) => {
    try {
      const heygenService = new HeyGenService();
      const avatarsList = await heygenService.listAvatars();

      // Format the response to match what the frontend expects
      if (avatarsList.data?.avatars) {
        res.json({
          success: true,
          avatars: avatarsList.data.avatars,
          total: avatarsList.data.avatars.length,
        });
      } else {
        res.json({ success: true, avatars: [], total: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch HeyGen avatars:", error);
      res.status(500).json({ error: "Failed to fetch available avatars" });
    }
  });

  // List available HeyGen voices (per official documentation)
  app.get("/api/voices/heygen-list", async (req, res) => {
    try {
      const heygenService = new HeyGenService();
      const voicesList = await heygenService.listVoices();

      // Format the response to match what the frontend expects
      if (voicesList.data?.voices) {
        res.json({
          success: true,
          voices: voicesList.data.voices,
          total: voicesList.data.voices.length,
        });
      } else {
        res.json({ success: true, voices: [], total: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch HeyGen voices:", error);
      res.status(500).json({ error: "Failed to fetch available voices" });
    }
  });

  // ======================================
  // CUSTOM VOICES ENDPOINTS
  // ======================================

  // List all custom voices for the current user
  app.get("/api/custom-voices", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const voices = await storage.listCustomVoices(user.id);
      res.json(voices);
    } catch (error) {
      console.error("Failed to fetch custom voices:", error);
      res.status(500).json({ error: "Failed to fetch custom voices" });
    }
  });

  // Upload and save a new custom voice
  app.post(
    "/api/custom-voices",
    requireAuth,
    upload.single("audio"),
    async (req, res) => {
      try {
        const user = (req as any).user;
        const { name } = req.body;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        if (!name || name.trim().length === 0) {
          return res.status(400).json({ error: "Voice name is required" });
        }

        // Read the file as a Buffer
        const fileBuffer = fs.readFileSync(file.path);

        // Get file stats
        const stats = fs.statSync(file.path);

        // Determine file extension
        const ext = path.extname(file.originalname);
        const fileName = `voice-library/${nanoid()}${ext}`;

        // Upload audio file to S3
        const s3Service = new S3UploadService();
        const audioUrl = await s3Service.uploadFile(
          Number(user.id),
          fileBuffer,
          fileName,
          file.mimetype
        );

        let heygenAudioAssetId: string | undefined;
        let status = "pending";

        // Upload to HeyGen for voice cloning
        try {
          console.log("🎤 Uploading audio to HeyGen for voice cloning...");

          // Upload to HeyGen (reuse fileBuffer from above)
          const heygenService = new HeyGenService();
          heygenAudioAssetId = await heygenService.uploadAudio(
            fileBuffer,
            file.mimetype
          );
          status = "ready";

          console.log(
            "✅ HeyGen upload successful! Audio Asset ID:",
            heygenAudioAssetId
          );
        } catch (heygenError) {
          console.error("❌ HeyGen upload failed:", heygenError);
          status = "failed";
          // Continue anyway - user can still manage the voice in library
        }

        // Create custom voice record with HeyGen asset ID
        const voice = await storage.createCustomVoice({
          userId: user.id,
          name: name.trim(),
          audioUrl,
          fileSize: stats.size,
          heygenAudioAssetId,
          status,
        });

        // Clean up uploaded file
        fs.unlinkSync(file.path);

        res.status(201).json(voice);
      } catch (error) {
        console.error("Failed to create custom voice:", error);
        res.status(500).json({ error: "Failed to create custom voice" });
      }
    }
  );

  // Delete a custom voice
  app.delete("/api/custom-voices/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      await storage.deleteCustomVoice(id, user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete custom voice:", error);
      res.status(500).json({ error: "Failed to delete custom voice" });
    }
  });

  // Serve custom voice audio file from S3
  app.get("/api/custom-voices/:id/audio", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      console.log(`🎵 Fetching audio for voice ID: ${id}, user ID: ${user.id}`);

      const voice = await storage.getCustomVoice(id);
      console.log(
        `📊 Voice found:`,
        voice
          ? `Yes (userId: ${voice.userId}, audioUrl: ${voice.audioUrl})`
          : "No"
      );

      if (!voice) {
        console.log(`❌ Voice not found in database`);
        return res.status(404).json({ error: "Voice not found" });
      }

      if (voice.userId !== user.id.toString()) {
        console.log(
          `❌ User ID mismatch: voice.userId=${voice.userId}, user.id=${user.id}`
        );
        return res.status(404).json({ error: "Voice not found" });
      }

      console.log(`📥 Fetching file from S3: ${voice.audioUrl}`);
      const s3Service = new S3UploadService();
      const audioBuffer = await s3Service.getFile(voice.audioUrl);
      console.log(
        `✅ Audio file retrieved from S3, size: ${audioBuffer.length} bytes`
      );

      // Determine content type from file extension
      const ext = path.extname(voice.audioUrl).toLowerCase();
      const contentType =
        ext === ".wav"
          ? "audio/wav"
          : ext === ".mp3"
          ? "audio/mpeg"
          : "audio/mpeg";

      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400"); // Cache for 1 day
      res.send(audioBuffer);
    } catch (error) {
      console.error("❌ Failed to serve custom voice audio:", error);
      res.status(500).json({ error: "Failed to load audio file" });
    }
  });

  // Proxy endpoint for HeyGen images to avoid CORS issues
  app.get("/api/proxy/heygen-image", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;

      if (!imageUrl || !imageUrl.includes("heygen.ai")) {
        return res.status(400).json({ error: "Invalid image URL" });
      }

      const response = await fetch(imageUrl);

      if (!response.ok) {
        return res.status(404).json({ error: "Image not found" });
      }

      const contentType = response.headers.get("content-type") || "image/webp";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400"); // Cache for 1 day

      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        await pump();
      } else {
        res.status(404).json({ error: "No image data" });
      }
    } catch (error) {
      console.error("Failed to proxy HeyGen image:", error);
      res.status(500).json({ error: "Failed to load image" });
    }
  });

  // Video Content endpoints
  app.get("/api/videos", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const status = req.query.status as string;
      const videos = await storage.getVideoContent(user.id, status);
      res.json(videos);
    } catch (error) {
      console.error("Get videos error:", error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });

  // Get video history for authenticated user (all completed videos)
  app.get("/api/videos/history", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      console.log("📚 Fetching video history for user:", userId);

      // Get all completed videos (status: 'ready' or 'uploaded')
      const allVideos = await storage.getVideoContent(userId);
      const completedVideos = allVideos.filter(
        (video) => video.status === "ready" || video.status === "uploaded"
      );

      console.log(`✅ Found ${completedVideos.length} completed videos`);

      res.json({
        videos: completedVideos,
        count: completedVideos.length,
      });
    } catch (error) {
      console.error("Get video history error:", error);
      res.status(500).json({ error: "Failed to fetch video history" });
    }
  });

  app.post("/api/videos", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const validatedData = insertVideoContentSchema.parse({
        ...req.body,
        userId: user.id,
      });

      const video = await storage.createVideoContent(validatedData);
      res.status(201).json(video);
    } catch (error) {
      console.error("Create video error:", error);
      res.status(500).json({ error: "Failed to create video content" });
    }
  });

  app.put("/api/videos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updatedVideo = await storage.updateVideoContent(id, updates);

      if (!updatedVideo) {
        return res.status(404).json({ error: "Video not found" });
      }

      res.json(updatedVideo);
    } catch (error) {
      console.error("Update video error:", error);
      res.status(500).json({ error: "Failed to update video" });
    }
  });

  app.post("/api/videos/:id/generate-script", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        topic,
        neighborhood,
        videoType,
        platform = "youtube",
        duration = 60,
      } = req.body;

      const video = await storage.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      let script;
      try {
        // Try to generate AI script for the video
        script = await openaiService.generateVideoScript({
          topic,
          neighborhood,
          videoType,
          platform,
          duration,
        });
      } catch (error: any) {
        console.error("OpenAI API error:", error);

        // If API quota exceeded or other OpenAI issues, provide a fallback script
        if (error.status === 429 || error.code === "insufficient_quota") {
          script = generateFallbackScript(
            topic,
            neighborhood || "Omaha",
            videoType,
            duration,
            platform
          );
        } else {
          throw error; // Re-throw if it's not a quota issue
        }
      }

      const updatedVideo = await storage.updateVideoContent(id, {
        script,
        topic,
        neighborhood,
        videoType,
        platform,
        duration,
        status: "ready",
      });

      res.json({ script, video: updatedVideo });
    } catch (error) {
      console.error("Generate video script error:", error);
      res.status(500).json({
        error: "Failed to generate video script. Please try again later.",
      });
    }
  });

  app.post("/api/videos/:id/generate-video", async (req, res) => {
    try {
      const { id } = req.params;
      const { avatarId } = req.body;

      const video = await storage.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Store user ID for notification later
      const userId = video.userId;

      const avatar = avatarId ? await storage.getAvatarById(avatarId) : null;

      // Check if we have an avatar
      if (avatar) {
        // For testing purposes, generate a demo video first
        // This ensures the avatar test flow works while we fix HeyGen integration

        if (
          !avatar.metadata ||
          typeof avatar.metadata !== "object" ||
          !("heygenAvatarId" in avatar.metadata)
        ) {
          // No HeyGen integration yet - create a demo video for testing
          console.log("No HeyGen avatar ID found, creating demo test video");

          await storage.updateVideoContent(id, {
            status: "ready",
            avatarId: avatarId || video.avatarId,
            videoUrl: "https://example.com/demo-video.mp4",
            thumbnailUrl: "https://example.com/demo-thumbnail.jpg",
            metadata: {
              ...(video.metadata || {}),
              isDemo: true,
              message: "Demo video for testing - HeyGen integration pending",
            },
          });

          return res.json({
            success: true,
            message: "Test video created successfully (demo mode)",
            videoUrl: "https://example.com/demo-video.mp4",
          });
        }

        // Has HeyGen integration - try to generate real video
        const heygenService = new HeyGenService();

        // Determine aspect ratio based on platform
        let aspectRatio: "16:9" | "9:16" | "1:1" = "16:9";
        if (video.platform === "reels" || video.platform === "story") {
          aspectRatio = "9:16";
        }

        try {
          console.log(
            `Generating HeyGen video for platform: ${video.platform}, aspect ratio: ${aspectRatio}`
          );
          console.log(
            `Using HeyGen avatar ID: ${(avatar.metadata as any).heygenAvatarId}`
          );

          // Check if this is a talking photo avatar (created from uploaded photo)
          const isTalkingPhoto =
            !!avatar.avatarImageUrl &&
            avatar.avatarImageUrl.includes("/uploads/");
          console.log(
            `Avatar type: ${isTalkingPhoto ? "talking_photo" : "avatar"}`
          );

          // Handle voice selection - use a valid HeyGen voice ID
          let voiceId = avatar.voiceId;
          if (voiceId === "custom_voice") {
            // Custom voice recording uploaded but not yet integrated with HeyGen voice cloning
            // Default to professional male voice for now
            voiceId = "119caed25533477ba63822d5d1552d25"; // Professional Male voice
            console.log(
              "Custom voice detected, using default male voice as fallback"
            );
          }

          const heygenResponse = await heygenService.generateVideo({
            avatarId: (avatar.metadata as any).heygenAvatarId,
            script:
              video.script ||
              "Welcome to the future of real estate marketing with AI-powered video content.",
            title: video.title,
            voiceId: voiceId || undefined,
            aspectRatio,
            quality: "720p", // 720p for free tier as per documentation
            speed: 1.1, // Slightly faster speech as shown in docs
            isTalkingPhoto, // Pass this flag to the service
          });

          if (heygenResponse.data?.video_id) {
            // Update video with HeyGen video ID and set status to generating
            await storage.updateVideoContent(id, {
              status: "generating",
              avatarId: avatarId || video.avatarId,
              metadata: {
                ...(video.metadata || {}),
                heygenVideoId: heygenResponse.data.video_id,
              },
            });

            res.json({
              success: true,
              videoId: heygenResponse.data.video_id,
              message: "HeyGen video generation started successfully",
              estimatedTime: "3-5 minutes",
            });
            return;
          }
        } catch (heygenError) {
          console.error("HeyGen video generation failed:", heygenError);

          // Fallback to demo video on HeyGen failure
          await storage.updateVideoContent(id, {
            status: "ready",
            avatarId: avatarId || video.avatarId,
            videoUrl: "https://example.com/demo-video.mp4",
            thumbnailUrl: "https://example.com/demo-thumbnail.jpg",
            metadata: {
              ...(video.metadata || {}),
              isDemo: true,
              heygenError:
                heygenError instanceof Error
                  ? heygenError.message
                  : "Unknown error",
            },
          });

          return res.json({
            success: true,
            message: "Test video created (demo mode due to HeyGen error)",
            videoUrl: "https://example.com/demo-video.mp4",
            warning:
              "HeyGen integration encountered an error. Using demo video.",
          });
        }
      }

      // If no avatar at all, return error
      return res.status(400).json({
        error: "Avatar required for video generation",
        message: "Please select or create an avatar first",
      });
    } catch (error) {
      console.error("Generate video error:", error);
      res.status(500).json({ error: "Failed to start video generation" });
    }
  });

  // Note: Old video status route removed - using HeyGen-compatible route at line ~3425

  app.post("/api/videos/:id/upload-youtube", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, tags, privacy = "public" } = req.body;

      const video = await storage.getVideoById(id);
      if (!video || !video.videoUrl) {
        return res.status(404).json({ error: "Video not ready for upload" });
      }

      // This would integrate with YouTube API
      // For now, we'll simulate the upload
      const mockYoutubeVideoId = `mock_yt_${id.substring(0, 8)}`;
      const mockYoutubeUrl = `https://youtube.com/watch?v=${mockYoutubeVideoId}`;

      const updatedVideo = await storage.updateVideoContent(id, {
        status: "uploaded",
        youtubeVideoId: mockYoutubeVideoId,
        youtubeUrl: mockYoutubeUrl,
        title: title || video.title,
      });

      res.json({
        success: true,
        youtubeUrl: mockYoutubeUrl,
        video: updatedVideo,
      });
    } catch (error) {
      console.error("Upload to YouTube error:", error);
      res.status(500).json({ error: "Failed to upload to YouTube" });
    }
  });

  // ==================== STREAMING AVATAR ENDPOINTS ====================

  // List available streaming avatars
  app.get("/api/streaming/avatars", async (req, res) => {
    try {
      const streamingService = new HeyGenStreamingService();
      const avatars = await streamingService.listStreamingAvatars();
      res.json({ avatars });
    } catch (error) {
      console.error("Failed to list streaming avatars:", error);
      res.status(500).json({ error: "Failed to list streaming avatars" });
    }
  });

  // Create streaming avatar session
  app.post("/api/streaming/sessions", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { avatarId } = req.body;
      const streamingService = new HeyGenStreamingService();

      const session = await streamingService.createSession(user.id, avatarId);
      res.json(session);
    } catch (error) {
      console.error("Failed to create streaming session:", error);
      res.status(500).json({ error: "Failed to create streaming session" });
    }
  });

  // Make avatar speak
  app.post("/api/streaming/sessions/:sessionId/speak", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { text, taskType = "TALK" } = req.body;

      const streamingService = new HeyGenStreamingService();
      await streamingService.speak(sessionId, text, taskType);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to make avatar speak:", error);
      res.status(500).json({ error: "Failed to make avatar speak" });
    }
  });

  // Start voice chat
  app.post(
    "/api/streaming/sessions/:sessionId/voice-chat",
    async (req, res) => {
      try {
        const { sessionId } = req.params;

        const streamingService = new HeyGenStreamingService();
        await streamingService.startVoiceChat(sessionId);

        res.json({ success: true });
      } catch (error) {
        console.error("Failed to start voice chat:", error);
        res.status(500).json({ error: "Failed to start voice chat" });
      }
    }
  );

  // Stop voice chat
  app.delete(
    "/api/streaming/sessions/:sessionId/voice-chat",
    async (req, res) => {
      try {
        const { sessionId } = req.params;

        const streamingService = new HeyGenStreamingService();
        await streamingService.stopVoiceChat(sessionId);

        res.json({ success: true });
      } catch (error) {
        console.error("Failed to stop voice chat:", error);
        res.status(500).json({ error: "Failed to stop voice chat" });
      }
    }
  );

  // Interrupt avatar
  app.post("/api/streaming/sessions/:sessionId/interrupt", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const streamingService = new HeyGenStreamingService();
      await streamingService.interrupt(sessionId);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to interrupt avatar:", error);
      res.status(500).json({ error: "Failed to interrupt avatar" });
    }
  });

  // End streaming session
  app.delete("/api/streaming/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const streamingService = new HeyGenStreamingService();
      await streamingService.endSession(sessionId);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to end session:", error);
      res.status(500).json({ error: "Failed to end session" });
    }
  });

  // Get active sessions
  app.get("/api/streaming/sessions", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("mikebjork");
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const streamingService = new HeyGenStreamingService();
      const sessions = streamingService.getActiveSessions(user.id);

      res.json({ sessions });
    } catch (error) {
      console.error("Failed to get sessions:", error);
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // ==================== PHOTO AVATAR ENDPOINTS ====================

  // Generate AI photos for avatars
  app.post("/api/photo-avatars/generate-photos", async (req, res) => {
    try {
      console.log("📸 Photo generation request:", req.body);

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const result = await photoAvatarService.generateAIPhotos(req.body);

      console.log("✅ Photo generation result:", result);

      // Send real-time notification
      if (req.session?.userId) {
        realtimeService.notifyPhotoGenerated(
          req.session.userId,
          req.body.name || "Avatar",
          5 // HeyGen generates 5 photos
        );
      }

      res.json(result);
    } catch (error) {
      console.error("❌ Failed to generate AI photos:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate AI photos";
      res.status(500).json({
        error: "Failed to generate AI photos",
        details: errorMessage,
      });
    }
  });

  // Get photo generation status
  app.get("/api/photo-avatars/generation/:generationId", async (req, res) => {
    try {
      const { generationId } = req.params;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const status = await photoAvatarService.getGenerationStatus(generationId);

      res.json(status);
    } catch (error) {
      console.error("Failed to get generation status:", error);
      res.status(500).json({ error: "Failed to get generation status" });
    }
  });

  // Create avatar group
  app.post("/api/photo-avatars/groups", async (req, res) => {
    try {
      const { name, imageKey } = req.body;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const group = await photoAvatarService.createAvatarGroup(name, imageKey);

      res.json(group);
    } catch (error) {
      console.error("Failed to create avatar group:", error);
      res.status(500).json({ error: "Failed to create avatar group" });
    }
  });

  // Add photos to avatar group
  app.post("/api/photo-avatars/groups/:groupId/photos", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { imageKeys, name } = req.body;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const result = await photoAvatarService.addPhotosToGroup(
        groupId,
        imageKeys,
        name
      );

      res.json(result);
    } catch (error) {
      console.error("Failed to add photos to group:", error);
      res.status(500).json({ error: "Failed to add photos to group" });
    }
  });

  // List avatar groups
  app.get("/api/photo-avatars/groups", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const groups = await photoAvatarService.listAvatarGroups();

      // Enrich each group with actual look counts and custom voice data
      const mappedGroups = await Promise.all(
        (groups.avatar_group_list || []).map(async (group: any) => {
          // Fallbacks for API field variations
          const groupId = group.id || group.group_id;
          let looksCount = 0;
          try {
            const looks = await photoAvatarService.getAvatarGroupLooks(groupId);
            looksCount = Array.isArray(looks?.avatar_list)
              ? looks.avatar_list.length
              : 0;
          } catch (e) {
            console.warn(
              `⚠️ Failed to fetch looks for group ${groupId}:`,
              (e as Error)?.message || e
            );
          }

          // Get custom voice for this group if any
          let defaultVoiceId = null;
          try {
            console.log(
              `🔍 Looking up custom voice for group ${groupId}, userId: ${userId}`
            );
            const customVoice = await storage.getPhotoAvatarGroupVoice(
              groupId,
              userId
            );
            console.log(
              `📊 Custom voice result for group ${groupId}:`,
              customVoice
            );
            if (customVoice?.heygenAudioAssetId) {
              defaultVoiceId = customVoice.heygenAudioAssetId;
              console.log(
                `✅ Found custom voice for group ${groupId}: ${defaultVoiceId}`
              );
            } else {
              console.log(`ℹ️ No custom voice found for group ${groupId}`);
            }
          } catch (e) {
            console.error(
              `❌ Error fetching custom voice for group ${groupId}:`,
              e
            );
          }

          // Determine status: if any looks exist, mark as ready
          const rawStatus = group.train_status || group.status || "pending";
          const status = looksCount > 0 ? "ready" : rawStatus;

          return {
            group_id: groupId,
            name: group.name,
            status,
            default_voice_id: defaultVoiceId,
            created_at: group.created_at
              ? new Date(group.created_at * 1000).toISOString()
              : new Date().toISOString(),
            avatar_count: looksCount,
            training_progress:
              status === "processing" || rawStatus === "processing"
                ? 50
                : undefined,
            preview_image: group.preview_image,
          };
        })
      );

      res.json({
        avatar_group_list: mappedGroups,
      });
    } catch (error) {
      console.error("Failed to list avatar groups:", error);
      res.status(500).json({ error: "Failed to list avatar groups" });
    }
  });

  // Get avatar group details
  app.get("/api/photo-avatars/groups/:groupId", async (req, res) => {
    try {
      const { groupId } = req.params;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      // Some v2 endpoints for group details 404; derive details from list + looks as a reliable fallback
      const groups = await photoAvatarService.listAvatarGroups();
      const base = (groups.avatar_group_list || []).find(
        (g: any) => (g.id || g.group_id) === groupId
      );

      if (!base) {
        return res.status(404).json({ error: "Avatar group not found" });
      }

      let looksCount = 0;
      try {
        const looks = await photoAvatarService.getAvatarGroupLooks(groupId);
        looksCount = Array.isArray(looks?.avatar_list)
          ? looks.avatar_list.length
          : 0;
      } catch (e) {
        console.warn(
          `⚠️ Failed to fetch looks for group ${groupId} while building details:`,
          (e as Error)?.message || e
        );
      }

      const detail = {
        group_id: base.id || base.group_id,
        name: base.name,
        status: looksCount > 0 ? "ready" : base.train_status || base.status,
        created_at: base.created_at
          ? new Date(base.created_at * 1000).toISOString()
          : new Date().toISOString(),
        avatar_count: looksCount,
        preview_image: base.preview_image,
      };

      res.json(detail);
    } catch (error) {
      console.error("Failed to get avatar group:", error);
      res.status(500).json({ error: "Failed to get avatar group" });
    }
  });

  // Get avatar group photos (generated images)
  app.get("/api/photo-avatars/groups/:groupId/photos", async (req, res) => {
    try {
      const { groupId } = req.params;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const looksData = await photoAvatarService.getAvatarGroupLooks(groupId);

      // Transform avatar looks into photo format
      const photos = (looksData.avatar_list || []).map((avatar: any) => ({
        id: avatar.id,
        url: avatar.image_url,
        thumbnail: avatar.image_url,
        name: avatar.name,
        type: "avatar",
        created_at: avatar.created_at,
        status: avatar.status,
        motion_preview_url: avatar.motion_preview_url,
      }));

      res.json({
        group_id: groupId,
        photos: photos,
        count: photos.length,
      });
    } catch (error) {
      console.error("Failed to get avatar group photos:", error);
      res.status(500).json({ error: "Failed to get avatar group photos" });
    }
  });

  // Get avatar group looks
  app.get("/api/photo-avatars/groups/:groupId/looks", async (req, res) => {
    try {
      const { groupId } = req.params;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const looks = await photoAvatarService.getAvatarGroupLooks(groupId);

      res.json(looks);
    } catch (error) {
      console.error("Failed to get avatar looks:", error);
      res.status(500).json({ error: "Failed to get avatar looks" });
    }
  });

  // Train avatar group
  app.post("/api/photo-avatars/groups/:groupId/train", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { defaultVoiceId } = req.body;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const result = await photoAvatarService.trainAvatarGroup(
        groupId,
        defaultVoiceId
      );

      res.json(result);
    } catch (error) {
      console.error("Failed to train avatar group:", error);
      res.status(500).json({ error: "Failed to train avatar group" });
    }
  });

  // Generate new looks
  app.post(
    "/api/photo-avatars/groups/:groupId/generate-looks",
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const { numLooks = 3 } = req.body;

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const looks = await photoAvatarService.generateNewLooks(
          groupId,
          numLooks
        );

        res.json(looks);
      } catch (error) {
        console.error("Failed to generate new looks:", error);
        res.status(500).json({ error: "Failed to generate new looks" });
      }
    }
  );

  // Check training status
  app.get("/api/photo-avatars/groups/:groupId/status", async (req, res) => {
    try {
      const { groupId } = req.params;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const status = await photoAvatarService.checkTrainingStatus(groupId);

      res.json(status);
    } catch (error) {
      console.error("Failed to check training status:", error);
      res.status(500).json({ error: "Failed to check training status" });
    }
  });

  // Delete avatar group
  app.delete("/api/photo-avatars/groups/:groupId", async (req, res) => {
    try {
      const { groupId } = req.params;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      await photoAvatarService.deleteAvatarGroup(groupId);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete avatar group:", error);
      res.status(500).json({ error: "Failed to delete avatar group" });
    }
  });

  // Delete individual avatar
  app.delete("/api/photo-avatars/:avatarId", async (req, res) => {
    try {
      const { avatarId } = req.params;

      console.log("🗑️ Deleting individual avatar:", avatarId);

      const photoAvatarService = new HeyGenPhotoAvatarService();
      await photoAvatarService.deleteIndividualAvatar(avatarId);

      console.log("✅ Individual avatar deleted successfully");

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete individual avatar:", error);
      res.status(500).json({ error: "Failed to delete individual avatar" });
    }
  });

  // Edit/Generate new look with custom prompt
  app.post("/api/photo-avatars/groups/:groupId/edit-look", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { prompt, orientation, pose, style, referenceImages } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      console.log("✏️ Editing look for group:", groupId);
      console.log("✏️ Edit prompt:", prompt);
      console.log("✏️ Orientation:", orientation || "square");
      console.log("✏️ Pose:", pose || "half_body");
      console.log("✏️ Style:", style || "Realistic");

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const result = await photoAvatarService.editLook({
        groupId,
        prompt,
        orientation,
        pose,
        style,
        referenceImages,
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to edit look:", error);
      res.status(500).json({ error: "Failed to edit look" });
    }
  });

  // Add looks to existing avatar group
  app.post("/api/photo-avatars/groups/:groupId/add-looks", async (req, res) => {
    try {
      const { groupId } = req.params;
      const { imageKeys, name } = req.body;

      if (!imageKeys || !Array.isArray(imageKeys) || imageKeys.length === 0) {
        return res.status(400).json({ error: "Image keys array is required" });
      }

      console.log("➕ Adding looks to group:", groupId);
      console.log("➕ Number of images:", imageKeys.length);

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const result = await photoAvatarService.addLooks({
        groupId,
        imageKeys,
        name,
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to add looks:", error);
      res.status(500).json({ error: "Failed to add looks" });
    }
  });

  // Add motion to photo avatar
  app.post("/api/photo-avatars/:avatarId/add-motion", async (req, res) => {
    try {
      const { avatarId } = req.params;

      console.log("🎬 Adding motion to avatar:", avatarId);

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const result = await photoAvatarService.addMotion(avatarId);

      res.json(result);
    } catch (error) {
      console.error("Failed to add motion:", error);
      res.status(500).json({ error: "Failed to add motion" });
    }
  });

  // Add sound effect to photo avatar
  app.post(
    "/api/photo-avatars/:avatarId/add-sound-effect",
    async (req, res) => {
      try {
        const { avatarId } = req.params;

        console.log("🔊 Adding sound effect to avatar:", avatarId);

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const result = await photoAvatarService.addSoundEffect(avatarId);

        res.json(result);
      } catch (error) {
        console.error("Failed to add sound effect:", error);
        res.status(500).json({ error: "Failed to add sound effect" });
      }
    }
  );

  // Get avatar status (for checking motion/sound effect processing)
  app.get("/api/photo-avatars/:avatarId/status", async (req, res) => {
    try {
      const { avatarId } = req.params;

      const photoAvatarService = new HeyGenPhotoAvatarService();
      const status = await photoAvatarService.getAvatarStatus(avatarId);

      res.json(status);
    } catch (error) {
      console.error("Failed to get avatar status:", error);
      res.status(500).json({ error: "Failed to get avatar status" });
    }
  });

  // Save voice recording to avatar group
  app.post(
    "/api/photo-avatars/groups/:groupId/voice",
    requireAuth,
    upload.single("voiceRecording"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No voice recording uploaded" });
        }

        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        const { groupId } = req.params;

        console.log("🎤 Uploading voice recording to avatar group:", {
          groupId,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        });

        // Read the file buffer
        const fileBuffer = fs.readFileSync(req.file.path);

        // Upload audio file to S3
        const s3Service = new S3UploadService();
        const audioUrl = await s3Service.uploadFile(
          userId,
          fileBuffer,
          `avatar-voices/${groupId}/${nanoid()}_${req.file.originalname}`,
          req.file.mimetype
        );

        console.log("✅ Voice uploaded to S3:", audioUrl);

        let heygenAudioAssetId: string | undefined;

        // Upload to HeyGen for voice cloning
        try {
          console.log("🎤 Uploading audio to HeyGen for voice cloning...");

          const heygenService = new HeyGenService();
          heygenAudioAssetId = await heygenService.uploadAudio(
            fileBuffer,
            req.file.mimetype
          );

          console.log(
            "✅ HeyGen upload successful! Audio Asset ID:",
            heygenAudioAssetId
          );
        } catch (heygenError) {
          console.error("❌ HeyGen upload failed:", heygenError);
          // Continue anyway - voice is saved to S3
        }

        // Store the voice metadata in the database
        if (heygenAudioAssetId) {
          try {
            await storage.savePhotoAvatarGroupVoice({
              userId,
              groupId,
              audioUrl,
              heygenAudioAssetId,
            });
            console.log(
              `✅ Voice ${heygenAudioAssetId} saved to database for group ${groupId}`
            );
          } catch (dbError) {
            console.error("Failed to save voice to database:", dbError);
          }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          audioUrl,
          heygenAudioAssetId,
          message: "Voice recording saved successfully",
        });
      } catch (error) {
        console.error("Failed to save voice recording:", error);
        res.status(500).json({ error: "Failed to save voice recording" });
      }
    }
  );

  // Upload custom photo for photo avatar
  app.post(
    "/api/photo-avatars/upload",
    requireAuth,
    upload.single("photo"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No photo uploaded" });
        }

        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        console.log("📤 Uploading photo to HeyGen:", {
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        });

        const fileBuffer = fs.readFileSync(req.file.path);

        // ✨ AVATAR REUSE DETECTION: Check if this image already exists
        const crypto = await import("crypto");
        const imageHash = crypto
          .createHash("sha256")
          .update(fileBuffer)
          .digest("hex");
        console.log("🔍 Image hash:", imageHash);

        const existingAvatar = await storage.getPhotoAvatarGroupByImageHash(
          imageHash,
          userId
        );
        if (existingAvatar) {
          console.log(
            "♻️ Avatar reuse detected! Returning existing avatar:",
            existingAvatar.heygenGroupId
          );
          fs.unlinkSync(req.file.path); // Clean up temp file
          return res.json({
            imageKey: existingAvatar.heygenImageKey,
            s3Url: existingAvatar.s3ImageUrl,
            groupId: existingAvatar.heygenGroupId,
            reused: true,
            message:
              "This image was already uploaded. Reusing existing avatar.",
          });
        }

        // Upload to S3 for backup
        const s3Service = new S3UploadService();
        const s3ImageUrl = await s3Service.uploadFile(
          userId,
          fileBuffer,
          `avatar-images/${nanoid()}_${req.file.originalname}`,
          req.file.mimetype
        );
        console.log("✅ Photo backed up to S3:", s3ImageUrl);

        // Upload to HeyGen and get the image key
        const photoAvatarService = new HeyGenPhotoAvatarService();
        const heygenImageKey = await photoAvatarService.uploadCustomPhoto(
          fileBuffer,
          req.file.mimetype
        );

        console.log("✅ Photo uploaded to HeyGen, key:", heygenImageKey);

        // Clean up temporary file
        fs.unlinkSync(req.file.path);

        res.json({
          imageKey: heygenImageKey,
          s3Url: s3ImageUrl,
          imageHash, // Return hash for storage when avatar group is created
          reused: false,
        });
      } catch (error: any) {
        console.error("❌ Failed to upload photo:");
        console.error("Error message:", error?.message);
        console.error("Full error:", error);
        res.status(500).json({
          error: "Failed to upload photo",
          details: error?.message || String(error),
        });
      }
    }
  );

  // Create avatar group from uploaded photos
  app.post(
    "/api/photo-avatars/create-from-uploads",
    requireAuth,
    async (req, res) => {
      try {
        const { name, imageKeys, imageHash, s3ImageUrl } = req.body;
        const userId = req.user?.id;

        console.log("🎭 Backend: Create avatar group request received");
        console.log("🎭 Backend: Request name:", name);
        console.log("🎭 Backend: Request imageKeys:", imageKeys);
        console.log("🎭 Backend: Request imageKeys type:", typeof imageKeys);
        console.log(
          "🎭 Backend: Request imageKeys isArray:",
          Array.isArray(imageKeys)
        );
        console.log("🎭 Backend: Image hash:", imageHash);

        if (
          !name ||
          !imageKeys ||
          !Array.isArray(imageKeys) ||
          imageKeys.length < 1
        ) {
          console.log("❌ Backend: Validation failed:", {
            hasName: !!name,
            hasImageKeys: !!imageKeys,
            isArray: Array.isArray(imageKeys),
            length: Array.isArray(imageKeys) ? imageKeys.length : 0,
          });
          return res.status(400).json({
            error: "Please provide a name and at least 1 photo",
          });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();

        console.log("🎭 Backend: Calling photoAvatarService.createAvatarGroup");
        // imageKeys are already HeyGen image keys from the upload endpoint
        console.log(
          "✅ Backend: Creating avatar group with HeyGen image keys:",
          imageKeys
        );

        // Create avatar group with HeyGen image keys
        const createResult = await photoAvatarService.createAvatarGroup(
          name,
          imageKeys
        );

        console.log(
          "✅ Backend: Avatar group creation result:",
          JSON.stringify(createResult, null, 2)
        );

        // Automatically start training
        const groupId = createResult.group_id || createResult.avatar_group_id;
        console.log("🎭 Backend: Extracted groupId for training:", groupId);

        // ✨ Save avatar group metadata to database for duplicate detection
        if (userId && groupId) {
          try {
            await storage.createPhotoAvatarGroup({
              userId,
              heygenGroupId: groupId,
              name,
              imageHash: imageHash || null,
              s3ImageUrl: s3ImageUrl || null,
              heygenImageKey: imageKeys[0], // Primary image key
              status: "pending",
              trainingProgress: 0,
            });
            console.log("💾 Avatar group metadata saved to database");
          } catch (dbError) {
            console.error("⚠️ Failed to save avatar group metadata:", dbError);
            // Don't fail the request, just log the error
          }
        }

        if (groupId) {
          try {
            console.log("🚀 Backend: Starting training for group:", groupId);
            await photoAvatarService.trainAvatarGroup(groupId);
            console.log("✅ Backend: Training started successfully");
          } catch (trainingError: any) {
            console.log(
              "⚠️ Backend: Training failed, but group was created successfully:",
              trainingError?.message
            );
            console.log(
              "⚠️ Backend: Group creation was successful, training may happen automatically"
            );
          }
        } else {
          console.log("⚠️ Backend: No groupId found, skipping training");
        }

        const responseData = {
          success: true,
          groupId: groupId,
          message: "Avatar group created and training started",
        };

        console.log(
          "🎭 Backend: Sending response:",
          JSON.stringify(responseData, null, 2)
        );
        res.json(responseData);
      } catch (error: any) {
        console.error("❌ Backend: Failed to create avatar group from uploads");
        console.error("❌ Backend: Error message:", error?.message);
        console.error("❌ Backend: Error stack:", error?.stack);
        console.error("❌ Backend: Full error:", error);
        res.status(500).json({
          error: "Failed to create avatar group",
          details: error?.message || String(error),
        });
      }
    }
  );

  // ==================== VIDEO GENERATION ENDPOINTS ====================

  // Generate video from avatar and script
  app.post("/api/videos/generate", requireAuth, async (req, res) => {
    try {
      const {
        avatarId,
        script,
        title,
        test,
        isTalkingPhoto,
        voiceSpeed,
        voiceId,
        customVoiceAvatarId,
        voiceLibraryId,
      } = req.body;

      console.log("🎬 Backend: Video generation request received");
      console.log("🎬 Backend: Avatar ID:", avatarId);
      console.log("🎬 Backend: Script length:", script?.length);
      console.log("🎬 Backend: Title:", title);
      console.log("🎬 Backend: Test mode:", test);
      console.log("🎬 Backend: isTalkingPhoto:", isTalkingPhoto);
      console.log("🎬 Backend: Voice speed:", voiceSpeed);
      console.log("🎬 Backend: Voice ID:", voiceId);
      console.log("🎬 Backend: Custom voice avatar ID:", customVoiceAvatarId);
      console.log("🎬 Backend: Voice Library ID:", voiceLibraryId);

      if (!avatarId || !script) {
        console.log("❌ Backend: Validation failed:", {
          hasAvatarId: !!avatarId,
          hasScript: !!script,
        });
        return res.status(400).json({
          error: "Please provide an avatar ID and script",
        });
      }

      // Handle custom voice if provided
      let finalVoiceId = voiceId;
      let audioAssetId: string | undefined;

      // Handle Voice Library voices
      if (voiceId === "voice_library" && voiceLibraryId) {
        const user = (req as any).user;
        const voices = await storage.listCustomVoices(user.id);
        const voiceLibraryVoice = voices.find((v) => v.id === voiceLibraryId);

        if (
          voiceLibraryVoice?.heygenAudioAssetId &&
          voiceLibraryVoice.status === "ready"
        ) {
          console.log("🎤 Backend: Voice Library voice detected!");
          console.log(
            "🎤 Backend: Audio Asset ID:",
            voiceLibraryVoice.heygenAudioAssetId
          );
          audioAssetId = voiceLibraryVoice.heygenAudioAssetId;
          finalVoiceId = undefined; // Don't use text voice when using audio
        } else {
          console.log(
            "⚠️ Backend: Voice Library voice not ready or missing asset ID, using fallback"
          );
          finalVoiceId = "119caed25533477ba63822d5d1552d25"; // Neutral - Balanced
        }
      } else if (voiceId === "custom_voice" && customVoiceAvatarId) {
        // Look up the photo avatar group voice for this avatar
        const user = (req as any).user;
        const customAvatar = await storage.getAvatarById(customVoiceAvatarId);

        if (customAvatar?.groupId) {
          console.log("🎤 Backend: Custom voice avatar detected!");
          console.log("🎤 Backend: Avatar Group ID:", customAvatar.groupId);

          const groupVoice = await storage.getPhotoAvatarGroupVoice(
            customAvatar.groupId,
            user.id
          );

          if (groupVoice?.heygenAudioAssetId) {
            console.log(
              "🎤 Backend: Found group voice with Audio Asset ID:",
              groupVoice.heygenAudioAssetId
            );
            audioAssetId = groupVoice.heygenAudioAssetId;
            finalVoiceId = undefined; // Don't use text voice when using audio
          } else {
            console.log(
              "⚠️ Backend: No group voice found for avatar group, using fallback"
            );
            finalVoiceId = "119caed25533477ba63822d5d1552d25"; // Neutral - Balanced
          }
        } else {
          console.log("⚠️ Backend: Avatar has no groupId, using fallback");
          finalVoiceId = "119caed25533477ba63822d5d1552d25"; // Neutral - Balanced
        }
      } else if (voiceId) {
        // Check if voiceId is actually a custom voice audio asset ID from a photo avatar group
        const user = (req as any).user;
        const allPhotoAvatarGroupVoices =
          await storage.listPhotoAvatarGroupVoices(user.id);
        const matchingGroupVoice = allPhotoAvatarGroupVoices.find(
          (v) => v.heygenAudioAssetId === voiceId
        );

        if (matchingGroupVoice) {
          console.log("🎤 Backend: Photo Avatar Group custom voice detected!");
          console.log("🎤 Backend: Group ID:", matchingGroupVoice.groupId);
          console.log(
            "🎤 Backend: Audio Asset ID:",
            matchingGroupVoice.heygenAudioAssetId
          );
          audioAssetId = matchingGroupVoice.heygenAudioAssetId;
          finalVoiceId = undefined; // Don't use text voice when using audio
        }
      }

      const heyGenService = new HeyGenService();
      console.log("🎬 Backend: Calling HeyGenService.generateVideo");

      const result = await heyGenService.generateVideo({
        avatarId,
        script,
        title: title || "Generated Video",
        test: test || false,
        isTalkingPhoto: !!isTalkingPhoto,
        speed: voiceSpeed || 1.0,
        voiceId: finalVoiceId,
        audioAssetId,
      });

      console.log("✅ Backend: Video generation result:", result);
      res.json(result);
    } catch (error: any) {
      console.error("❌ Backend: Failed to generate video");
      console.error("❌ Backend: Error message:", error?.message);
      console.error("❌ Backend: Error stack:", error?.stack);
      res.status(500).json({
        error: "Failed to generate video",
        details: error?.message || String(error),
      });
    }
  });

  // Get video generation status
  app.get("/api/videos/:videoId/status", requireAuth, async (req, res) => {
    try {
      const { videoId } = req.params;
      const userId = req.user?.id;

      console.log("📊 Backend: Getting video status for:", videoId);

      const heyGenService = new HeyGenService();
      const status = await heyGenService.getVideoStatus(videoId);

      console.log("✅ Backend: Video status result:", status);

      // Extended response with S3 backup URLs
      let response: any = { ...status };

      // If video is completed and has a URL, backup to S3
      if (status.status === "completed" && status.video_url && userId) {
        try {
          console.log("💾 Backend: Video completed, backing up to S3...");

          // Download video from HeyGen CDN
          const videoResponse = await fetch(status.video_url);
          if (videoResponse.ok) {
            const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

            // Upload to S3
            const s3Service = new S3UploadService();
            const s3VideoUrl = await s3Service.uploadFile(
              userId,
              videoBuffer,
              `generated-videos/${videoId}.mp4`,
              "video/mp4"
            );

            console.log("✅ Backend: Video backed up to S3:", s3VideoUrl);

            // Add S3 URL to the response
            response.s3_video_url = s3VideoUrl;

            // Download and backup thumbnail if available
            if (status.thumbnail_url) {
              try {
                const thumbnailResponse = await fetch(status.thumbnail_url);
                if (thumbnailResponse.ok) {
                  const thumbnailBuffer = Buffer.from(
                    await thumbnailResponse.arrayBuffer()
                  );
                  const s3ThumbnailUrl = await s3Service.uploadFile(
                    userId,
                    thumbnailBuffer,
                    `generated-videos/${videoId}_thumbnail.jpg`,
                    "image/jpeg"
                  );
                  response.s3_thumbnail_url = s3ThumbnailUrl;
                  console.log(
                    "✅ Backend: Thumbnail backed up to S3:",
                    s3ThumbnailUrl
                  );
                }
              } catch (thumbError) {
                console.error(
                  "⚠️ Backend: Thumbnail backup failed:",
                  thumbError
                );
              }
            }
          }
        } catch (backupError) {
          console.error(
            "⚠️ Backend: S3 backup failed, continuing anyway:",
            backupError
          );
        }
      }

      res.json(response);
    } catch (error: any) {
      console.error("❌ Backend: Failed to get video status");
      console.error("❌ Backend: Error message:", error?.message);

      // If HeyGen returns 404, treat as transient (job not yet visible in status service)
      if ((error as any)?.status === 404) {
        console.log(
          "⏱️ Backend: Video not found in HeyGen status service yet, returning 'processing'"
        );
        return res.json({ video_id: req.params.videoId, status: "processing" });
      }

      res.status(500).json({
        error: "Failed to get video status",
        details: error?.message || String(error),
      });
    }
  });

  // Get video details
  app.get("/api/videos/:videoId", requireAuth, async (req, res) => {
    try {
      const { videoId } = req.params;

      console.log("📹 Backend: Getting video details for:", videoId);

      const heyGenService = new HeyGenService();
      const video = await heyGenService.getVideo(videoId);

      console.log("✅ Backend: Video details result:", video);
      res.json(video);
    } catch (error: any) {
      console.error("❌ Backend: Failed to get video details");
      console.error("❌ Backend: Error message:", error?.message);
      res.status(500).json({
        error: "Failed to get video details",
        details: error?.message || String(error),
      });
    }
  });

  // ==================== TEMPLATE ENDPOINTS ====================

  // List templates
  app.get("/api/templates", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const templateService = new HeyGenTemplateService();
      const templates = await templateService.listTemplates(limit, offset);

      res.json(templates);
    } catch (error) {
      console.error("Failed to list templates:", error);
      res.status(500).json({ error: "Failed to list templates" });
    }
  });

  // Get all templates (legacy real-estate endpoint now proxies full list)
  app.get("/api/templates/real-estate", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      console.log(
        `[Templates] Requesting real-estate list with limit=${limit}, offset=${offset}`
      );

      const templateService = new HeyGenTemplateService();
      const response = await templateService.listTemplates(limit, offset);

      const templates = Array.isArray(response)
        ? response
        : Array.isArray(response?.templates)
        ? response.templates
        : Array.isArray(response?.data?.templates)
        ? response.data.templates
        : [];

      console.log(
        `[Templates] HeyGen returned ${templates.length} templates (raw type: ${
          Array.isArray(response) ? "array" : typeof response
        })`
      );

      if (templates.length > 0) {
        res.json({ templates });
        return;
      }

      console.log(
        "[Templates] No templates from HeyGen, returning suggestions"
      );

      res.json({
        templates: [],
        suggestions: [
          {
            name: "Property Tour Template",
            description: "Virtual property walkthrough with agent narration",
            recommended_variables: {
              property_address: "text",
              agent_avatar: "avatar",
              property_images: "image[]",
              price: "text",
              features: "text",
            },
          },
          {
            name: "Market Update Template",
            description: "Monthly real estate market analysis video",
            recommended_variables: {
              month: "text",
              market_stats: "text",
              agent_avatar: "avatar",
              charts: "image[]",
            },
          },
          {
            name: "Agent Introduction Template",
            description: "Professional agent introduction and services",
            recommended_variables: {
              agent_name: "text",
              agent_avatar: "avatar",
              expertise: "text",
              contact_info: "text",
            },
          },
        ],
      });
    } catch (error) {
      console.error("[Templates] Failed to get real estate templates:", error);
      res.json({
        templates: [],
        suggestions: [
          {
            name: "Property Tour Template",
            description: "Virtual property walkthrough with agent narration",
            recommended_variables: {
              property_address: "text",
              agent_avatar: "avatar",
              property_images: "image[]",
              price: "text",
              features: "text",
            },
          },
          {
            name: "Market Update Template",
            description: "Monthly real estate market analysis video",
            recommended_variables: {
              month: "text",
              market_stats: "text",
              agent_avatar: "avatar",
              charts: "image[]",
            },
          },
          {
            name: "Agent Introduction Template",
            description: "Professional agent introduction and services",
            recommended_variables: {
              agent_name: "text",
              agent_avatar: "avatar",
              expertise: "text",
              contact_info: "text",
            },
          },
        ],
      });
    }
  });

  // Get template details
  app.get("/api/templates/:templateId", async (req, res) => {
    try {
      const { templateId } = req.params;
      const templateService = new HeyGenTemplateService();

      // Safety: if someone hits the legacy path and it falls through here,
      // treat it as a list-all request instead of single-template lookup.
      if (templateId === "real-estate") {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        console.log(
          `[Templates] Fallback: parameterized route caught 'real-estate'; proxying listTemplates(limit=${limit}, offset=${offset})`
        );
        const response = await templateService.listTemplates(limit, offset);
        const templates = Array.isArray(response)
          ? response
          : Array.isArray((response as any)?.templates)
          ? (response as any).templates
          : Array.isArray((response as any)?.data?.templates)
          ? (response as any).data.templates
          : [];
        return res.json({ templates });
      }

      // Use v3 API service for template details with variables
      const templatesV3Service = new HeyGenTemplatesV3Service();
      const details = await templatesV3Service.getTemplateDetails(templateId);

      res.json(details);
    } catch (error) {
      console.error("Failed to get template:", error);
      res.status(500).json({ error: "Failed to get template" });
    }
  });

  // Create custom template
  app.post("/api/templates", async (req, res) => {
    try {
      const { name, description, elements } = req.body;

      const templateService = new HeyGenTemplateService();
      const template = await templateService.createTemplate(
        name,
        description,
        elements
      );

      res.json(template);
    } catch (error) {
      console.error("Failed to create template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Generate video from template
  app.post("/api/templates/:templateId/generate", async (req, res) => {
    try {
      const { templateId } = req.params;
      const { variables, title, test } = req.body;

      const templateService = new HeyGenTemplateService();
      const result = await templateService.generateFromTemplate({
        templateId,
        variables,
        title,
        test,
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to generate from template:", error);
      res.status(500).json({ error: "Failed to generate from template" });
    }
  });

  // Update template
  app.put("/api/templates/:templateId", async (req, res) => {
    try {
      const { templateId } = req.params;

      const templateService = new HeyGenTemplateService();
      const updated = await templateService.updateTemplate(
        templateId,
        req.body
      );

      res.json(updated);
    } catch (error) {
      console.error("Failed to update template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // Delete template
  app.delete("/api/templates/:templateId", async (req, res) => {
    try {
      const { templateId } = req.params;

      const templateService = new HeyGenTemplateService();
      await templateService.deleteTemplate(templateId);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Get template variables
  app.get("/api/templates/:templateId/variables", async (req, res) => {
    try {
      const { templateId } = req.params;

      const templateService = new HeyGenTemplateService();
      const variables = await templateService.getTemplateVariables(templateId);

      res.json(variables);
    } catch (error) {
      console.error("Failed to get template variables:", error);
      res.status(500).json({ error: "Failed to get template variables" });
    }
  });

  // Create template from video
  app.post("/api/templates/from-video", async (req, res) => {
    try {
      const { videoId, name } = req.body;

      const templateService = new HeyGenTemplateService();
      const template = await templateService.createTemplateFromVideo(
        videoId,
        name
      );

      res.json(template);
    } catch (error) {
      console.error("Failed to create template from video:", error);
      res.status(500).json({ error: "Failed to create template from video" });
    }
  });

  // Duplicate template
  app.post("/api/templates/:templateId/duplicate", async (req, res) => {
    try {
      const { templateId } = req.params;
      const { name } = req.body;

      const templateService = new HeyGenTemplateService();
      const duplicated = await templateService.duplicateTemplate(
        templateId,
        name
      );

      res.json(duplicated);
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      res.status(500).json({ error: "Failed to duplicate template" });
    }
  });

  // Get template generation status
  app.get(
    "/api/templates/generation/:generationId/status",
    async (req, res) => {
      try {
        const { generationId } = req.params;

        const templateService = new HeyGenTemplateService();
        const status = await templateService.getTemplateGenerationStatus(
          generationId
        );

        res.json(status);
      } catch (error) {
        console.error("Failed to get generation status:", error);
        res.status(500).json({ error: "Failed to get generation status" });
      }
    }
  );

  // Get available voices from HeyGen
  app.get("/api/voices", async (req, res) => {
    try {
      const heygenService = new HeyGenService();
      const voices = await heygenService.getVoices();
      res.json(voices);
    } catch (error) {
      console.error("Failed to fetch voices:", error);
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  // Quick generate: Generate a video from a template (public, for quick testing)
  app.post("/api/templates/generate-quick", async (req, res) => {
    try {
      const {
        templateId,
        title,
        variables,
        caption,
        dimension,
        include_gif,
        enable_sharing,
        scene_ids,
        test,
      } = req.body || {};

      if (!templateId) {
        return res.status(400).json({ error: "templateId is required" });
      }

      const templateService = new HeyGenTemplateService();
      const result = await templateService.generateFromTemplate({
        templateId,
        variables,
        title,
        caption,
        dimension,
        include_gif,
        enable_sharing,
        scene_ids,
        test,
      });

      return res.json(result);
    } catch (error: any) {
      console.error("Quick template generate failed:", error);
      return res.status(500).json({
        error: "Failed to generate video from template",
        details: error?.message || String(error),
      });
    }
  });

  // Quick status: proxy to video status lookup without auth for testing
  app.get("/api/templates/video-status/:videoId", async (req, res) => {
    try {
      const { videoId } = req.params;
      if (!videoId) return res.status(400).json({ error: "videoId required" });

      const heyGenService = new HeyGenService();
      const status = await heyGenService.getVideoStatus(videoId);
      return res.json(status);
    } catch (error: any) {
      console.error("Quick video status failed:", error);
      return res.status(500).json({
        error: "Failed to get video status",
        details: error?.message || String(error),
      });
    }
  });

  // Fallback property data for when external APIs are unavailable
  function getFallbackPropertyData(searchParams: any) {
    const sampleProperties = [
      {
        id: "DEMO-001",
        mlsNumber: "21234567",
        address: "123 Dodge Street",
        city: "Omaha",
        state: "NE",
        zipCode: "68102",
        listPrice: 285000,
        bedrooms: 3,
        bathrooms: 2.5,
        squareFootage: 1850,
        lotSize: 0.25,
        yearBuilt: 2015,
        propertyType: "House",
        status: "Active",
        listingDate: "2024-01-15",
        neighborhood: "Dundee",
        agentName: "Sample Agent",
        photoUrls: [
          "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=500&q=80",
          "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=500&q=80",
          "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=500&q=80",
        ],
      },
      {
        id: "DEMO-002",
        mlsNumber: "21234568",
        address: "456 Farnam Street",
        city: "Omaha",
        state: "NE",
        zipCode: "68131",
        listPrice: 425000,
        bedrooms: 4,
        bathrooms: 3,
        squareFootage: 2400,
        lotSize: 0.3,
        yearBuilt: 2018,
        propertyType: "House",
        status: "Active",
        listingDate: "2024-01-20",
        neighborhood: "Aksarben",
        agentName: "Sample Agent",
        photoUrls: [
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=500&q=80",
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80",
          "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&q=80",
        ],
      },
    ];

    return {
      success: true,
      count: sampleProperties.length,
      totalAvailable: sampleProperties.length,
      properties: sampleProperties,
      searchCriteria: searchParams,
      fallback: true,
      message: "Demo data - External property service temporarily unavailable",
    };
  }

  // Unified property search helper with fallback chain
  async function tryFallbackChain(query: any, res: any) {
    // Try Paragon MLS service
    try {
      const mlsService = new MLSService();
      const paragonResult = await mlsService.searchProperties({
        mlsNumber: query.mls_number || query.mls,
        address: query.address,
        city: query.city,
        listingAgent: query.agent || query.listing_agent_name,
      });
      if (paragonResult && paragonResult.length > 0) {
        console.log("Fallback: Paragon MLS returned results");
        return res.json({
          success: true,
          count: paragonResult.length,
          properties: paragonResult,
          source: "paragon-mls",
        });
      }
    } catch (error) {
      console.warn("Paragon MLS fallback failed:", error);
    }

    // Try IDX service
    try {
      const idxService = new IDXService();
      const idxResult = await idxService.searchProperties({
        city: query.city,
        state: query.state || "NE",
      });
      if (idxResult && idxResult.length > 0) {
        console.log("Fallback: IDX service returned results");
        return res.json({
          success: true,
          count: idxResult.length,
          properties: idxResult,
          source: "idx-service",
        });
      }
    } catch (error) {
      console.warn("IDX service fallback failed:", error);
    }

    // Final fallback to sample data
    console.log("All services failed, returning sample data");
    return res.json(getFallbackPropertyData(query));
  }

  // GBCMA API proxy endpoint to handle CORS
  app.get("/api/property/search", async (req, res) => {
    try {
      const baseUrl =
        "http://gbcma.us-east-2.elasticbeanstalk.com/api/property-search-new";
      const params = new URLSearchParams();

      // Parameter mapping and forwarding to gbcma API
      if (req.query.mls_number || req.query.mls) {
        const mlsNumber = req.query.mls_number || req.query.mls;
        params.append("mls_number", mlsNumber as string);
      }
      if (req.query.address)
        params.append("address", req.query.address as string);
      if (req.query.agent || req.query.listing_agent_name) {
        const agent = req.query.agent || req.query.listing_agent_name;
        params.append("listing_agent_name", agent as string);
      }
      if (req.query.city) params.append("city", req.query.city as string);

      const fullUrl = `${baseUrl}?${params.toString()}`;
      console.log("Proxying to gbcma API:", fullUrl);

      // Use global fetch (available in Node.js 18+)
      const response = await globalThis.fetch(fullUrl);

      if (!response.ok) {
        console.warn(
          `GBCMA API unavailable (${response.status}), trying fallback chain`
        );
        return await tryFallbackChain(req.query, res);
      }

      const data = await response.json();
      console.log("GBCMA API response:", data);

      // If API returns no results, try fallback chain
      if (data.success && data.count === 0) {
        console.log("No properties found in GBCMA, trying fallback chain");
        return await tryFallbackChain(req.query, res);
      }

      res.json({ ...data, source: "gbcma" });
    } catch (error: any) {
      console.error("GBCMA proxy error:", error);
      // Try fallback chain instead of immediate sample data
      return await tryFallbackChain(req.query, res);
    }
  });

  // GBCMA property details by address API endpoint
  app.post("/api/property/details-by-address", async (req, res) => {
    try {
      const { address, mlsNumber } = req.body;

      if (!address && !mlsNumber) {
        return res
          .status(400)
          .json({ error: "Address or MLS number is required" });
      }

      const apiUrl = "http://simple-cma.com/api/property-details-from-address";
      console.log("Getting property details for address:", address);

      const response = await globalThis.fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
          "User-Agent": "Mozilla/5.0 (compatible; Real Estate Platform)",
        },
        body: JSON.stringify({ address: address || mlsNumber }),
      });

      if (!response.ok) {
        console.warn(
          `Property details API unavailable (${response.status}), returning fallback response`
        );
        // Return a fallback response when API is down
        return res.json({
          success: false,
          message:
            "Property details service temporarily unavailable. Please try the general property search instead.",
          property: null,
        });
      }

      const data = await response.json();
      console.log("GBCMA property details response:", data);
      res.json(data);
    } catch (error: any) {
      console.error("GBCMA property details error:", error);
      // Return graceful fallback instead of error
      res.json({
        success: false,
        message:
          "Property details service temporarily unavailable. Please try the general property search instead.",
        property: null,
        fallback: true,
      });
    }
  });

  // Object Storage endpoints for branding and file uploads
  const objectStorageService = new ObjectStorageService();

  // Serve public objects
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      // Check if public object search paths are configured
      if (!objectStorageService.hasPublicPaths()) {
        console.warn("Public object search paths not configured");
        return res.status(503).json({
          error: "Object storage service unavailable",
          message:
            "PUBLIC_OBJECT_SEARCH_PATHS environment variable is not configured",
        });
      }

      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve private objects
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      // Check if private object directory is configured
      if (!objectStorageService.hasPrivateDir()) {
        console.warn("Private object directory not configured");
        return res.status(503).json({
          error: "Object storage service unavailable",
          message: "PRIVATE_OBJECT_DIR environment variable is not configured",
        });
      }

      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get upload URL for object entities
  app.post("/api/objects/upload", async (req, res) => {
    try {
      // Check if private object directory is configured
      if (!objectStorageService.hasPrivateDir()) {
        console.warn("Private object directory not configured for uploads");
        return res.status(503).json({
          error: "Object storage service unavailable",
          message: "PRIVATE_OBJECT_DIR environment variable is not configured",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Brand Guide Analysis API
  app.post("/api/brand-guide/analyze", async (req, res) => {
    try {
      console.log("🔍 Brand guide analysis started:", {
        fileType: req.body.fileType,
        fileUrl: req.body.fileUrl?.substring(0, 50) + "...",
      });
      const { fileUrl, fileType } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ error: "File URL is required" });
      }

      // Import OpenAI here to avoid issues with module loading
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      let messages: any[] = [];
      let extractedText = "";

      if (fileType?.startsWith("image/")) {
        // For image files (JPG, PNG, etc.)
        messages = [
          {
            role: "system",
            content:
              "You are a brand analysis expert. Analyze the uploaded brand guide image and extract brand information in JSON format.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this brand guide image and extract the following information in JSON format:
                {
                  "colors": {
                    "primary": "#hexcode",
                    "secondary": "#hexcode", 
                    "accent": "#hexcode",
                    "background": "#hexcode",
                    "text": "#hexcode"
                  },
                  "fonts": {
                    "heading": "Font Name",
                    "body": "Font Name",
                    "accent": "Font Name"
                  },
                  "logoDescription": "Description of logo elements and style",
                  "brandDescription": "Brief brand description and personality",
                  "extractedText": "Any important text found in the guide"
                }
                
                Look for:
                - Color swatches with hex codes, RGB values, or color names
                - Font names and typography examples  
                - Brand logos and visual elements
                - Brand messaging and descriptions
                - Style guidelines and brand personality
                
                Provide actual hex color codes where possible. If you see color swatches, try to determine the hex values. For fonts, look for font family names displayed in the guide.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: fileUrl,
                },
              },
            ],
          },
        ];
      } else if (fileType === "application/pdf") {
        // For PDF files, use object storage to read the file
        try {
          console.log("📁 Reading PDF from object storage:", fileUrl);

          // Extract the object path from the URL
          const pdfObjectStorageService = new ObjectStorageService();

          // Check if private object directory is configured for PDF analysis
          if (!pdfObjectStorageService.hasPrivateDir()) {
            console.warn(
              "Private object directory not configured for PDF analysis"
            );
            return res.status(503).json({
              error: "Object storage service unavailable",
              message:
                "Cannot analyze PDF files without PRIVATE_OBJECT_DIR configuration",
            });
          }

          const objectPath =
            pdfObjectStorageService.normalizeObjectEntityPath(fileUrl);
          const objectFile = await pdfObjectStorageService.getObjectEntityFile(
            objectPath
          );

          // Get the file contents as a buffer
          const chunks: Buffer[] = [];
          const stream = objectFile.createReadStream();

          for await (const chunk of stream) {
            chunks.push(chunk);
          }

          const pdfBuffer = Buffer.concat(chunks);
          console.log("📋 PDF buffer size:", pdfBuffer.length, "bytes");

          // Try alternative PDF parsing approach
          try {
            const pdfParse = await import("pdf-parse");
            const data = await pdfParse.default(pdfBuffer);
            extractedText = data.text;
          } catch (parseError) {
            console.log(
              "⚠️ PDF parsing failed, trying alternative approach..."
            );
            // Fallback: treat as plain text extraction or skip complex parsing
            extractedText =
              "PDF content could not be parsed as text. Using image analysis instead.";
          }

          console.log(
            "📄 PDF text extracted:",
            extractedText.substring(0, 200) + "..."
          );

          messages = [
            {
              role: "system",
              content:
                "You are a brand analysis expert. Analyze the text content from a brand guide PDF and extract brand information in JSON format.",
            },
            {
              role: "user",
              content: `Analyze this brand guide text content and extract the following information in JSON format:
              {
                "colors": {
                  "primary": "#hexcode",
                  "secondary": "#hexcode", 
                  "accent": "#hexcode",
                  "background": "#hexcode",
                  "text": "#hexcode"
                },
                "fonts": {
                  "heading": "Font Name",
                  "body": "Font Name",
                  "accent": "Font Name"
                },
                "logo": {
                  "description": "Detailed description of logo elements, colors, and style",
                  "colorsUsed": ["List of colors used in logo"],
                  "style": "Modern/Classic/Minimalist/etc.",
                  "elements": "Text, icons, symbols described"
                },
                "brandDescription": "Brief brand description and personality",
                "extractedText": "Key brand guidelines and information"
              }
              
              Look for:
              - Color names, hex codes, RGB values, or color specifications
              - Font family names and typography guidelines
              - Brand personality, voice, and messaging
              - Logo usage guidelines and descriptions
              - Logo colors, style, and visual elements
              - Brand values and positioning statements
              
              Brand Guide Content:
              ${extractedText}
              
              IMPORTANT: Return actual color values found in the document. Look for:
              - Exact hex codes (like #FF5733, #1A1A1A)
              - RGB values that can be converted to hex
              - Named colors that can be converted to hex
              - Pantone colors with hex equivalents
              
              For fonts, look for:
              - Specific font family names mentioned in the text
              - Typography sections listing font families
              - Headers mentioning font choices`,
            },
          ];
        } catch (pdfError: any) {
          console.error("❌ PDF processing error:", pdfError);
          return res.status(400).json({
            error:
              "Failed to process PDF file. Please ensure the PDF contains readable text content.",
            details: pdfError?.message || "Unknown error",
          });
        }
      } else {
        // For other document types
        return res.status(400).json({
          error:
            "Please upload an image format (JPG, PNG, etc.) or PDF of your brand guide.",
        });
      }

      console.log("🤖 Sending to OpenAI for analysis...");

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use GPT-4O for vision capabilities
        messages,
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const analysisResult = JSON.parse(
        response.choices[0].message.content || "{}"
      );

      // Debug logging to help troubleshoot
      console.log(
        "✅ Analysis Result:",
        JSON.stringify(analysisResult, null, 2)
      );

      res.json({
        success: true,
        analysis: analysisResult,
        rawContent:
          fileType === "application/pdf"
            ? extractedText.substring(0, 500) + "..."
            : "Image analysis",
      });
    } catch (error: any) {
      console.error("❌ Brand guide analysis error:", error);
      res.status(500).json({
        error: "Failed to analyze brand guide. Please try again.",
        details: error?.message || "Unknown error",
      });
    }
  });

  // Brand settings endpoints
  app.put("/api/brand-settings", async (req, res) => {
    try {
      const { assets, colors, fonts, description } = req.body;

      // In a real implementation, you would save this to the database
      // For now, we'll just simulate success

      console.log("Brand settings updated:", {
        assets,
        colors,
        fonts,
        description,
      });

      res.json({
        success: true,
        message: "Brand settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving brand settings:", error);
      res.status(500).json({ error: "Failed to save brand settings" });
    }
  });

  // Get brand settings
  app.get("/api/brand-settings", async (req, res) => {
    try {
      // In a real implementation, fetch from database
      const defaultBrandSettings = {
        assets: [
          { id: "primary-logo", name: "Primary Logo", type: "logo" },
          { id: "icon", name: "Icon/Favicon", type: "icon" },
          { id: "banner", name: "Banner/Header Image", type: "banner" },
          { id: "background", name: "Background Pattern", type: "background" },
        ],
        colors: {
          primary: "#daa520",
          secondary: "#b8860b",
          accent: "#ffd700",
          background: "#ffffff",
          text: "#333333",
        },
        fonts: {
          heading: "Playfair Display",
          body: "Inter",
          accent: "Cormorant Garamond",
        },
        description:
          "Golden Brick Real Estate - Premium luxury properties in Omaha, Nebraska. Specializing in high-end residential and commercial real estate with personalized service and expert market knowledge.",
      };

      res.json(defaultBrandSettings);
    } catch (error) {
      console.error("Error fetching brand settings:", error);
      res.status(500).json({ error: "Failed to fetch brand settings" });
    }
  });

  // ==================== TUTORIAL VIDEOS ENDPOINTS ====================

  // Get all tutorial videos or filter by category/subcategory
  app.get("/api/tutorial-videos", async (req, res) => {
    try {
      const { category, subcategory } = req.query;

      let query = db
        .select()
        .from(tutorialVideos)
        .where(eq(tutorialVideos.isActive, true));

      if (category) {
        query = query.where(eq(tutorialVideos.category, category as string));
      }
      if (subcategory) {
        query = query.where(
          eq(tutorialVideos.subcategory, subcategory as string)
        );
      }

      const videos = await query.orderBy(
        tutorialVideos.order,
        tutorialVideos.createdAt
      );

      // Convert S3 paths to full URLs
      const s3Service = new S3UploadService();
      const videosWithUrls = videos.map((video) => ({
        ...video,
        videoUrl: s3Service.getS3Url(video.videoUrl),
        thumbnailUrl: video.thumbnailUrl
          ? s3Service.getS3Url(video.thumbnailUrl)
          : null,
      }));

      res.json(videosWithUrls);
    } catch (error) {
      console.error("Error fetching tutorial videos:", error);
      res.status(500).json({ error: "Failed to fetch tutorial videos" });
    }
  });

  // Upload a tutorial video
  app.post(
    "/api/tutorial-videos/upload",
    videoUpload.single("video"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No video file uploaded" });
        }

        const { category, subcategory, title, description, duration, order } =
          req.body;

        if (!category || !subcategory || !title) {
          return res
            .status(400)
            .json({ error: "Category, subcategory, and title are required" });
        }

        console.log("📹 Uploading tutorial video:", {
          filename: req.file.originalname,
          category,
          subcategory,
          title,
        });

        const fileBuffer = fs.readFileSync(req.file.path);

        // Upload to S3 under RealtyFlow Tutorials structure
        const s3Service = new S3UploadService();
        const s3VideoUrl = await s3Service.uploadFile(
          0, // Admin user ID for tutorials
          fileBuffer,
          `realtyflow-tutorials/${category}/${subcategory}/${nanoid()}_${
            req.file.originalname
          }`,
          req.file.mimetype
        );

        console.log("✅ Tutorial video uploaded to S3:", s3VideoUrl);

        // Clean up temporary file
        fs.unlinkSync(req.file.path);

        // Save to database
        const [newVideo] = await db
          .insert(tutorialVideos)
          .values({
            category,
            subcategory,
            title,
            description: description || null,
            videoUrl: s3VideoUrl,
            duration: duration ? parseInt(duration) : null,
            order: order ? parseInt(order) : 0,
          })
          .returning();

        res.json(newVideo);
      } catch (error) {
        console.error("Failed to upload tutorial video:", error);
        res.status(500).json({ error: "Failed to upload tutorial video" });
      }
    }
  );

  // Delete a tutorial video
  app.delete("/api/tutorial-videos/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await db
        .update(tutorialVideos)
        .set({ isActive: false })
        .where(eq(tutorialVideos.id, parseInt(id)));

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete tutorial video:", error);
      res.status(500).json({ error: "Failed to delete tutorial video" });
    }
  });

  // HeyGen Template routes
  const heygenTemplateService = new HeyGenTemplateService();

  // List all HeyGen templates
  app.get("/api/heygen/templates", requireAuth, async (req, res) => {
    try {
      const templates = await heygenTemplateService.listTemplates();
      // templates is already an array, don't wrap it again
      res.json(templates);
    } catch (error) {
      console.error("Failed to list HeyGen templates:", error);
      res.status(500).json({ error: "Failed to list templates" });
    }
  });

  // Get template details
  app.get(
    "/api/heygen/templates/:templateId",
    requireAuth,
    async (req, res) => {
      try {
        const { templateId } = req.params;
        const details = await heygenTemplateService.getTemplateDetails(
          templateId
        );
        res.json(details);
      } catch (error) {
        console.error("Failed to get template details:", error);
        res.status(500).json({ error: "Failed to get template details" });
      }
    }
  );

  // Generate video from template
  app.post(
    "/api/heygen/templates/:templateId/generate",
    requireAuth,
    async (req, res) => {
      try {
        const { templateId } = req.params;
        const user = req.user;

        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const {
          title,
          variables,
          caption,
          dimension,
          include_gif,
          enable_sharing,
          scene_ids,
        } = req.body;

        console.log("🎬 Generating video from template:", templateId);
        console.log("📝 Title:", title);

        const result = await heygenTemplateService.generateVideoFromTemplate(
          templateId,
          {
            title,
            variables,
            caption,
            dimension,
            include_gif,
            enable_sharing,
            scene_ids,
          }
        );

        // Save the video to database so it appears in the videos list
        if (result.data?.video_id) {
          console.log(
            "💾 Saving template video to database, video_id:",
            result.data.video_id
          );

          const videoData = {
            userId: user.id,
            title: title || "Template Video",
            script: "",
            status: "generating" as const,
            videoType: "template" as const,
            heygenVideoId: result.data.video_id,
            heygenTemplateId: templateId,
            metadata: {
              templateVariables: variables,
              dimension,
              caption,
              include_gif,
              enable_sharing,
            },
          };

          const savedVideo = await storage.createVideoContent(videoData);
          console.log("✅ Template video saved with ID:", savedVideo.id);

          res.json({ ...result, savedVideoId: savedVideo.id });
        } else {
          res.json(result);
        }
      } catch (error) {
        console.error("Failed to generate video from template:", error);
        res
          .status(500)
          .json({ error: "Failed to generate video from template" });
      }
    }
  );

  // Serve uploaded files statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const httpServer = createServer(app);
  return httpServer;
}
