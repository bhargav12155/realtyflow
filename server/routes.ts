import {
  contentOpportunities,
  insertAvatarSchema,
  insertBrandSettingsSchema,
  insertCompanyProfileSchema,
  insertScheduledPostSchema,
  insertVideoContentSchema,
  pkceStore,
  tutorialVideos,
  updateScheduledPostSchema,
} from "@shared/schema";
import crypto from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import fs from "fs";
import { createServer, type Server } from "http";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import { db } from "./db";
import { requireAuth } from "./middleware/auth";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import { HeyGenService } from "./services/heygen";
import { HeyGenPhotoAvatarService } from "./services/heygen-photo-avatar";
import { HeyGenStreamingService } from "./services/heygen-streaming";
import { HeyGenTemplateService } from "./services/heygen-template";
import { HeyGenVideoAvatarService } from "./services/heygen-video-avatar";
import { IDXService } from "./services/idx";
import { MLSService } from "./services/mls";
import { getAPIKeyStatus, openaiService } from "./services/openai";
import { S3UploadService } from "./services/s3Upload";
import { seoService } from "./services/seo";
import { SocialMediaError, socialMediaService } from "./services/socialMedia";
import { storage } from "./storage";
import { realtimeService } from "./websocket";

// Shared streaming service instance (singleton) to maintain session state across requests
let streamingServiceInstance: HeyGenStreamingService | null = null;
function getStreamingService(): HeyGenStreamingService {
  if (!streamingServiceInstance) {
    streamingServiceInstance = new HeyGenStreamingService();
    // Set up automatic session cleanup every 10 minutes
    setInterval(() => {
      streamingServiceInstance?.cleanupOldSessions();
    }, 10 * 60 * 1000); // 10 minutes
  }
  return streamingServiceInstance;
}

const DEFAULT_SOCIAL_SAMPLE_IMAGE =
  process.env.SOCIAL_TEST_IMAGE_URL ||
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1080&q=80";

// PKCE helper functions
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// Database-backed PKCE storage functions
async function storePKCE(
  state: string,
  codeVerifier: string,
  expiresInMs: number = 600000
) {
  const expiresAt = new Date(Date.now() + expiresInMs);
  await db
    .insert(pkceStore)
    .values({
      state,
      codeVerifier,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: pkceStore.state,
      set: { codeVerifier, expiresAt },
    });
}

async function retrievePKCE(
  state: string
): Promise<{ codeVerifier: string; expiresAt: Date } | null> {
  const result = await db
    .select()
    .from(pkceStore)
    .where(eq(pkceStore.state, state))
    .limit(1);

  if (result.length === 0) return null;

  // Delete after retrieval (one-time use)
  await db.delete(pkceStore).where(eq(pkceStore.state, state));

  return {
    codeVerifier: result[0].codeVerifier,
    expiresAt: result[0].expiresAt,
  };
}

// Clean up expired PKCE entries every 10 minutes
setInterval(async () => {
  const now = new Date();
  try {
    await db.delete(pkceStore).where(sql`${pkceStore.expiresAt} < ${now}`);
  } catch (error) {
    console.error("Error cleaning up expired PKCE entries:", error);
  }
}, 10 * 60 * 1000);

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
    fileSize: 500 * 1024 * 1024, // 500MB limit for video uploads (training footage needs 2+ min)
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
  const resolveMemStorageUser = async (req: any) => {
    if (!req?.user) {
      return null;
    }

    const sessionId = req.user.id ? String(req.user.id) : undefined;
    let user = sessionId ? await storage.getUser(sessionId) : undefined;

    const memUsers: Map<string, any> | undefined = (storage as any).users;

    if (!user && req.user.email && memUsers) {
      const allUsers = Array.from(memUsers.values());
      user = allUsers.find((u) => u.email === req.user.email);
    }

    if (!user && req.user.username) {
      user = await storage.getUserByUsername(req.user.username);
    }

    if (!user && sessionId) {
      const derivedRole =
        req.user.type === "public"
          ? "public"
          : req.user.type === "team_lead"
          ? "team_lead"
          : "agent";

      const fallbackEmail =
        req.user.email || `${sessionId}@placeholder.realtyflow`;

      user = await storage.createUser({
        username:
          req.user.username ||
          req.user.email?.split("@")[0] ||
          `user_${sessionId}`,
        email: fallbackEmail,
        password: "",
        name: req.user.email || `User ${sessionId}`,
        role: derivedRole as "agent" | "public" | "team_lead",
      });
    }

    return user || null;
  };

  const toBoolean = (value: any) => {
    if (typeof value === "string") {
      return ["true", "1", "on", "yes"].includes(value.toLowerCase());
    }
    return Boolean(value);
  };

  // Helper function to ensure S3 URLs are properly formatted
  const ensureS3Url = (urlOrKey: string | null | undefined): string | null => {
    if (!urlOrKey) return null;
    // If already a URL, return as-is
    if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://")) {
      return urlOrKey;
    }
    // Otherwise, convert S3 key to full URL
    const s3Service = new S3UploadService();
    return s3Service.getS3Url(urlOrKey);
  };
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

      // Use the published deployment URL for consistent iframe embedding
      const appUrl = "https://multi-users-realtyflow.replit.app";

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

      // Add real engagement leads from tracking system
      try {
        const { engagementLeads } = await import("@shared/schema");
        const {
          count,
          gte,
          lt,
          and,
          sql: drizzleSql,
        } = await import("drizzle-orm");

        // Get first day of current month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get first day of last month
        const firstDayOfLastMonth = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );

        // Count engagement leads created this month
        const monthlyLeadsResult = await db
          .select({ count: count() })
          .from(engagementLeads)
          .where(gte(engagementLeads.createdAt, firstDayOfMonth));

        const currentMonthLeads = monthlyLeadsResult[0]?.count || 0;

        // Count engagement leads created last month
        const lastMonthLeadsResult = await db
          .select({ count: count() })
          .from(engagementLeads)
          .where(
            and(
              gte(engagementLeads.createdAt, firstDayOfLastMonth),
              lt(engagementLeads.createdAt, firstDayOfMonth)
            )
          );

        const lastMonthLeads = lastMonthLeadsResult[0]?.count || 0;

        // Calculate percentage change
        let leadsChange = 0;
        if (lastMonthLeads > 0) {
          leadsChange =
            ((currentMonthLeads - lastMonthLeads) / lastMonthLeads) * 100;
        } else if (currentMonthLeads > 0) {
          leadsChange = 100; // If no leads last month but some this month, 100% increase
        }

        // Replace static monthly_leads with real engagement leads count
        overview.monthly_leads = currentMonthLeads;
        overview.monthly_leads_change = Math.round(leadsChange * 10) / 10; // Round to 1 decimal

        console.log(
          `📊 Dashboard: ${currentMonthLeads} engagement leads this month (${
            leadsChange >= 0 ? "+" : ""
          }${leadsChange.toFixed(1)}% vs last month)`
        );
      } catch (error) {
        console.warn(
          "Failed to fetch engagement leads, using static data:",
          error
        );
      }

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

      // Fetch company profile for dynamic personalization
      const userId = req.user?.id;
      let companyProfile = null;
      if (userId) {
        companyProfile = await storage.getCompanyProfile(userId);
      }

      // Use unified AI service (GitHub Copilot primary, OpenAI fallback)
      const { unifiedAI } = await import("./services/unified-ai");
      const generatedContent = await unifiedAI.generateStructuredContent({
        type,
        topic,
        aiPrompt,
        neighborhood,
        keywords,
        seoOptimized,
        longTailKeywords,
        localSeoFocus,
        propertyData,
        companyProfile: companyProfile || undefined,
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

      // Fetch company profile for dynamic personalization
      const userId = req.user?.id;
      let companyProfile = null;
      if (userId) {
        companyProfile = await storage.getCompanyProfile(userId);
      }

      const socialPost = await openaiService.generateSocialMediaPost(
        topic,
        platform,
        neighborhood,
        companyProfile || undefined
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

  // LinkedIn OAuth diagnostic page
  app.get("/api/linkedin/test", requireAuth, async (req, res) => {
    try {
      const sessionId = req.user?.id;

      if (!sessionId) {
        return res
          .status(401)
          .send(
            "<h1>Please log in first</h1><p>Visit the dashboard and log in, then come back to this page.</p>"
          );
      }

      // Resolve session ID to actual UUID from database
      // Try direct lookup first, then by username if numeric session ID
      let user = await storage.getUser(String(sessionId));
      if (!user && req.user?.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      if (!user) {
        return res
          .status(500)
          .send(
            "<h1>User Not Found</h1><p>Could not find your user account in the database. Please contact support.</p>"
          );
      }

      const userId = user.id; // This is the actual UUID
      const baseUrl = process.env.BASE_URL || `https://${req.get("host")}`;
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const redirectUri = `${baseUrl}/api/social/callback/linkedin`;

      const state = Buffer.from(
        JSON.stringify({ userId, platform: "linkedin" })
      ).toString("base64");
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&state=${state}&scope=profile%20email%20w_member_social`;
    } catch (error) {
      console.error("LinkedIn test page error:", error);
      return res
        .status(500)
        .send(
          "<h1>Error</h1><p>Failed to generate OAuth URL. Check server logs.</p>"
        );
    }

    res.send(`
      <html>
        <head>
          <title>LinkedIn OAuth Test</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
            .box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .success { background: #d4edda; color: #155724; }
            .info { background: #d1ecf1; color: #0c5460; }
            code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
            a.button { display: inline-block; background: #0077b5; color: white; padding: 12px 24px;
                       text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: 600; }
            a.button:hover { background: #006097; }
          </style>
        </head>
        <body>
          <h1>🔗 LinkedIn OAuth Test</h1>

          <div class="box info">
            <h3>Configuration Status</h3>
            <p>✅ User ID: <code>${userId}</code></p>
            <p>✅ Client ID: ${clientId ? "Set" : "❌ Missing"}</p>
            <p>✅ Client Secret: ${
              process.env.LINKEDIN_CLIENT_SECRET ? "Set" : "❌ Missing"
            }</p>
            <p>✅ Redirect URI: <code>${redirectUri}</code></p>
          </div>

          <div class="box">
            <h3>Step 1: Verify LinkedIn App Settings</h3>
            <p>Make sure these redirect URIs are added in your LinkedIn Developer App:</p>
            <ul>
              <li><code>${redirectUri}</code></li>
              <li><code>${redirectUri}/</code> (with trailing slash)</li>
            </ul>
          </div>

          <div class="box success">
            <h3>Step 2: Connect LinkedIn</h3>
            <p>Click the button below to authorize this app with LinkedIn:</p>
            <a href="${authUrl}" class="button">🔗 Connect LinkedIn Account</a>
          </div>

          <div class="box">
            <h3>What Happens Next?</h3>
            <ol>
              <li>You'll be redirected to LinkedIn to authorize the app</li>
              <li>LinkedIn will redirect back to this app</li>
              <li>The app will save your access token</li>
              <li>You can then post to LinkedIn automatically!</li>
            </ol>
          </div>
        </body>
      </html>
    `);
  });

  // Social Media OAuth Routes
  app.post("/api/social/connect/:platform", requireAuth, async (req, res) => {
    try {
      const { platform } = req.params;

      console.log("\n🔐 OAuth Connect Request for", platform);
      console.log(
        "📋 Session user object:",
        JSON.stringify(
          {
            id: req.user?.id,
            username: req.user?.username,
            email: req.user?.email,
            role: req.user?.role,
          },
          null,
          2
        )
      );

      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // CRITICAL FIX: Resolve the authenticated user to their UUID
      let userId = String(req.user.id);
      console.log(
        `🔍 Looking up user by DB ID: "${userId}" and email: "${req.user.email}"`
      );

      // Try to find user by ID first
      let user = await storage.getUser(userId);
      console.log(
        `   → getUser(${userId}):`,
        user ? `✅ Found ${user.username}` : "❌ Not found"
      );

      // If not found by ID, try by email (critical for DB-authenticated users)
      if (!user && req.user.email) {
        console.log(`   → Trying to find by email: "${req.user.email}"`);
        user = await storage.getUserByEmail(req.user.email);
        console.log(
          `   → Email search:`,
          user ? `✅ Found ${user.id}` : "❌ Not found"
        );
      }

      // If not found by email, try by username as fallback
      if (!user && req.user.username) {
        console.log(`   → Trying getUserByUsername("${req.user.username}")`);
        user = await storage.getUserByUsername(req.user.username);
        console.log(
          `   → getUserByUsername:`,
          user ? `✅ Found ${user.id}` : "❌ Not found"
        );
      }

      // If user still not found, create them ONCE in MemStorage
      if (!user) {
        console.log(
          `   → User not in MemStorage, creating with auto-generated UUID...`
        );
        user = await storage.createUser({
          username:
            req.user.username ||
            req.user.email?.split("@")[0] ||
            `user_${userId}`,
          email: req.user.email || undefined,
          password: "", // Not needed for OAuth-only users
          name: req.user.email || `User ${userId}`,
          role: (req.user.type === "agent" ? "agent" : "public") as
            | "agent"
            | "public"
            | "team_lead",
        });
        console.log(
          `   ✅ Created user in MemStorage: ${user.id} (DB ID was: ${userId})`
        );
      } else {
        console.log(`   ✅ Reusing existing MemStorage user: ${user.id}`);
      }

      // Use the MemStorage UUID for all social account operations
      userId = user.id;
      console.log(
        `✅ OAuth connect for user: ${userId} (${user.email || user.username})`
      );

      // Read credentials from Replit Secrets (environment variables)
      const baseUrl =
        process.env.BASE_URL ||
        (process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "http://localhost:5000");

      // Create state parameter with userId for OAuth callback
      const state = Buffer.from(JSON.stringify({ userId, platform })).toString(
        "base64"
      );

      // Generate PKCE parameters for Twitter (required by Twitter OAuth 2.0)
      let twitterUrl: string | null = null;
      if (
        (platform === "twitter" || platform === "x") &&
        process.env.TWITTER_CLIENT_ID
      ) {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Store code verifier in database with state as key (expires in 10 minutes)
        await storePKCE(state, codeVerifier, 10 * 60 * 1000);

        twitterUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${
          process.env.TWITTER_CLIENT_ID
        }&redirect_uri=${encodeURIComponent(
          baseUrl + "/api/social/callback/twitter"
        )}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${encodeURIComponent(
          state
        )}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      }

      const facebookClientId =
        process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID;

      const oauthUrls: Record<string, string | null> = {
        facebook: facebookClientId
          ? `https://www.facebook.com/v18.0/dialog/oauth?client_id=${facebookClientId}&redirect_uri=${encodeURIComponent(
              baseUrl + "/api/social/callback/facebook"
            )}&scope=pages_manage_posts,pages_read_engagement&state=${encodeURIComponent(
              state
            )}`
          : null,
        instagram: process.env.INSTAGRAM_CLIENT_ID
          ? `https://api.instagram.com/oauth/authorize?client_id=${
              process.env.INSTAGRAM_CLIENT_ID
            }&redirect_uri=${encodeURIComponent(
              baseUrl + "/api/social/callback/instagram"
            )}&scope=user_profile,user_media&response_type=code&state=${encodeURIComponent(
              state
            )}`
          : null,
        linkedin: process.env.LINKEDIN_CLIENT_ID
          ? `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
              process.env.LINKEDIN_CLIENT_ID
            }&redirect_uri=${encodeURIComponent(
              baseUrl + "/api/social/callback/linkedin"
            )}&scope=openid%20profile%20email%20w_member_social&state=${encodeURIComponent(
              state
            )}`
          : null,
        twitter: twitterUrl,
        x: twitterUrl, // X (Twitter) uses same OAuth flow
        youtube: process.env.YOUTUBE_CLIENT_ID
          ? `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${
              process.env.YOUTUBE_CLIENT_ID
            }&redirect_uri=${encodeURIComponent(
              baseUrl + "/api/social/callback/youtube"
            )}&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.force-ssl&access_type=offline&state=${encodeURIComponent(
              state
            )}`
          : null,
      };

      const authUrl = oauthUrls[platform];

      if (!authUrl) {
        return res.status(400).json({
          error: `OAuth not configured for ${platform}`,
          message: `Please add ${platform.toUpperCase()}_CLIENT_ID to Replit Secrets to enable OAuth`,
        });
      }

      res.json({
        authUrl,
        message: "OAuth URL generated successfully",
      });
    } catch (error) {
      console.error("OAuth initiation error:", error);
      res.status(500).json({ error: "Failed to initiate OAuth flow" });
    }
  });

  // Disconnect social media account
  app.post(
    "/api/social/disconnect/:platform",
    requireAuth,
    async (req, res) => {
      try {
        const { platform } = req.params;

        if (!req.user?.id) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // CRITICAL: Resolve the authenticated user to their MemStorage UUID
        let userId = String(req.user.id);
        console.log(
          `🔌 Disconnecting ${platform} for JWT user ${userId} (${req.user.email})`
        );

        // Try to find user by ID first
        let user = await storage.getUser(userId);

        // If not found by ID, try by email (critical for DB-authenticated users)
        if (!user && req.user.email) {
          user = await storage.getUserByEmail(req.user.email);
        }

        // If not found by email, try by username as fallback
        if (!user && req.user.username) {
          user = await storage.getUserByUsername(req.user.username);
        }

        if (!user) {
          return res.status(404).json({
            error: "User not found",
            message:
              "Could not find user in storage. Please reconnect your account.",
          });
        }

        // Use the MemStorage UUID for the disconnect operation
        const resolvedUserId = user.id;
        console.log(`   → Resolved to MemStorage UUID: ${resolvedUserId}`);

        // Disconnect the account (marks isConnected=false and clears tokens)
        const disconnectedAccount = await storage.disconnectSocialMediaAccount(
          resolvedUserId,
          platform
        );

        if (!disconnectedAccount) {
          return res.status(404).json({
            error: "Account not found",
            message: `No ${platform} account found for this user`,
          });
        }

        console.log(`✅ ${platform} disconnected successfully`);

        res.json({
          success: true,
          message: `${platform} account disconnected successfully`,
          account: {
            id: disconnectedAccount.id,
            platform: disconnectedAccount.platform,
            isConnected: disconnectedAccount.isConnected,
          },
        });
      } catch (error) {
        console.error("Disconnect error:", error);
        res.status(500).json({ error: "Failed to disconnect account" });
      }
    }
  );

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

  // OAuth callback handlers are now unified under /api/social/callback/:platform

  app.get("/api/social/callback/:platform", async (req, res) => {
    try {
      const { platform } = req.params;
      const { code, error, state } = req.query;

      const rawState =
        typeof state === "string"
          ? state
          : Array.isArray(state)
          ? state[0]
          : undefined;
      const decodedStateString = rawState
        ? decodeURIComponent(rawState)
        : undefined;

      // Use production URL for Replit deployments
      const baseUrl =
        process.env.BASE_URL ||
        (process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "http://localhost:5000");

      if (error) {
        return res.redirect(`${baseUrl}/?oauth_error=${error}`);
      }

      if (!code) {
        return res.redirect(`${baseUrl}/?oauth_error=no_code`);
      }

      // Extract userId from state parameter
      let userId: number | null = null;
      if (decodedStateString) {
        try {
          const decodedState = JSON.parse(
            Buffer.from(decodedStateString, "base64").toString()
          );
          userId = decodedState.userId;

          console.log(
            `OAuth callback for ${platform}: extracted userId ${userId} from state parameter`
          );
        } catch (e) {
          console.error("Failed to decode state parameter:", e);
        }
      }

      if (!userId) {
        console.error("OAuth callback: no userId found in state parameter");
        return res.redirect(`${baseUrl}/?oauth_error=invalid_state`);
      }

      // Exchange authorization code for access token
      if (platform.toLowerCase() === "linkedin") {
        const clientId = process.env.LINKEDIN_CLIENT_ID;
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
        const redirectUri = `${baseUrl}/api/social/callback/linkedin`;

        if (!clientId || !clientSecret) {
          return res.redirect(`${baseUrl}/?oauth_error=missing_credentials`);
        }

        try {
          // Exchange code for access token
          const tokenResponse = await fetch(
            "https://www.linkedin.com/oauth/v2/accessToken",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code as string,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret,
              }),
            }
          );

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("LinkedIn token exchange failed:", errorData);
            return res.redirect(
              `${baseUrl}/?oauth_error=token_exchange_failed`
            );
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;

          // Get user from database using userId from state parameter
          const user = await storage.getUser(String(userId));
          if (!user) {
            return res.redirect(`${baseUrl}/?oauth_error=user_not_found`);
          }

          // Save access token to database
          const existingAccounts = await storage.getSocialMediaAccounts(
            user.id
          );
          const linkedinAccount = existingAccounts.find(
            (acc) => acc.platform.toLowerCase() === "linkedin"
          );

          if (linkedinAccount) {
            // Update existing account
            await storage.updateSocialMediaAccount(linkedinAccount.id, {
              accessToken,
              isConnected: true,
              lastSync: new Date(),
            });
          } else {
            // Create new account
            await storage.createSocialMediaAccount({
              userId: user.id,
              platform: "linkedin",
              accountId: "linkedin_account",
              accessToken,
              isConnected: true,
            });
          }

          // Success! Show confirmation and close window
          res.send(`
            <html>
              <body>
                <h1>✅ LinkedIn Connected Successfully!</h1>
                <p>Your LinkedIn account has been connected. You can now post content to LinkedIn.</p>
                <script>
                  window.opener?.postMessage({ success: true, platform: 'linkedin' }, '*');
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);
        } catch (fetchError) {
          console.error("LinkedIn OAuth error:", fetchError);
          return res.redirect(`${baseUrl}/?oauth_error=token_exchange_error`);
        }
      } else if (platform.toLowerCase() === "facebook") {
        const clientId =
          process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID;
        const clientSecret =
          process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
        const redirectUri = `${baseUrl}/api/social/callback/facebook`;

        if (!clientId || !clientSecret) {
          return res.send(`
            <html>
              <body>
                <h1>Facebook OAuth Not Configured</h1>
                <p>You must set <code>FACEBOOK_CLIENT_ID</code> (or <code>FACEBOOK_APP_ID</code>) and <code>FACEBOOK_CLIENT_SECRET</code> (or <code>FACEBOOK_APP_SECRET</code>) in your environment.</p>
                <p>Add these to Replit Secrets and re-run the connect flow.</p>
                <script>
                  window.opener?.postMessage({ success: false, platform: 'facebook', error: 'missing_credentials' }, '*');
                  setTimeout(() => window.close(), 4000);
                </script>
              </body>
            </html>
          `);
        }

        try {
          const tokenParams = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            client_secret: clientSecret,
            code: code as string,
          });

          const tokenResponse = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams.toString()}`
          );

          if (!tokenResponse.ok) {
            const errorPayload = await tokenResponse.text();
            console.error("Facebook token exchange failed:", errorPayload);
            return res.send(`
              <html>
                <body>
                  <h1>❌ Facebook Connection Failed</h1>
                  <p>Facebook token exchange failed. Check your app settings and try again.</p>
                  <script>
                    window.opener?.postMessage({ success: false, platform: 'facebook', error: 'token_exchange_failed' }, '*');
                    setTimeout(() => window.close(), 4000);
                  </script>
                </body>
              </html>
            `);
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token as string;
          const expiresIn = tokenData.expires_in as number | undefined;

          if (!accessToken) {
            throw new Error("Facebook token response missing access_token");
          }

          const user = await storage.getUser(String(userId));
          if (!user) {
            return res.send(`
              <html>
                <body>
                  <h1>User Not Found</h1>
                  <p>We could not locate your session user. Please restart the connection flow.</p>
                  <script>
                    window.opener?.postMessage({ success: false, platform: 'facebook', error: 'user_not_found' }, '*');
                    setTimeout(() => window.close(), 4000);
                  </script>
                </body>
              </html>
            `);
          }

          let profile: any = null;
          try {
            const profileResp = await fetch(
              `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${accessToken}`
            );
            if (profileResp.ok) {
              profile = await profileResp.json();
            }
          } catch (profileError) {
            console.warn("Facebook profile lookup failed:", profileError);
          }

          const existingAccounts = await storage.getSocialMediaAccounts(
            user.id
          );
          console.log(
            `🔍 Facebook OAuth - Found ${existingAccounts.length} existing accounts for user ${user.id}`
          );
          console.log(
            `   → Platforms: ${existingAccounts
              .map((a) => `${a.platform}(${a.isConnected})`)
              .join(", ")}`
          );

          const facebookAccount = existingAccounts.find(
            (acc) => acc.platform.toLowerCase() === "facebook"
          );

          const metadata = {
            ...(facebookAccount?.metadata as any),
            profileId: profile?.id || null,
            profileName: profile?.name || null,
            profileEmail: profile?.email || null,
            tokenType: tokenData.token_type || "bearer",
            expiresIn: expiresIn || null,
          };

          if (facebookAccount) {
            console.log(
              `🔄 Updating existing Facebook account ${facebookAccount.id} (was: ${facebookAccount.isConnected})`
            );
            await storage.updateSocialMediaAccount(facebookAccount.id, {
              accessToken,
              metadata,
              isConnected: true,
              lastSync: new Date(),
            });
            console.log(`✅ Facebook account updated successfully`);
          } else {
            console.log(`➕ Creating new Facebook account for user ${user.id}`);
            const newAccount = await storage.createSocialMediaAccount({
              userId: user.id,
              platform: "facebook",
              accountId: profile?.id || "facebook_account",
              accessToken,
              metadata,
              isConnected: true,
            });
            console.log(`✅ Facebook account created: ${newAccount.id}`);
          }

          return res.send(`
            <html>
              <body>
                <h1>✅ Facebook Connected Successfully!</h1>
                <p>Your Facebook account has been connected. You can now post to your pages using the quick-test cards.</p>
                <script>
                  window.opener?.postMessage({ success: true, platform: 'facebook' }, '*');
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);
        } catch (fbError) {
          console.error("Facebook OAuth error:", fbError);
          return res.send(`
            <html>
              <body>
                <h1>Facebook OAuth Error</h1>
                <p>${(fbError as Error).message}</p>
                <script>
                  window.opener?.postMessage({ success: false, platform: 'facebook', error: 'oauth_error' }, '*');
                  setTimeout(() => window.close(), 4000);
                </script>
              </body>
            </html>
          `);
        }
      } else if (platform.toLowerCase() === "youtube") {
        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
        const redirectUri = `${baseUrl}/api/social/callback/youtube`;

        if (!clientId || !clientSecret) {
          return res.redirect(`${baseUrl}/?oauth_error=missing_credentials`);
        }

        try {
          // Exchange code for access token using Google OAuth
          const tokenResponse = await fetch(
            "https://oauth2.googleapis.com/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code as string,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret,
              }),
            }
          );

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("YouTube token exchange failed:", errorData);
            return res.redirect(
              `${baseUrl}/?oauth_error=token_exchange_failed`
            );
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          const refreshToken = tokenData.refresh_token; // YouTube provides refresh tokens
          console.log("🎥 YouTube OAuth token exchange successful", {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
          });

          // Get user from database using userId from state parameter
          const user = await storage.getUser(String(userId));
          if (!user) {
            return res.redirect(`${baseUrl}/?oauth_error=user_not_found`);
          }

          console.log("🎥 YouTube OAuth callback for user:", {
            userId: user.id,
            email: user.email,
            username: user.username,
          });

          // Save access token and refresh token to database
          const existingAccounts = await storage.getSocialMediaAccounts(
            user.id
          );
          console.log(
            "   Existing social accounts:",
            existingAccounts.map((a) => ({
              id: a.id,
              platform: a.platform,
              hasAccessToken: !!a.accessToken,
              hasRefreshToken: !!(a as any).refreshToken,
            }))
          );
          const youtubeAccount = existingAccounts.find(
            (acc) => acc.platform.toLowerCase() === "youtube"
          );

          if (youtubeAccount) {
            // Update existing account
            await storage.updateSocialMediaAccount(youtubeAccount.id, {
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
              lastSync: new Date(),
            });
            console.log(
              `🔄 Updated existing YouTube account ${youtubeAccount.id} for user ${user.id}`
            );
          } else {
            // Create new account
            await storage.createSocialMediaAccount({
              userId: user.id,
              platform: "youtube",
              accountId: "youtube_account",
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
            });
            console.log(
              `➕ Created new YouTube account for user ${user.id} with platform 'youtube'`
            );
          }

          console.log("✅ YouTube tokens stored", {
            accessTokenLength: accessToken ? String(accessToken).length : 0,
            refreshTokenLength: refreshToken ? String(refreshToken).length : 0,
          });

          // Success! Show confirmation and close window
          res.send(`
            <html>
              <body>
                <h1>✅ YouTube Connected Successfully!</h1>
                <p>Your YouTube channel has been connected. You can now post videos and community posts.</p>
                <script>
                  window.opener?.postMessage({ success: true, platform: 'youtube' }, '*');
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);
        } catch (fetchError) {
          console.error("YouTube OAuth error:", fetchError);
          return res.redirect(`${baseUrl}/?oauth_error=token_exchange_error`);
        }
      } else if (
        platform.toLowerCase() === "twitter" ||
        platform.toLowerCase() === "x"
      ) {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        const redirectUri = `${baseUrl}/api/social/callback/twitter`;

        if (!clientId || !clientSecret) {
          return res.redirect(`${baseUrl}/?oauth_error=missing_credentials`);
        }

        // Retrieve code verifier from database using state parameter
        const pkceData = decodedStateString
          ? await retrievePKCE(decodedStateString)
          : null;
        if (!pkceData) {
          console.error(
            "Twitter OAuth: PKCE code verifier not found for state:",
            state
          );
          return res.redirect(
            `${baseUrl}/?oauth_error=pkce_verifier_not_found`
          );
        }

        // Check if PKCE data has expired
        if (pkceData.expiresAt.getTime() < Date.now()) {
          console.error("Twitter OAuth: PKCE code verifier expired");
          return res.redirect(`${baseUrl}/?oauth_error=pkce_verifier_expired`);
        }

        // Code verifier retrieved and automatically cleaned up
        const codeVerifier = pkceData.codeVerifier;

        try {
          // Exchange code for access token using Twitter OAuth 2.0
          const tokenResponse = await fetch(
            "https://api.twitter.com/2/oauth2/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(
                  `${clientId}:${clientSecret}`
                ).toString("base64")}`,
              },
              body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code as string,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
              }),
            }
          );

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("Twitter token exchange failed:", errorData);
            return res.redirect(
              `${baseUrl}/?oauth_error=token_exchange_failed`
            );
          }

          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          const refreshToken = tokenData.refresh_token;

          console.log(
            `✅ Twitter token exchange successful for user ${userId}`
          );
          console.log(
            "   Access token (debug only, rotate after testing):",
            accessToken || "MISSING"
          );

          // Get user from database using userId from state parameter
          const user = await storage.getUser(String(userId));
          if (!user) {
            console.error(`❌ User not found: ${userId}`);
            return res.redirect(`${baseUrl}/?oauth_error=user_not_found`);
          }

          console.log(`✅ Found user: ${user.id} (${user.email})`);

          // Save access token and refresh token to database
          const existingAccounts = await storage.getSocialMediaAccounts(
            user.id
          );
          console.log(
            `📊 Existing social accounts for user ${user.id}:`,
            existingAccounts.map((a) => a.platform)
          );

          const twitterAccount = existingAccounts.find(
            (acc) =>
              acc.platform.toLowerCase() === "twitter" ||
              acc.platform.toLowerCase() === "x"
          );

          if (twitterAccount) {
            // Update existing account
            console.log(
              `🔄 Updating existing Twitter account: ${twitterAccount.id}`
            );
            await storage.updateSocialMediaAccount(twitterAccount.id, {
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
              lastSync: new Date(),
            });
            console.log(`✅ Twitter account updated successfully`);
          } else {
            // Create new account
            console.log(`➕ Creating new Twitter account for user ${user.id}`);
            const newAccount = await storage.createSocialMediaAccount({
              userId: user.id,
              platform: "x",
              accountId: "x_account",
              accessToken,
              refreshToken: refreshToken || undefined,
              isConnected: true,
            });
            console.log(`✅ Twitter account created successfully:`, newAccount);
          }

          // Success! Show confirmation and close window
          res.send(`
            <html>
              <body>
                <h1>✅ Twitter/X Connected Successfully!</h1>
                <p>Your Twitter/X account has been connected. You can now post tweets directly.</p>
                <script>
                  window.opener?.postMessage({ success: true, platform: 'x' }, '*');
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);
        } catch (fetchError) {
          console.error("Twitter OAuth error:", fetchError);
          return res.redirect(`${baseUrl}/?oauth_error=token_exchange_error`);
        }
      } else {
        // Other platforms - show placeholder message
        res.send(`
          <html>
            <body>
              <h1>${platform} OAuth Callback</h1>
              <p>OAuth setup for ${platform} requires additional configuration.</p>
              <p>Please add ${platform.toUpperCase()}_CLIENT_ID and ${platform.toUpperCase()}_CLIENT_SECRET to Replit Secrets.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send("OAuth callback failed");
    }
  });

  // Social media endpoints
  app.get("/api/social/accounts", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Resolve DB user ID to MemStorage UUID (same logic as connect endpoint)
      let userId = String(req.user.id);
      let user = await storage.getUser(userId);

      // If not found by ID, try by email
      if (!user && req.user.email) {
        user = await storage.getUserByEmail(req.user.email);
      }

      // If not found by email, try by username
      if (!user && req.user.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      // Get social media accounts (empty if user not found)
      const socialAccounts = user
        ? await storage.getSocialMediaAccounts(user.id)
        : [];

      // Create a map of platforms to their account data
      const accountMap = new Map(
        socialAccounts.map((acc) => [acc.platform.toLowerCase(), acc])
      );

      // Also handle twitter/x alias
      if (accountMap.has("twitter")) {
        accountMap.set("x", accountMap.get("twitter")!);
      }
      if (accountMap.has("x") && !accountMap.has("twitter")) {
        accountMap.set("twitter", accountMap.get("x")!);
      }

      // Return all platforms with their actual connection status and data
      // Order: Working platforms first (Facebook, X, YouTube, LinkedIn), then non-working (Instagram, TikTok)
      const platforms = [
        {
          id: accountMap.get("facebook")?.id || nanoid(),
          platform: "facebook",
          isConnected: accountMap.get("facebook")?.isConnected || false,
          lastSync: accountMap.get("facebook")?.lastSync || null,
        },
        {
          id: accountMap.get("x")?.id || nanoid(),
          platform: "x",
          isConnected: accountMap.get("x")?.isConnected || false,
          lastSync: accountMap.get("x")?.lastSync || null,
        },
        {
          id: accountMap.get("youtube")?.id || nanoid(),
          platform: "youtube",
          isConnected: accountMap.get("youtube")?.isConnected || false,
          lastSync: accountMap.get("youtube")?.lastSync || null,
        },
        {
          id: accountMap.get("linkedin")?.id || nanoid(),
          platform: "linkedin",
          isConnected: accountMap.get("linkedin")?.isConnected || false,
          lastSync: accountMap.get("linkedin")?.lastSync || null,
        },
        {
          id: accountMap.get("instagram")?.id || nanoid(),
          platform: "instagram",
          isConnected: accountMap.get("instagram")?.isConnected || false,
          lastSync: accountMap.get("instagram")?.lastSync || null,
        },
        {
          id: accountMap.get("tiktok")?.id || nanoid(),
          platform: "tiktok",
          isConnected: accountMap.get("tiktok")?.isConnected || false,
          lastSync: accountMap.get("tiktok")?.lastSync || null,
        },
      ];

      res.json(platforms);
    } catch (error) {
      console.error("Get social accounts error:", error);
      res.status(500).json({ error: "Failed to fetch social media accounts" });
    }
  });

  // Create or update a social media account
  app.post("/api/social/accounts", requireAuth, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        platform,
        isConnected,
        accessToken,
        refreshToken,
        providerId,
        accountId,
      } = req.body;

      if (!platform) {
        return res.status(400).json({ error: "Platform is required" });
      }

      // accountId is required for database - use providerId or generate a test ID
      const finalAccountId =
        accountId || providerId || `test_${platform}_${Date.now()}`;

      // Resolve DB user ID to MemStorage UUID
      let userId = String(req.user.id);
      let user = await storage.getUser(userId);

      if (!user && req.user.email) {
        user = await storage.getUserByEmail(req.user.email);
      }

      if (!user && req.user.username) {
        user = await storage.getUserByUsername(req.user.username);
      }

      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "Could not find user in storage",
        });
      }

      // Check if account already exists
      const existingAccounts = await storage.getSocialMediaAccounts(user.id);
      const existingAccount = existingAccounts.find(
        (acc) => acc.platform.toLowerCase() === platform.toLowerCase()
      );

      let account;
      if (existingAccount) {
        // Update existing account
        account = await storage.updateSocialMediaAccount(existingAccount.id, {
          isConnected: isConnected ?? true,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          lastSync: isConnected ? new Date() : null,
        });
      } else {
        // Create new account
        account = await storage.createSocialMediaAccount({
          userId: user.id,
          platform: platform.toLowerCase(),
          accountId: finalAccountId, // Required field in database
          isConnected: isConnected ?? true,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
        });
      }

      console.log(
        `✅ Social account ${
          existingAccount ? "updated" : "created"
        } for ${platform}`
      );

      res.json({
        success: true,
        account,
        message: `${platform} account ${
          existingAccount ? "updated" : "created"
        } successfully`,
      });
    } catch (error) {
      console.error("Create/update social account error:", error);
      res.status(500).json({ error: "Failed to create/update social account" });
    }
  });

  // Platform character limits
  const PLATFORM_CHARACTER_LIMITS: Record<string, number> = {
    x: 280,
    twitter: 280,
    facebook: 63206,
    linkedin: 3000,
    instagram: 2200,
    youtube: 5000,
    tiktok: 2200,
  };

  // Validate character limits for a given platform
  const validateCharacterLimit = (
    content: string,
    platform: string
  ): { valid: boolean; message?: string } => {
    const limit = PLATFORM_CHARACTER_LIMITS[platform.toLowerCase()] || 5000;
    if (content.length > limit) {
      return {
        valid: false,
        message: `Post exceeds ${platform} character limit (${limit} chars). Current length: ${content.length}`,
      };
    }
    return { valid: true };
  };

  app.post(
    "/api/social/post",
    requireAuth,
    upload.single("photo"),
    async (req, res) => {
      try {
        const {
          platform,
          content,
          platforms,
          scheduledFor,
          text,
          mediaType,
          mediaId,
        } = req.body;
        const photo = req.file;

        // Support both 'content' and 'text' for post content
        const postContent = text || content;

        // Fetch media URLs if mediaType and mediaId are provided
        let mediaUrls = {
          photoUrls: [] as string[],
          videoUrls: [] as string[],
        };

        // Get logged-in user from session (needed for media fetch and posting)
        const sessionId = req.user?.id;
        if (!sessionId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Resolve DB user ID to MemStorage UUID
        let userId = String(sessionId);
        let user = await storage.getUser(userId);

        // If not found by ID, try by email (CRITICAL for DB-authenticated users)
        if (!user && req.user?.email) {
          user = await storage.getUserByEmail(req.user.email);
        }

        // If not found by email, try by username
        if (!user && req.user?.username) {
          user = await storage.getUserByUsername(req.user.username);
        }

        if (!user) {
          return res.status(404).json({
            error:
              "User not found in storage. Please reconnect your social accounts.",
          });
        }

        // Fetch media URLs from database if media attachment is specified
        if (mediaType && mediaId) {
          if (mediaType === "avatar") {
            const avatar = await storage.getAvatarById(mediaId);
            if (avatar && avatar.videoUrl) {
              mediaUrls.videoUrls.push(avatar.videoUrl);
            } else if (avatar && avatar.photoUrl) {
              mediaUrls.photoUrls.push(avatar.photoUrl);
            }
          } else if (mediaType === "video") {
            const video = await storage.getVideoById(mediaId);
            if (video && video.videoUrl) {
              mediaUrls.videoUrls.push(video.videoUrl);
            } else if (video && video.thumbnailUrl) {
              mediaUrls.photoUrls.push(video.thumbnailUrl);
            }
          }
        }

        if (platform) {
          // Single platform posting (existing functionality)
          if (!postContent) {
            return res.status(400).json({ error: "Content is required" });
          }

          // Validate character limit
          const validationResult = validateCharacterLimit(
            postContent,
            platform
          );
          if (!validationResult.valid) {
            return res.status(400).json({ error: validationResult.message });
          }

          // Get user's social accounts to check if platform is connected
          const socialAccounts = await storage.getSocialMediaAccounts(user.id);
          console.log(
            `Found ${socialAccounts.length} social accounts for user ${user.id}`
          );
          console.log(
            "Social accounts:",
            socialAccounts.map((a) => ({
              platform: a.platform,
              hasToken: !!a.accessToken,
            }))
          );

          const connectedAccount = socialAccounts.find(
            (account) =>
              account.platform.toLowerCase() === platform.toLowerCase()
          );

          console.log(
            `Looking for ${platform} account:`,
            connectedAccount
              ? `Found (hasToken: ${!!connectedAccount.accessToken})`
              : "Not found"
          );

          // Check if account is connected (except YouTube which uses mock token)
          if (platform.toLowerCase() !== "youtube") {
            if (!connectedAccount) {
              return res.status(401).json({
                error: `${platform} account not connected. Please connect your ${platform} account first.`,
                action: "connect_account",
                platform: platform.toLowerCase(),
              });
            }

            if (
              !connectedAccount.accessToken ||
              connectedAccount.accessToken.trim() === ""
            ) {
              return res.status(401).json({
                error: `${platform} account token is missing or expired. Please reconnect your ${platform} account.`,
                action: "reconnect_account",
                platform: platform.toLowerCase(),
              });
            }
          }

          // Get photo URL if uploaded
          let photoUrl = null;
          if (photo) {
            photoUrl = `/uploads/${path.basename(photo.path)}`;
          }

          // Actually post to the platform
          let postResult;
          try {
            // Prepare media options from uploaded photo or fetched media
            const mediaOptions = {
              photoUrls: photoUrl
                ? [photoUrl, ...mediaUrls.photoUrls]
                : mediaUrls.photoUrls,
              videoUrls: mediaUrls.videoUrls,
            };

            if (platform.toLowerCase() === "facebook") {
              return res.status(400).json({
                error:
                  "Direct Facebook profile posting is not supported. Please use the Facebook Pages feature instead.",
              });
            } else if (platform.toLowerCase() === "instagram") {
              postResult = await socialMediaService.postToInstagram(
                postContent,
                photoUrl || mediaUrls.photoUrls[0] || "",
                connectedAccount?.accessToken || "",
                undefined,
                mediaOptions
              );
            } else if (platform.toLowerCase() === "linkedin") {
              postResult = await socialMediaService.postToLinkedIn(
                postContent,
                connectedAccount?.accessToken || "",
                mediaOptions
              );
            } else if (platform.toLowerCase() === "x") {
              postResult = await socialMediaService.postToTwitter(
                user.id,
                postContent,
                mediaUrls.photoUrls[0],
                mediaOptions
              );
            } else if (platform.toLowerCase() === "youtube") {
              // For YouTube, we need title and description
              const title =
                req.body.title || postContent.substring(0, 100) + "...";
              const description = req.body.description || postContent;
              // Use mock token if no connected account
              const youtubeToken =
                connectedAccount?.accessToken || "mock_youtube_token";
              postResult = await socialMediaService.postToYoutube(
                title,
                description,
                photoUrl || mediaUrls.videoUrls[0] || undefined,
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
            content: postContent,
            scheduledFor: new Date(), // Posted immediately
            status: "posted",
            postType: "manual_post",
            hashtags: postContent.match(/#\w+/g) || [],
            isEdited: false,
            originalContent: postContent,
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
        } else if (
          platforms &&
          Array.isArray(platforms) &&
          platforms.length > 0
        ) {
          // Multi-platform posting
          if (!postContent) {
            return res.status(400).json({ error: "Content is required" });
          }

          // Validate character limits for all selected platforms
          const invalidPlatforms = platforms.filter(
            (p) => !validateCharacterLimit(postContent, p).valid
          );
          if (invalidPlatforms.length > 0) {
            const validationMessages = invalidPlatforms.map((p) => {
              const result = validateCharacterLimit(postContent, p);
              return `${p}: ${result.message}`;
            });
            return res.status(400).json({
              error: "Post exceeds character limit for some platforms",
              details: validationMessages,
            });
          }

          const socialAccounts = await storage.getSocialMediaAccounts(user.id);
          const results: any[] = [];
          const errors: any[] = [];

          // Post to each platform
          for (const targetPlatform of platforms) {
            try {
              const connectedAccount = socialAccounts.find(
                (account) =>
                  account.platform.toLowerCase() ===
                  targetPlatform.toLowerCase()
              );

              // Check if account is connected (except YouTube which uses mock)
              if (targetPlatform.toLowerCase() !== "youtube") {
                if (!connectedAccount || !connectedAccount.accessToken) {
                  errors.push({
                    platform: targetPlatform,
                    error: `${targetPlatform} account not connected`,
                  });
                  continue;
                }
              }

              // Prepare media options
              const mediaOptions = {
                photoUrls: mediaUrls.photoUrls,
                videoUrls: mediaUrls.videoUrls,
              };

              let postResult;

              if (targetPlatform.toLowerCase() === "facebook") {
                errors.push({
                  platform: targetPlatform,
                  error: "Direct Facebook profile posting not supported",
                });
                continue;
              } else if (targetPlatform.toLowerCase() === "instagram") {
                postResult = await socialMediaService.postToInstagram(
                  postContent,
                  mediaUrls.photoUrls[0] || "",
                  connectedAccount?.accessToken || "",
                  undefined,
                  mediaOptions
                );
              } else if (targetPlatform.toLowerCase() === "linkedin") {
                postResult = await socialMediaService.postToLinkedIn(
                  postContent,
                  connectedAccount?.accessToken || "",
                  mediaOptions
                );
              } else if (targetPlatform.toLowerCase() === "x") {
                postResult = await socialMediaService.postToTwitter(
                  user.id,
                  postContent,
                  mediaUrls.photoUrls[0],
                  mediaOptions
                );
              } else if (targetPlatform.toLowerCase() === "youtube") {
                const title = req.body.title || postContent.substring(0, 100);
                const description = req.body.description || postContent;
                const youtubeToken =
                  connectedAccount?.accessToken || "mock_youtube_token";
                postResult = await socialMediaService.postToYoutube(
                  title,
                  description,
                  mediaUrls.videoUrls[0],
                  youtubeToken
                );
              } else {
                errors.push({
                  platform: targetPlatform,
                  error: `Unsupported platform: ${targetPlatform}`,
                });
                continue;
              }

              // Create record of successful post
              await storage.createScheduledPost({
                userId: user.id,
                platform: targetPlatform.toLowerCase(),
                content: postContent,
                scheduledFor: new Date(),
                status: "posted",
                postType: "manual_post",
                hashtags: postContent.match(/#\w+/g) || [],
                isEdited: false,
                originalContent: postContent,
                neighborhood: null,
              });

              results.push({
                platform: targetPlatform,
                success: true,
                postId: postResult.postId,
              });
            } catch (platformError) {
              console.error(
                `Error posting to ${targetPlatform}:`,
                platformError
              );
              errors.push({
                platform: targetPlatform,
                error:
                  platformError instanceof Error
                    ? platformError.message
                    : "Unknown error",
              });
            }
          }

          res.json({
            success: results.length > 0,
            message: `Posted to ${results.length} of ${platforms.length} platforms`,
            results,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString(),
          });
        } else {
          return res.status(400).json({
            error: "Either platform or platforms array is required",
          });
        }
      } catch (error) {
        console.error("Social post error:", error);
        res.status(500).json({ error: "Failed to post to social media" });
      }
    }
  );

  const PLATFORM_BASE_WEIGHTS: Record<string, number> = {
    instagram: 66,
    tiktok: 70,
    facebook: 58,
    youtube: 62,
    linkedin: 52,
    x: 48,
  };

  const PLATFORM_DURATION_GUIDELINES: Record<
    string,
    { min: number; max: number; penalty: number }
  > = {
    instagram: { min: 15, max: 90, penalty: 0.35 },
    tiktok: { min: 15, max: 60, penalty: 0.45 },
    facebook: { min: 30, max: 120, penalty: 0.25 },
    youtube: { min: 60, max: 480, penalty: 0.12 },
    linkedin: { min: 30, max: 90, penalty: 0.3 },
    x: { min: 15, max: 75, penalty: 0.4 },
  };

  const PLATFORM_NOTES: Record<string, string> = {
    instagram: "Reels favor tight 30-60s clips with quick hooks.",
    tiktok: "Trendy audio + punchy captions drive the best lift here.",
    facebook: "Great for neighborhood updates and listing walk-throughs.",
    youtube: "Leverage longer watch time and playlist placement.",
    linkedin: "Focus on professional takeaways or market education.",
    x: "Lead with the headline and pin follow-up threads for depth.",
  };

  const DEFAULT_SCORE_PLATFORMS = [
    "instagram",
    "tiktok",
    "facebook",
    "youtube",
    "linkedin",
    "x",
  ];

  const normalizeNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const inferDurationFromMetadata = (video: any): number | undefined => {
    if (!video) return undefined;
    const direct = normalizeNumber(video?.duration);
    if (direct) return direct;

    const metadata =
      video?.metadata && typeof video.metadata === "object"
        ? video.metadata
        : undefined;
    if (metadata) {
      const mdDuration = normalizeNumber(
        (metadata as any).duration || (metadata as any).videoDuration
      );
      if (mdDuration) return mdDuration;

      const scriptWordCount = normalizeNumber(
        (metadata as any).scriptWordCount
      );
      if (scriptWordCount) {
        return Math.round(scriptWordCount / 2.5);
      }
    }

    if (typeof video?.script === "string" && video.script.trim().length) {
      const estimatedWords = video.script.trim().split(/\s+/).length;
      return Math.round(estimatedWords / 2.5);
    }

    return undefined;
  };

  const clampScore = (value: number, min = 30, max = 100) =>
    Math.max(min, Math.min(max, value));

  const getDurationFitScore = (platform: string, duration: number) => {
    if (!duration) return 12;
    const guide = PLATFORM_DURATION_GUIDELINES[platform];
    if (!guide) return 12;
    if (duration >= guide.min && duration <= guide.max) {
      return 25;
    }
    const delta =
      duration < guide.min ? guide.min - duration : duration - guide.max;
    return Math.max(6, 25 - delta * guide.penalty);
  };

  const getPastPerformanceScore = (
    platform: string,
    stats: Record<string, { posted: number; avgSeo: number }>
  ) => {
    const entry = stats[platform];
    if (!entry) return 8;
    const volumeScore = Math.min(15, entry.posted * 3);
    const seoScore = entry.avgSeo ? Math.min(10, entry.avgSeo / 10) : 0;
    return volumeScore + seoScore;
  };

  const buildReasons = (
    platform: string,
    durationFit: number,
    pastPerformance: number,
    isConnected: boolean
  ): string[] => {
    const reasons: string[] = [];

    if (durationFit >= 20) {
      reasons.push("Clip length sits in this platform's sweet spot.");
    } else if (durationFit <= 8) {
      reasons.push("Consider trimming the clip before posting here.");
    }

    if (pastPerformance >= 15) {
      reasons.push("Recent posts have performed well on this channel.");
    } else if (pastPerformance <= 6) {
      reasons.push("Limited history — great place to experiment.");
    }

    if (!isConnected) {
      reasons.push("Connect this account to publish directly from RealtyFlow.");
    }

    if (PLATFORM_NOTES[platform]) {
      reasons.push(PLATFORM_NOTES[platform]);
    }

    return reasons;
  };

  app.get("/api/social/platform-scores", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const rawVideoId = Array.isArray(req.query.videoId)
        ? req.query.videoId[0]
        : (req.query.videoId as string | undefined);
      const rawHeygenId = Array.isArray(req.query.heygenVideoId)
        ? req.query.heygenVideoId[0]
        : (req.query.heygenVideoId as string | undefined);

      let videoRecord = null;
      if (rawVideoId) {
        videoRecord = await storage.getVideoByIdAndUser(
          rawVideoId,
          String(userId)
        );
      }
      if (!videoRecord && rawHeygenId) {
        videoRecord = await storage.getVideoByHeygenVideoId(
          String(userId),
          rawHeygenId
        );
      }

      const [socialAccounts, scheduledPosts] = await Promise.all([
        storage.getSocialMediaAccounts(String(userId)),
        storage.getScheduledPosts(String(userId)),
      ]);

      const connectedAccounts = socialAccounts.filter(
        (account) => account.isConnected
      );
      const connectionMap = new Map<string, boolean>();
      connectedAccounts.forEach((account) => {
        connectionMap.set(account.platform.toLowerCase(), true);
      });

      const targetPlatforms = connectedAccounts.length
        ? connectedAccounts.map((account) => account.platform.toLowerCase())
        : DEFAULT_SCORE_PLATFORMS;
      const uniqueTargets = Array.from(new Set(targetPlatforms));

      const rawDuration =
        videoRecord?.duration ?? inferDurationFromMetadata(videoRecord);
      const resolvedDuration = rawDuration ?? 60;
      const durationSource = rawDuration == null ? "estimated" : "exact";

      const performanceAggregate = scheduledPosts.reduce<
        Record<string, { posted: number; totalSeo: number; seoSamples: number }>
      >((acc, post) => {
        const key = (post.platform || "").toLowerCase();
        if (!key) return acc;
        if (!acc[key]) {
          acc[key] = { posted: 0, totalSeo: 0, seoSamples: 0 };
        }
        if (post.status === "posted") {
          acc[key].posted += 1;
          if (
            typeof post.seoScore === "number" &&
            Number.isFinite(post.seoScore)
          ) {
            acc[key].totalSeo += post.seoScore;
            acc[key].seoSamples += 1;
          }
        }
        return acc;
      }, {});

      const performanceStats = Object.fromEntries(
        Object.entries(performanceAggregate).map(([platform, stats]) => [
          platform,
          {
            posted: stats.posted,
            avgSeo:
              stats.seoSamples > 0 ? stats.totalSeo / stats.seoSamples : 0,
          },
        ])
      );

      const platformScores = uniqueTargets
        .map((platform) => {
          const normalizedPlatform = platform.toLowerCase();
          const base = PLATFORM_BASE_WEIGHTS[normalizedPlatform] ?? 52;
          const durationFit = getDurationFitScore(
            normalizedPlatform,
            resolvedDuration
          );
          const pastPerformance = getPastPerformanceScore(
            normalizedPlatform,
            performanceStats
          );
          const isConnected = connectionMap.has(normalizedPlatform);
          const score = clampScore(base + durationFit + pastPerformance);

          const reasons = buildReasons(
            normalizedPlatform,
            durationFit,
            pastPerformance,
            isConnected
          );

          return {
            platform: normalizedPlatform,
            score,
            tier: score >= 80 ? "strong" : score >= 60 ? "good" : "emerging",
            recommendation:
              PLATFORM_NOTES[normalizedPlatform] ||
              (durationFit >= 20
                ? "Length sweet spot for this network."
                : "Repurpose the clip slightly for better results."),
            reasons,
            connected: isConnected,
            factors: {
              engagementWeight: base,
              durationFit,
              pastPerformance,
            },
          };
        })
        .sort((a, b) => b.score - a.score);

      res.json({
        videoId: videoRecord?.id ?? rawVideoId ?? null,
        heygenVideoId: videoRecord?.heygenVideoId ?? rawHeygenId ?? null,
        durationSeconds: resolvedDuration,
        durationSource,
        platformScores,
      });
    } catch (error) {
      console.error("Platform score error:", error);
      res.status(500).json({ error: "Failed to score platforms" });
    }
  });

  // Facebook-specific endpoints
  app.get("/api/facebook/pages", requireAuth, async (req: any, res) => {
    try {
      const user = await resolveMemStorageUser(req);

      const socialAccounts = user
        ? await storage.getSocialMediaAccounts(user.id)
        : [];
      const facebookAccount = socialAccounts.find(
        (acc) => acc.platform.toLowerCase() === "facebook"
      );

      const metadata = (facebookAccount?.metadata as any) || {};
      const delegatedToken =
        metadata?.pageAccessToken ||
        facebookAccount?.accessToken ||
        process.env.FACEBOOK_USER_TOKEN;

      if (!delegatedToken) {
        return res.status(400).json({
          error:
            "Facebook token missing. Connect your Facebook Page or set FACEBOOK_USER_TOKEN.",
        });
      }

      const pages = await socialMediaService.getFacebookPageInfo(
        delegatedToken
      );
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

  // Get all Instagram Business Accounts linked to user's Facebook Pages
  app.get("/api/instagram/accounts", requireAuth, async (req: any, res) => {
    try {
      const user = await resolveMemStorageUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const socialAccounts = await storage.getSocialMediaAccounts(user.id);
      const facebookAccount = socialAccounts.find(
        (acc) => acc.platform.toLowerCase() === "facebook"
      );

      const metadata = (facebookAccount?.metadata as any) || {};
      const delegatedToken =
        metadata?.pageAccessToken ||
        facebookAccount?.accessToken ||
        process.env.FACEBOOK_USER_TOKEN;

      if (!delegatedToken) {
        return res.json([]);
      }

      // First, get all Facebook Pages
      const pages = await socialMediaService.getFacebookPageInfo(
        delegatedToken
      );

      // Then fetch Instagram Business Account for each page
      const instagramAccounts = [];
      for (const page of pages) {
        try {
          const response = await fetch(
            `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account{username,id}&access_token=${delegatedToken}`
          );

          if (response.ok) {
            const data = await response.json();
            if (data.instagram_business_account) {
              instagramAccounts.push({
                instagramBusinessAccountId: data.instagram_business_account.id,
                pageId: page.id,
                pageName: page.name,
                username: data.instagram_business_account.username,
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching Instagram for page ${page.id}:`, error);
          // Continue with other pages
        }
      }

      res.json(instagramAccounts);
    } catch (error: any) {
      console.error(
        "Error fetching Instagram accounts:",
        error?.message || error
      );
      res.status(500).json({
        error: "Failed to fetch Instagram accounts",
        details: error?.message || "Unknown error",
      });
    }
  });

  // Get Instagram Business Account linked to specific Facebook Page
  app.get(
    "/api/instagram/account/:pageId",
    requireAuth,
    async (req: any, res) => {
      try {
        const { pageId } = req.params;
        const user = await resolveMemStorageUser(req);

        const socialAccounts = user
          ? await storage.getSocialMediaAccounts(user.id)
          : [];
        const facebookAccount = socialAccounts.find(
          (acc) => acc.platform.toLowerCase() === "facebook"
        );

        const metadata = (facebookAccount?.metadata as any) || {};
        const delegatedToken =
          metadata?.pageAccessToken ||
          facebookAccount?.accessToken ||
          process.env.FACEBOOK_USER_TOKEN;

        if (!delegatedToken) {
          return res.status(400).json({
            error:
              "Facebook token missing. Please reconnect your Facebook account.",
          });
        }

        // Fetch Instagram Business Account linked to this Page
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${delegatedToken}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          return res.status(400).json({
            error: "Failed to fetch Instagram account",
            details: errorData.error?.message || "Unknown error",
          });
        }

        const data = await response.json();

        if (!data.instagram_business_account) {
          return res.status(404).json({
            error: "No Instagram Business Account linked",
            message:
              "Please link an Instagram Business account to your Facebook Page first.",
          });
        }

        res.json({
          instagramBusinessAccountId: data.instagram_business_account.id,
          pageId: pageId,
        });
      } catch (error: any) {
        console.error(
          "Error fetching Instagram account:",
          error?.message || error
        );
        res.status(500).json({
          error: "Failed to fetch Instagram account",
          details: error?.message || "Unknown error",
        });
      }
    }
  );

  app.post(
    "/api/facebook/post",
    requireAuth,
    upload.single("photo"),
    async (req: any, res) => {
      try {
        const { content, pageId } = req.body;
        if (!content) {
          return res.status(400).json({ error: "Content is required" });
        }

        const user = await resolveMemStorageUser(req);
        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const socialAccounts = await storage.getSocialMediaAccounts(user.id);
        const facebookAccount = socialAccounts.find(
          (acc) => acc.platform.toLowerCase() === "facebook"
        );

        const metadata = (facebookAccount?.metadata as any) || {};
        const resolvedPageId =
          pageId ||
          metadata?.pageId ||
          facebookAccount?.accountId ||
          process.env.FACEBOOK_PAGE_ID;

        if (!resolvedPageId) {
          return res.status(400).json({
            error:
              "Page ID is required for Facebook posting. Connect your page or supply a pageId.",
          });
        }

        const resolvedToken =
          metadata?.pageAccessToken ||
          facebookAccount?.accessToken ||
          process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
          process.env.FACEBOOK_USER_TOKEN;

        if (!resolvedToken) {
          return res.status(400).json({
            error:
              "Facebook token missing. Reconnect your Facebook account or set FACEBOOK_USER_TOKEN.",
          });
        }

        const useSampleImage = toBoolean(req.body.useSampleImage);
        const photo = req.file;
        let photoUrl: string | null = null;
        let usedSampleImage = false;

        if (photo) {
          photoUrl = `/uploads/${path.basename(photo.path)}`;
        } else if (useSampleImage) {
          photoUrl = DEFAULT_SOCIAL_SAMPLE_IMAGE;
          usedSampleImage = true;
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const postResult = await socialMediaService.postToFacebookPage(
          resolvedPageId,
          content,
          photoUrl || undefined,
          resolvedToken,
          baseUrl
        );

        const scheduledPost = await storage.createScheduledPost({
          userId: user.id,
          platform: "facebook",
          content,
          scheduledFor: new Date(),
          status: "posted",
          postType: "quick_test",
          hashtags: content.match(/#\w+/g) || [],
          isEdited: false,
          originalContent: content,
          neighborhood: null,
        });

        realtimeService.notifySocialPostScheduled(
          user.id,
          scheduledPost.id,
          "facebook",
          new Date().toISOString()
        );

        res.json({
          success: true,
          message: "Content posted successfully to Facebook page",
          postId: postResult.postId,
          pageId: resolvedPageId,
          usedSampleImage,
          scheduledPostId: scheduledPost.id,
          permalinkHint: `https://www.facebook.com/${resolvedPageId}`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Facebook post error:", error);

        if (error instanceof SocialMediaError) {
          return res.status(error.statusCode).json({
            error: error.message,
            details: error.details,
            requiresReconnect: error.statusCode === 401,
          });
        }

        const message =
          error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
          error: `Failed to post to Facebook: ${message}`,
        });
      }
    }
  );

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
  app.post(
    "/api/instagram/post",
    requireAuth,
    upload.single("photo"),
    async (req: any, res) => {
      try {
        const { content, instagramBusinessAccountId } = req.body;
        const photo = req.file;

        if (!content) {
          return res.status(400).json({ error: "Content is required" });
        }

        if (!instagramBusinessAccountId) {
          return res.status(400).json({
            error:
              "Instagram Business Account ID is required. Please select an Instagram account.",
          });
        }

        const user = await resolveMemStorageUser(req);
        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Instagram uses Facebook's Graph API, so we need the Facebook token
        const socialAccounts = await storage.getSocialMediaAccounts(user.id);
        const facebookAccount = socialAccounts.find(
          (acc) => acc.platform.toLowerCase() === "facebook"
        );

        const metadata = (facebookAccount?.metadata as any) || {};
        const resolvedToken =
          metadata?.pageAccessToken ||
          facebookAccount?.accessToken ||
          process.env.FACEBOOK_USER_TOKEN;

        if (!resolvedToken) {
          return res.status(400).json({
            error:
              "Facebook token missing. Instagram posting requires Facebook connection.",
          });
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const useSampleImage = toBoolean(
          req.body.useSampleImage ?? (!photo ? "true" : "false")
        );

        let photoUrl: string | null = null;
        let usedSampleImage = false;

        if (photo) {
          photoUrl = `${baseUrl}/uploads/${path.basename(photo.path)}`;
        } else if (useSampleImage) {
          photoUrl = DEFAULT_SOCIAL_SAMPLE_IMAGE;
          usedSampleImage = true;
        } else {
          return res.status(400).json({
            error:
              "Instagram requires an image. Upload a photo or enable the sample image option.",
          });
        }

        const postResult = await socialMediaService.postToInstagram(
          content,
          photoUrl,
          resolvedToken,
          instagramBusinessAccountId
        );

        const scheduledPost = await storage.createScheduledPost({
          userId: user.id,
          platform: "instagram",
          content,
          scheduledFor: new Date(),
          status: "posted",
          postType: "quick_test",
          hashtags: content.match(/#\w+/g) || [],
          isEdited: false,
          originalContent: content,
          neighborhood: null,
        });

        realtimeService.notifySocialPostScheduled(
          user.id,
          scheduledPost.id,
          "instagram",
          new Date().toISOString()
        );

        res.json({
          success: true,
          message: "Content posted successfully to Instagram",
          postId: postResult.postId,
          instagramBusinessAccountId,
          usedSampleImage,
          scheduledPostId: scheduledPost.id,
          permalinkHint: "https://www.instagram.com",
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
    }
  );

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
  app.post(
    "/api/twitter/post",
    requireAuth,
    upload.single("photo"),
    async (req: any, res) => {
      try {
        // Require authentication
        if (!req.user?.id) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Resolve DB user ID to MemStorage UUID (same logic as other endpoints)
        let userId = String(req.user.id);
        let user = await storage.getUser(userId);

        // If not found by ID, try by email (CRITICAL for DB-authenticated users)
        if (!user && req.user?.email) {
          user = await storage.getUserByEmail(req.user.email);
        }

        // If not found by email, try by username
        if (!user && req.user?.username) {
          user = await storage.getUserByUsername(req.user.username);
        }

        if (!user) {
          return res.status(404).json({
            error:
              "User not found in storage. Please reconnect your Twitter account.",
          });
        }

        // Support both JSON (from old frontend) and FormData (from new frontend)
        let content = req.body.content;
        const photo = req.file;

        // Debug logging
        console.log("📝 Twitter post request:", {
          userId: user.id,
          contentType: req.get("content-type"),
          bodyKeys: Object.keys(req.body),
          content: content ? content.substring(0, 50) + "..." : "MISSING",
          hasPhoto: !!photo,
        });

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

        // Pass userId to use OAuth 2.0 token from database
        const postResult = await socialMediaService.postToTwitter(
          user.id,
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
    }
  );

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
  app.post(
    "/api/youtube/post",
    requireAuth,
    upload.single("video"),
    async (req: any, res) => {
      try {
        const {
          title,
          description,
          content,
          accessToken: overrideToken,
        } = req.body;
        const video = req.file;

        console.log("🎥 YouTube post request:", {
          rawUserId: req.user?.id,
          email: req.user?.email,
          username: req.user?.username,
          contentType: req.get("content-type"),
          bodyKeys: Object.keys(req.body),
          hasVideo: !!video,
        });

        if (!title && !content) {
          return res
            .status(400)
            .json({ error: "Title or content is required" });
        }

        if (!req.user?.id) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Resolve DB user ID to MemStorage UUID (same pattern as Twitter)
        let userId = String(req.user.id);
        let user = await storage.getUser(userId);

        if (!user && req.user?.email) {
          user = await storage.getUserByEmail(req.user.email);
        }

        if (!user && req.user?.username) {
          user = await storage.getUserByUsername(req.user.username);
        }

        if (!user) {
          console.error(
            "❌ YouTube post: user not found in storage for session id",
            userId
          );
          return res.status(404).json({
            error:
              "User not found in storage. Please reconnect your YouTube account.",
          });
        }

        console.log("✅ YouTube post resolved user:", {
          userId: user.id,
          email: user.email,
          username: user.username,
        });

        const socialAccounts = await storage.getSocialMediaAccounts(user.id);
        console.log(
          `📊 Social accounts for user ${user.id}:`,
          socialAccounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            hasAccessToken: !!a.accessToken,
          }))
        );

        const youtubeAccount = socialAccounts.find(
          (acc) => acc.platform.toLowerCase() === "youtube"
        );

        const effectiveAccessToken =
          overrideToken || youtubeAccount?.accessToken || null;

        console.log("🔑 YouTube token resolution:", {
          hasOverride: !!overrideToken,
          hasStoredToken: !!youtubeAccount?.accessToken,
          usingTokenSource: overrideToken
            ? "override"
            : youtubeAccount?.accessToken
            ? "stored"
            : "none",
        });

        if (!effectiveAccessToken) {
          return res.status(400).json({
            error:
              "YouTube access token is required. Please connect your YouTube account again.",
          });
        }

        const sampleVideoPath =
          process.env.YOUTUBE_SAMPLE_VIDEO_PATH ||
          path.join(process.cwd(), "uploads/videos/demo-property-tour.mp4");

        let videoSourcePath: string | undefined;
        let usedSampleVideo = false;

        if (video?.path) {
          videoSourcePath = path.resolve(video.path);
        } else if (fs.existsSync(sampleVideoPath)) {
          videoSourcePath = sampleVideoPath;
          usedSampleVideo = true;
        }

        const finalTitle = title || content?.substring(0, 100) + "...";
        const finalDescription = description || content || "";

        console.log("🚀 Posting to YouTube with:", {
          finalTitle,
          hasDescription: !!finalDescription,
          videoSourcePath,
          usedSampleVideo,
        });

        const postResult = await socialMediaService.postToYoutube(
          finalTitle,
          finalDescription,
          videoSourcePath,
          effectiveAccessToken
        );

        if (video?.path) {
          fs.unlink(video.path, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Failed to remove uploaded temp video:", unlinkErr);
            }
          });
        }

        res.json({
          success: true,
          message: usedSampleVideo
            ? "Uploaded built-in sample video to YouTube"
            : video
            ? "Uploaded your video to YouTube"
            : "Content posted successfully to YouTube",
          postId: postResult.postId,
          watchUrl: postResult.watchUrl,
          studioUrl: postResult.studioUrl,
          usedSampleVideo,
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
    }
  );

  // Dedicated YouTube video upload endpoint
  app.post(
    "/api/youtube/upload-video",
    requireAuth,
    videoUpload.single("video"),
    async (req: any, res) => {
      try {
        const { title, description } = req.body;
        const videoFile = req.file;

        if (!videoFile) {
          return res.status(400).json({ error: "Video file is required" });
        }

        if (!title) {
          return res.status(400).json({ error: "Video title is required" });
        }

        // Resolve user ID to MemStorage UUID
        let userId = String(req.user.id);
        let user = await storage.getUser(userId);

        if (!user && req.user.email) {
          user = await storage.getUserByEmail(req.user.email);
        }

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Get YouTube account from storage
        const socialAccounts = await storage.getSocialMediaAccounts(user.id);
        const youtubeAccount = socialAccounts.find(
          (acc) => acc.platform === "youtube"
        );

        if (!youtubeAccount || !youtubeAccount.isConnected) {
          return res.status(400).json({
            error: "YouTube account not connected. Please connect your YouTube account first.",
          });
        }

        if (!youtubeAccount.accessToken) {
          return res.status(400).json({
            error: "YouTube access token not found. Please reconnect your YouTube account.",
          });
        }

        const absoluteVideoPath = path.resolve(videoFile.path);

        console.log("Processing YouTube video upload:", {
          title,
          description,
          videoPath: videoFile.path,
          absoluteVideoPath,
          fileSize: videoFile.size,
          mimetype: videoFile.mimetype,
        });

        const uploadResult = await socialMediaService.postToYoutube(
          title,
          description || title,
          absoluteVideoPath,
          youtubeAccount.accessToken
        );

        fs.unlink(videoFile.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Failed to cleanup uploaded file:", unlinkErr);
          }
        });

        res.json({
          success: true,
          message: "Video uploaded successfully to YouTube",
          videoId: uploadResult.postId,
          watchUrl: uploadResult.watchUrl,
          studioUrl: uploadResult.studioUrl,
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
                lastSync: new Date(),
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
  app.get("/api/seo/keywords", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let keywords = await storage.getSeoKeywords(userId);

      // Auto-generate keywords on first login if user has none
      if (!keywords || keywords.length === 0) {
        console.log(
          `📊 No keywords found for user ${userId}, generating AI keywords...`
        );

        // Get user's service areas from market data
        const marketData = await storage.getMarketData(userId);
        const serviceAreas = marketData
          .map((m) => m.neighborhood)
          .filter(Boolean);

        if (serviceAreas.length === 0) {
          serviceAreas.push("Omaha"); // Default to Omaha
        }

        try {
          const { AIKeywordGenerator } = await import(
            "./services/ai-keyword-generator"
          );
          const generator = new AIKeywordGenerator(userId);

          let generatedData;
          try {
            generatedData = await generator.generateKeywords(serviceAreas);
          } catch (aiError) {
            console.warn(
              "⚠️  AI keyword generation failed, using fallback:",
              aiError
            );
            generatedData = generator.getFallbackKeywords(serviceAreas);
          }

          // Save generated keywords to storage
          for (const keyword of generatedData.keywords) {
            await storage.createSeoKeyword(keyword);
          }

          keywords = await storage.getSeoKeywords(userId);
          console.log(
            `✅ Auto-generated ${keywords.length} keywords for new user`
          );
        } catch (error) {
          console.error("❌ Keyword generation error:", error);
        }
      }

      res.json(keywords);
    } catch (error) {
      console.error("Get SEO keywords error:", error);
      res.status(500).json({ error: "Failed to fetch SEO keywords" });
    }
  });

  app.post("/api/seo/keywords/generate", async (req, res) => {
    try {
      const { location, businessType } = req.body;

      // Fetch live market data to provide real-time context to AI
      let marketData;
      try {
        marketData = await storage.getMarketData();
        if (!marketData || marketData.length === 0) {
          console.warn(
            "⚠️  No market data available for AI keyword generation"
          );
          return res.status(502).json({
            error: "Market data unavailable",
            message:
              "Unable to fetch real-time market data. Please try again later or contact support.",
          });
        }
      } catch (marketError) {
        console.error(
          "Failed to fetch market data for keyword generation:",
          marketError
        );
        return res.status(502).json({
          error: "Market data service error",
          message:
            "Could not retrieve market intelligence data. Keyword generation requires live market data.",
        });
      }

      // Generate keywords with real market intelligence
      const keywords = await seoService.generateTopKeywordsWithAI(
        location || "Omaha, Nebraska",
        businessType || "real estate agent",
        marketData
      );

      res.json(keywords);
    } catch (error) {
      console.error("❌ AI keyword generation error:", error);
      res.status(502).json({
        error: "AI keyword generation failed",
        message:
          "Unable to generate fresh, market-driven keywords. Please try again or contact support.",
        details: (error as Error).message,
      });
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
      const prompt = `You are an expert real estate marketing strategist and SEO specialist. Based on the following data, create an optimal 15-day content calendar for Mike Bjork's real estate business in Omaha, Nebraska.

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

      // Use Unified AI Service (GitHub Copilot with OpenAI fallback)
      const { unifiedAI } = await import("./services/unified-ai");
      const aiResponse = await unifiedAI.generate(prompt, {
        systemPrompt:
          "You are an expert real estate marketing AI that creates optimized content schedules based on SEO data and market analytics. Always respond with valid JSON only.",
        temperature: 0.7,
        maxTokens: 4000,
        jsonMode: true,
      });

      console.log(
        `✅ Content calendar AI response from: ${aiResponse.provider}`
      );
      const aiSchedule = JSON.parse(aiResponse.content);

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
  app.get("/api/market/data", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const marketData = await storage.getMarketData(userId);

      // If user has no market data, generate initial data
      if (!marketData || marketData.length === 0) {
        console.log(
          `📊 No market data found for user ${userId}, generating initial data...`
        );
        const { AIMarketDataGenerator } = await import(
          "./services/ai-market-generator"
        );
        const generator = new AIMarketDataGenerator(userId);

        let generatedData;
        try {
          generatedData = await generator.generateOmahaMarketData();
        } catch (aiError) {
          console.warn(
            "⚠️  AI generation failed, using fallback data:",
            aiError
          );
          generatedData = generator.getFallbackData();
        }

        const newMarketData = await storage.refreshMarketData(
          userId,
          generatedData.neighborhoods
        );
        return res.json(newMarketData);
      }

      res.json(marketData);
    } catch (error) {
      console.error("Get market data error:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  app.get(
    "/api/market/neighborhoods/:neighborhood",
    requireAuth,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { neighborhood } = req.params;
        const data = await storage.getMarketDataByNeighborhood(
          userId,
          neighborhood
        );

        if (!data) {
          return res.status(404).json({ error: "Neighborhood data not found" });
        }

        res.json(data);
      } catch (error) {
        console.error("Get neighborhood data error:", error);
        res.status(500).json({ error: "Failed to fetch neighborhood data" });
      }
    }
  );

  app.post("/api/market/refresh", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(
        `🔄 Refreshing market data for user ${userId} with AI generation...`
      );

      // Import and initialize AI market data generator
      const { AIMarketDataGenerator } = await import(
        "./services/ai-market-generator"
      );
      const generator = new AIMarketDataGenerator(userId);

      let generatedData;
      try {
        generatedData = await generator.generateOmahaMarketData();
      } catch (aiError) {
        console.warn("⚠️  AI generation failed, using fallback data:", aiError);
        generatedData = generator.getFallbackData();
      }

      // Refresh storage with new data for this user
      const newMarketData = await storage.refreshMarketData(
        userId,
        generatedData.neighborhoods
      );

      res.json({
        success: true,
        data: newMarketData,
        metadata: generatedData.metadata,
      });
    } catch (error) {
      console.error("❌ Market data refresh error:", error);
      res.status(500).json({
        error: "Failed to refresh market data",
        message: (error as Error).message,
      });
    }
  });

  // Content Opportunities endpoints - AI-generated content suggestions
  app.get("/api/ai/opportunities", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get stored opportunities for this user
      const opportunities = await db
        .select()
        .from(contentOpportunities)
        .where(eq(contentOpportunities.userId, userId))
        .orderBy(
          desc(contentOpportunities.priority),
          desc(contentOpportunities.createdAt)
        );

      // If no opportunities exist, generate initial set
      if (opportunities.length === 0) {
        console.log(
          `📊 No opportunities found for user ${userId}, triggering auto-generation...`
        );
        // Trigger generation and return empty array (client will refetch)
        // We'll handle generation in the POST endpoint
        return res.json([]);
      }

      res.json(opportunities);
    } catch (error) {
      console.error("Failed to get content opportunities:", error);
      res.status(500).json({ error: "Failed to fetch content opportunities" });
    }
  });

  app.post(
    "/api/ai/opportunities/generate",
    requireAuth,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        console.log(
          `🎯 Generating AI content opportunities for user ${userId}...`
        );

        // 1. Load user's market data (top neighborhoods)
        const marketData = await storage.getMarketData(userId);
        const topNeighborhoods = marketData
          .filter((m) => m.trend === "hot" || m.trend === "rising")
          .slice(0, 5)
          .map((m) => ({
            name: m.neighborhood,
            avgPrice: m.avgPrice,
            trend: m.trend,
            inventory: m.inventory,
          }));

        // 2. Load user's SEO keywords (top priority)
        const keywords = await storage.getSeoKeywords(userId);
        const topKeywords = keywords.slice(0, 10).map((k) => ({
          keyword: k.keyword,
          volume: k.searchVolume || 0,
          difficulty: k.difficulty || 0,
        }));

        // 3. Build AI prompt for generating opportunities
        const prompt = `You are a real estate content strategist. Based on the following market data and SEO keywords, generate 5 high-value content opportunities for a real estate agent.

Market Data (Hot Neighborhoods):
${topNeighborhoods
  .map(
    (n) =>
      `- ${n.name}: $${n.avgPrice?.toLocaleString()} avg price, ${
        n.trend
      } trend, ${n.inventory} inventory`
  )
  .join("\n")}

Top SEO Keywords:
${topKeywords
  .map(
    (k) => `- "${k.keyword}" (volume: ${k.volume}, difficulty: ${k.difficulty})`
  )
  .join("\n")}

Generate exactly 5 content opportunities as a JSON object with an "opportunities" array. Each opportunity must include:
- title: Catchy title for the content piece (e.g., "Aksarben Market Update", "First-Time Buyer Guide")
- description: Brief reason why this content is valuable (e.g., "High search volume", "Trending topic", "Seasonal interest")
- priority: "high", "medium", or "low"
- neighborhood: neighborhood name if applicable, or null
- relatedKeyword: the keyword this relates to, or null
- trendSource: "market" (based on neighborhood data), "keyword" (based on SEO keywords), or "trend" (general real estate trend)
- searchSignal: integer score 0-100 indicating search demand/relevance

Focus on:
1. High-search-volume topics related to the provided keywords
2. Neighborhood-specific market updates for hot areas
3. Seasonal/trending real estate topics
4. First-time buyer guides and educational content
5. Local market analysis and comparisons

Return ONLY valid JSON in this format: {"opportunities": [{...}, {...}, ...]}`;

        // Use Unified AI Service (GitHub Copilot with OpenAI fallback)
        const { unifiedAI } = await import("./services/unified-ai");
        const aiResponse = await unifiedAI.generate(prompt, {
          systemPrompt:
            "You are a real estate content strategist who generates data-driven content opportunities in JSON format.",
          temperature: 0.7,
          maxTokens: 1500,
          jsonMode: true,
        });

        console.log(`✅ AI Response from: ${aiResponse.provider}`);

        // Parse AI response
        let generatedOpportunities;
        try {
          const result = JSON.parse(aiResponse.content);
          // The response_format forces JSON object, so we expect {opportunities: [...]}
          generatedOpportunities = result.opportunities || result || [];
          if (!Array.isArray(generatedOpportunities)) {
            // If it's a single object, wrap in array
            generatedOpportunities = [generatedOpportunities];
          }
        } catch (parseError) {
          console.error("Failed to parse AI response:", parseError);
          console.error("Raw response:", aiResponse.content);
          throw new Error("Failed to parse AI-generated opportunities");
        }

        // Map priority strings to integers
        const priorityToInt = (priority: string): number => {
          const priorityMap: Record<string, number> = {
            high: 3,
            medium: 2,
            low: 1,
          };
          return priorityMap[priority?.toLowerCase()] || 2; // Default to medium (2)
        };

        // Validate and prepare for database
        const opportunitiesToInsert = generatedOpportunities
          .slice(0, 5)
          .map((opp: any) => ({
            userId,
            opportunityType: opp.trendSource || "trend",
            title: opp.title || "Untitled Opportunity",
            description: opp.description || "AI-generated content opportunity",
            priority: priorityToInt(opp.priority || "medium"),
            neighborhood: opp.neighborhood || null,
            keywordId: opp.relatedKeyword || null,
            searchSignal: Math.min(100, Math.max(0, opp.searchSignal || 50)),
            metadata: {
              relatedKeyword: opp.relatedKeyword,
              generatedBy: aiResponse.provider,
              model: aiResponse.model,
              marketContext: topNeighborhoods.length > 0,
              keywordContext: topKeywords.length > 0,
            },
          }));

        // Delete old opportunities for this user
        await db
          .delete(contentOpportunities)
          .where(eq(contentOpportunities.userId, userId));

        // Insert new opportunities
        const inserted = await db
          .insert(contentOpportunities)
          .values(opportunitiesToInsert)
          .returning();

        console.log(
          `✅ Generated ${inserted.length} content opportunities for user ${userId}`
        );
        res.json(inserted);
      } catch (error) {
        console.error("❌ Failed to generate content opportunities:", error);
        res.status(500).json({
          error: "Failed to generate content opportunities",
          message: (error as Error).message,
        });
      }
    }
  );

  app.get("/api/market/intelligence", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Import the market intelligence service
      const { MarketIntelligenceService } = await import(
        "./services/market-intelligence"
      );
      const marketIntelligenceService = new MarketIntelligenceService();

      // Fetch live market data for this user
      let marketData;
      try {
        marketData = await storage.getMarketData(userId);
        if (!marketData || marketData.length === 0) {
          console.warn(
            `⚠️  No market data available for user ${userId}, generating initial data...`
          );

          // Generate initial market data for the user
          const { AIMarketDataGenerator } = await import(
            "./services/ai-market-generator"
          );
          const generator = new AIMarketDataGenerator(userId);

          let generatedData;
          try {
            generatedData = await generator.generateOmahaMarketData();
          } catch (aiError) {
            console.warn(
              "⚠️  AI generation failed, using fallback data:",
              aiError
            );
            generatedData = generator.getFallbackData();
          }

          marketData = await storage.refreshMarketData(
            userId,
            generatedData.neighborhoods
          );
        }
      } catch (marketError) {
        console.error(
          "Failed to fetch market data for intelligence:",
          marketError
        );
        return res.status(502).json({
          error: "Market data service error",
          message: "Could not retrieve market data for analysis.",
        });
      }

      // Generate AI-powered market intelligence
      const intelligence = await marketIntelligenceService.generateIntelligence(
        marketData
      );

      res.json(intelligence);
    } catch (error) {
      console.error("❌ Market intelligence generation error:", error);
      res.status(502).json({
        error: "Intelligence generation failed",
        message:
          "Unable to generate market intelligence. Please try again or contact support.",
        details: (error as Error).message,
      });
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
  app.get("/api/scheduled-posts", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user.id);
      const status = req.query.status as string;
      const posts = await storage.getScheduledPosts(userId, status);
      res.json(posts);
    } catch (error) {
      console.error("Get scheduled posts error:", error);
      res.status(500).json({ error: "Failed to fetch scheduled posts" });
    }
  });

  app.post("/api/scheduled-posts", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user.id);

      // Validate the request body
      const postData = insertScheduledPostSchema.parse({
        userId,
        ...req.body,
      });

      const createdPost = await storage.createScheduledPost(postData);
      res.status(201).json(createdPost);
    } catch (error) {
      console.error("Create scheduled post error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "Invalid post data", details: error });
      }
      res.status(500).json({ error: "Failed to create scheduled post" });
    }
  });

  // Generate 30-day content calendar
  app.post("/api/content/generate-plan", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.user.id);
      console.log(`🗓️  Generating 30-day content plan for user ${userId}...`);

      // Get user's market data for service areas
      const marketData = await storage.getMarketData(userId);
      const serviceAreas = marketData
        .map((m) => m.neighborhood)
        .filter(Boolean);

      if (serviceAreas.length === 0) {
        serviceAreas.push("Omaha"); // Default to Omaha
      }

      // Import and initialize AI content calendar generator
      const { AIContentCalendarGenerator } = await import(
        "./services/ai-content-calendar"
      );
      const generator = new AIContentCalendarGenerator(userId);

      let generatedPlan;
      try {
        generatedPlan = await generator.generate30DayPlan(
          serviceAreas,
          marketData,
          req.body.targetAudience,
          req.body.specialties
        );
      } catch (aiError) {
        console.warn(
          "⚠️  AI content generation failed, using fallback:",
          aiError
        );
        generatedPlan = generator.getFallbackContentPlan(
          serviceAreas,
          marketData
        );
      }

      // Save generated posts to storage
      const createdPosts = [];
      for (const post of generatedPlan.posts) {
        const created = await storage.createScheduledPost(post);
        createdPosts.push(created);
      }

      console.log(
        `✅ Generated ${createdPosts.length}-day content plan for user ${userId}`
      );

      res.json({
        success: true,
        posts: createdPosts,
        metadata: generatedPlan.metadata,
      });
    } catch (error) {
      console.error("❌ Content plan generation error:", error);
      res.status(500).json({
        error: "Failed to generate content plan",
        message: (error as Error).message,
      });
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

  app.patch("/api/scheduled-posts/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Validate using Zod schema for mutable fields only
      const result = updateScheduledPostSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: "Invalid update data",
          details: result.error.format(),
        });
      }

      if (Object.keys(result.data).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updatedPost = await storage.updateScheduledPost(id, result.data);

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

  // Manually publish a scheduled post now
  app.post("/api/scheduled-posts/:id/publish", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const post = await storage.getScheduledPostById(id);
      if (!post) {
        return res.status(404).json({ error: "Scheduled post not found" });
      }

      if (post.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const platform = post.platform.toLowerCase();
      
      if (platform === "x" || platform === "twitter") {
        try {
          const result = await socialMediaService.postToTwitter(
            userId,
            post.content,
            post.imageUrl
          );

          await storage.updateScheduledPost(id, {
            status: "published",
            metadata: {
              ...post.metadata,
              publishedAt: new Date().toISOString(),
              platformPostId: result.postId,
            },
          });

          return res.json({ success: true, postId: result.postId });
        } catch (error: any) {
          await storage.updateScheduledPost(id, {
            status: "failed",
            metadata: {
              ...post.metadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
          return res.status(500).json({ error: error.message });
        }
      } else {
        return res.status(400).json({ error: `Platform ${platform} not yet supported for manual publishing` });
      }
    } catch (error: any) {
      console.error("Manual publish error:", error);
      res.status(500).json({ error: "Failed to publish post" });
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
            isAiGenerated: true,
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
            isAiGenerated: false,
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

  app.post("/api/videos", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const validatedData = insertVideoContentSchema.parse({
        ...req.body,
        userId,
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

  // Generate script without video ID (standalone)
  app.post("/api/generate-script", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id);

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const {
        topic,
        neighborhood,
        videoType,
        platform = "youtube",
        duration = 60,
      } = req.body;

      let script;
      try {
        // Try to generate AI script
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

      res.json({ script });
    } catch (error) {
      console.error("Generate script error:", error);
      res.status(500).json({
        error: "Failed to generate script. Please try again later.",
      });
    }
  });

  app.post("/api/videos/:id/generate-script", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = String(req.user?.id);

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const {
        topic,
        neighborhood,
        videoType,
        platform = "youtube",
        duration = 60,
      } = req.body;

      // Ownership check - only allow users to generate scripts for their own videos
      const video = await storage.getVideoByIdAndUser(id, userId);
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

  app.post("/api/videos/:id/generate-video", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = String(req.user?.id);

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { avatarId, avatarType, uploadedAvatarPhoto, gestureIntensity } =
        req.body;

      // Ownership check - only allow users to generate videos for their own video content
      const video = await storage.getVideoByIdAndUser(id, userId);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Handle both regular avatars and photo avatar groups
      let avatar = null;
      let isPhotoAvatarGroup = false;

      if (avatarId) {
        // First try to get as regular avatar
        avatar = await storage.getAvatarById(avatarId);

        // If not found, it might be a photo avatar group_id
        if (!avatar && avatarType === "talking_photo") {
          console.log(
            "🎭 Avatar ID is a photo avatar group, treating as photo avatar"
          );
          isPhotoAvatarGroup = true;
          // Create a temporary avatar object for photo avatar groups
          avatar = {
            id: avatarId,
            metadata: {
              heygenAvatarId: avatarId, // Use the group_id directly
            },
          };
        }
      }

      // Check if we have an avatar or photo avatar group
      if (avatar || isPhotoAvatarGroup) {
        // For testing purposes, generate a demo video first
        // This ensures the avatar test flow works while we fix HeyGen integration

        if (
          !isPhotoAvatarGroup &&
          (!avatar.metadata ||
            typeof avatar.metadata !== "object" ||
            !("heygenAvatarId" in avatar.metadata))
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
          // Support both: 1) explicit avatarType from frontend, 2) legacy avatar.avatarImageUrl detection
          const isTalkingPhoto =
            avatarType === "talking_photo" ||
            (!!avatar.avatarImageUrl &&
              avatar.avatarImageUrl.includes("/uploads/"));
          console.log(
            `Avatar type: ${isTalkingPhoto ? "talking_photo" : "avatar"}`
          );
          console.log(
            `Frontend avatarType: ${avatarType}, uploadedAvatarPhoto: ${
              uploadedAvatarPhoto ? "provided" : "none"
            }`
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
            gestureIntensity:
              gestureIntensity !== undefined ? gestureIntensity : 0, // Gesture support
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

  app.post("/api/videos/:id/upload-youtube", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = String(req.user?.id);

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { title, description, tags, privacy = "public" } = req.body;

      // Ownership check - only allow users to upload their own videos
      const video = await storage.getVideoByIdAndUser(id, userId);
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
      const streamingService = getStreamingService();
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

      const { avatarId, gestureIntensity } = req.body;
      const streamingService = getStreamingService();

      const session = await streamingService.createSession(
        user.id,
        avatarId,
        gestureIntensity
      );
      console.log(
        "🔍 Session response:",
        JSON.stringify({
          sessionId: session.sessionId,
          hasIceServers: !!session.iceServers,
          hasOffer: !!session.offer,
          iceServersLength: session.iceServers?.length,
        })
      );
      res.json(session);
    } catch (error) {
      console.error("Failed to create streaming session:", error);
      res.status(500).json({ error: "Failed to create streaming session" });
    }
  });

  // Start streaming session
  app.post("/api/streaming/start", async (req, res) => {
    try {
      const { sessionId } = req.body;

      const streamingService = getStreamingService();
      await streamingService.startSession(sessionId);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to start streaming session:", error);
      res.status(500).json({ error: "Failed to start streaming session" });
    }
  });

  // Make avatar speak
  app.post("/api/streaming/sessions/:sessionId/speak", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { text, taskType = "TALK" } = req.body;

      const streamingService = getStreamingService();
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

        const streamingService = getStreamingService();
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

        const streamingService = getStreamingService();
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

      const streamingService = getStreamingService();
      await streamingService.interrupt(sessionId);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to interrupt avatar:", error);
      res.status(500).json({ error: "Failed to interrupt avatar" });
    }
  });

  // Submit ICE candidate or SDP answer
  app.post("/api/streaming/sessions/:sessionId/ice", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { candidate, sdp } = req.body;

      const streamingService = getStreamingService();
      await streamingService.submitICE(sessionId, candidate, sdp);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to submit ICE:", error);
      res.status(500).json({ error: "Failed to submit ICE" });
    }
  });

  // End streaming session
  app.delete("/api/streaming/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const streamingService = getStreamingService();
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

      const streamingService = getStreamingService();
      const sessions = streamingService.getActiveSessions(user.id);

      res.json({ sessions });
    } catch (error) {
      console.error("Failed to get sessions:", error);
      res.status(500).json({ error: "Failed to get sessions" });
    }
  });

  // ==================== PHOTO AVATAR ENDPOINTS ====================

  // Generate AI photos for avatars
  app.post(
    "/api/photo-avatars/generate-photos",
    requireAuth,
    async (req, res) => {
      try {
        const userId = String(req.user?.id);
        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        console.log("📸 Photo generation request:", req.body);

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const result = await photoAvatarService.generateAIPhotos(req.body);

        console.log("✅ Photo generation result:", result);

        // Send real-time notification
        realtimeService.notifyPhotoGenerated(
          userId,
          req.body.name || "Avatar",
          5 // HeyGen generates 5 photos
        );

        res.json(result);
      } catch (error) {
        console.error("❌ Failed to generate AI photos:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to generate AI photos";
        res.status(500).json({
          error: "Failed to generate AI photos",
          details: errorMessage,
        });
      }
    }
  );

  // Get photo generation status
  app.get(
    "/api/photo-avatars/generation/:generationId",
    requireAuth,
    async (req, res) => {
      try {
        const userId = String(req.user?.id);
        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        const { generationId } = req.params;

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const status = await photoAvatarService.getGenerationStatus(
          generationId
        );

        res.json(status);
      } catch (error) {
        console.error("Failed to get generation status:", error);
        res.status(500).json({ error: "Failed to get generation status" });
      }
    }
  );

  // Create avatar group
  app.post("/api/photo-avatars/groups", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { name, imageKey } = req.body;

      // Create group in HeyGen
      const photoAvatarService = new HeyGenPhotoAvatarService();
      const heygenGroup = await photoAvatarService.createAvatarGroup(
        name,
        imageKey
      );

      // Persist to database with userId for ownership tracking
      const dbGroup = await storage.createPhotoAvatarGroup({
        userId,
        heygenGroupId: heygenGroup.group_id,
        groupName: name,
        trainingStatus: "created",
      });

      console.log(
        "✅ Avatar group created and persisted to database:",
        dbGroup.id
      );

      // Fetch and persist individual avatars
      try {
        const looks = await photoAvatarService.getAvatarGroupLooks(
          heygenGroup.group_id
        );
        if (looks.avatar_list && Array.isArray(looks.avatar_list)) {
          for (const avatar of looks.avatar_list) {
            await storage.createPhotoAvatar({
              userId,
              heygenAvatarId: avatar.id,
              groupDbId: dbGroup.id,
              heygenGroupId: heygenGroup.group_id,
              name: avatar.name || name,
              pose: avatar.business_type,
              status: avatar.status || "pending",
              metadata: avatar,
            });
          }
          console.log(
            `✅ Persisted ${looks.avatar_list.length} individual avatars to database`
          );

          // Send notification
          realtimeService.notifyAvatarGroupCreated(
            parseInt(userId),
            heygenGroup.group_id,
            name,
            looks.avatar_list.length
          );
        }
      } catch (err) {
        console.error("⚠️ Failed to persist individual avatars:", err);
        // Don't fail the request if avatar persistence fails
      }

      res.json(heygenGroup);
    } catch (error) {
      console.error("Failed to create avatar group:", error);
      res.status(500).json({ error: "Failed to create avatar group" });
    }
  });

  // Add photos to avatar group
  app.post(
    "/api/photo-avatars/groups/:groupId/photos",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);
        const { imageKeys, name } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check - ensure user owns this avatar group
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const result = await photoAvatarService.addPhotosToGroup(
          groupId,
          imageKeys,
          name
        );

        // Fetch and persist newly added avatars
        try {
          const looks = await photoAvatarService.getAvatarGroupLooks(groupId);
          if (looks.avatar_list && Array.isArray(looks.avatar_list)) {
            for (const avatar of looks.avatar_list) {
              // Try to create, skip if already exists (unique constraint)
              try {
                await storage.createPhotoAvatar({
                  userId,
                  heygenAvatarId: avatar.id,
                  groupDbId: dbGroup.id,
                  heygenGroupId: groupId,
                  name: avatar.name || name,
                  pose: avatar.business_type,
                  status: avatar.status || "pending",
                  metadata: avatar,
                });
              } catch (err) {
                // Ignore duplicate errors (avatar already exists)
                if (!String(err).includes("unique")) {
                  throw err;
                }
              }
            }
            console.log(`✅ Synced avatars to database for group ${groupId}`);
          }
        } catch (err) {
          console.error("⚠️ Failed to sync avatars after adding photos:", err);
          // Don't fail the request if avatar sync fails
        }

        res.json(result);
      } catch (error) {
        console.error("Failed to add photos to group:", error);
        res.status(500).json({ error: "Failed to add photos to group" });
      }
    }
  );

  // List avatar groups (DATABASE-FIRST WITH PRIVACY)
  app.get("/api/photo-avatars/groups", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userIdString = String(userId);
      const dbGroups = await storage.listPhotoAvatarGroups(userIdString);

      const photoAvatarService = new HeyGenPhotoAvatarService();

      // Enrich each user's group with HeyGen data
      const mappedGroups = await Promise.all(
        dbGroups.map(async (dbGroup) => {
          const groupId = dbGroup.heygenGroupId;
          let looksCount = 0;
          let heygenStatus = dbGroup.trainingStatus;
          let previewImage = dbGroup.s3ImageUrl;
          let trainStatus = "empty"; // Default: not trained yet

          try {
            const looks = await photoAvatarService.getAvatarGroupLooks(groupId);
            looksCount = Array.isArray(looks?.avatar_list)
              ? looks.avatar_list.length
              : 0;

            // Sync HeyGen status to database
            if (looks?.avatar_list && looks.avatar_list.length > 0) {
              const heygenFirstLook = looks.avatar_list[0];
              const heygenLookStatus = heygenFirstLook.status; // "pending" or "completed"

              // Update database status if it doesn't match HeyGen
              if (
                dbGroup.trainingStatus !== heygenLookStatus &&
                heygenLookStatus === "completed"
              ) {
                try {
                  await storage.updatePhotoAvatarGroup(dbGroup.id, {
                    trainingStatus: "completed",
                  });
                  heygenStatus = "completed";
                  console.log(
                    `✅ Synced status for group ${groupId}: ${dbGroup.trainingStatus} → completed`
                  );
                } catch (updateError) {
                  console.warn(
                    `⚠️ Failed to update status for group ${groupId}:`,
                    updateError
                  );
                }
              } else if (heygenLookStatus === "pending") {
                heygenStatus = "pending";
              } else {
                heygenStatus = heygenLookStatus;
              }

              // Use first avatar's image if no preview available
              if (!previewImage) {
                previewImage = heygenFirstLook.image_url;
              }
            }
          } catch (e) {
            console.warn(
              `⚠️ Failed to fetch looks for group ${groupId}:`,
              (e as Error)?.message || e
            );
          }

          // Check training status from HeyGen
          try {
            const trainingStatusResponse =
              await photoAvatarService.checkTrainingStatus(groupId);
            console.log(
              `🔍 Training status for group ${groupId}:`,
              JSON.stringify(trainingStatusResponse, null, 2)
            );

            // HeyGen returns { status: "empty" | "processing" | "ready", ... }
            if (trainingStatusResponse?.status) {
              trainStatus = trainingStatusResponse.status;
            } else if (looksCount > 0) {
              // Fallback: if has looks, must be trained
              trainStatus = "ready";
            }
          } catch (e) {
            // If training status check fails, infer from other data
            if (looksCount > 0) {
              trainStatus = "ready"; // Has looks = trained
            } else {
              // Keep as "empty" by default
              console.warn(
                `⚠️ Failed to check training status for group ${groupId}:`,
                (e as Error)?.message || e
              );
            }
          }

          // Get custom voice for this group if any
          let defaultVoiceId = null;
          try {
            const customVoice = await storage.getPhotoAvatarGroupVoice(
              groupId,
              userId
            );
            if (customVoice?.heygenAudioAssetId) {
              defaultVoiceId = customVoice.heygenAudioAssetId;
            }
          } catch (e) {
            console.warn(
              `⚠️ Error fetching custom voice for group ${groupId}:`,
              e
            );
          }

          // Map HeyGen status to our status system
          // pending = HeyGen processing images
          // completed = Ready to train
          // ready = Trained and ready to generate looks
          const rawStatus = heygenStatus || dbGroup.trainingStatus || "pending";

          let status = rawStatus;
          if (
            rawStatus === "ready" ||
            (rawStatus === "completed" && looksCount > 0)
          ) {
            // Already trained or has looks - ready to generate
            status = "ready";
          } else if (rawStatus === "completed") {
            // HeyGen finished processing, ready to train
            status = "completed";
          } else {
            // Still processing images
            status = "pending";
          }

          return {
            group_id: groupId,
            name: dbGroup.name,
            status,
            train_status: trainStatus,
            default_voice_id: defaultVoiceId,
            created_at: dbGroup.createdAt || new Date().toISOString(),
            avatar_count: looksCount,
            training_progress:
              trainStatus === "processing"
                ? dbGroup.trainingProgress || 50
                : undefined,
            preview_image: previewImage,
            num_looks: looksCount,
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

  // Get avatar group details (WITH OWNERSHIP CHECK)
  app.get(
    "/api/photo-avatars/groups/:groupId",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();
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

        const rawStatus = dbGroup.status || "pending";
        const isCompleted = rawStatus === "completed" || rawStatus === "ready";
        const detail = {
          group_id: groupId,
          name: dbGroup.name,
          status: isCompleted
            ? "ready"
            : looksCount > 0
            ? "ready" // If it has looks, it's ready to use!
            : rawStatus,
          created_at: dbGroup.createdAt || new Date().toISOString(),
          avatar_count: looksCount,
          preview_image: dbGroup.s3ImageUrl,
        };

        res.json(detail);
      } catch (error) {
        console.error("Failed to get avatar group:", error);
        res.status(500).json({ error: "Failed to get avatar group" });
      }
    }
  );

  // Get avatar group photos (generated images) (WITH OWNERSHIP CHECK)
  app.get(
    "/api/photo-avatars/groups/:groupId/photos",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

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
    }
  );

  // Get avatar group looks (WITH OWNERSHIP CHECK)
  app.get(
    "/api/photo-avatars/groups/:groupId/looks",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const looks = await photoAvatarService.getAvatarGroupLooks(groupId);

        res.json(looks);
      } catch (error) {
        console.error("Failed to get avatar looks:", error);
        res.status(500).json({ error: "Failed to get avatar looks" });
      }
    }
  );

  // Train avatar group
  app.post(
    "/api/photo-avatars/groups/:groupId/train",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);
        const { defaultVoiceId } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const result = await photoAvatarService.trainAvatarGroup(
          groupId,
          defaultVoiceId
        );

        res.json(result);
      } catch (error: any) {
        console.error("Failed to train avatar group:", error);

        // Check if training is already in progress
        if (
          error?.message?.includes("Training already in progress") ||
          error?.message?.includes("training_in_progress")
        ) {
          return res.status(400).json({
            error: "Training already in progress",
            message:
              "This avatar group is already being trained. Please wait for it to complete.",
            code: "TRAINING_IN_PROGRESS",
          });
        }

        res.status(500).json({
          error: "Failed to train avatar group",
          details: error?.message || String(error),
        });
      }
    }
  );

  // Generate new looks
  app.post(
    "/api/photo-avatars/groups/:groupId/generate-looks",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }
        const { numLooks = 3 } = req.body;

        const photoAvatarService = new HeyGenPhotoAvatarService();

        // Check training status first
        try {
          const statusCheck = await photoAvatarService.checkTrainingStatus(
            groupId
          );
          console.log("📋 Avatar group training status:", statusCheck);

          if (statusCheck.status !== "ready") {
            return res.status(400).json({
              error: "Avatar group must be trained before generating looks",
              status: statusCheck.status,
              message: `Current status: ${statusCheck.status}. Please train the avatar group first using the 'Train Avatar' button, then wait for training to complete.`,
              code: "TRAINING_REQUIRED",
            });
          }
        } catch (statusError) {
          console.error("Failed to check training status:", statusError);
          // Continue anyway - the generate call will fail with a better error if not trained
        }

        const looks = await photoAvatarService.generateNewLooks(
          groupId,
          numLooks
        );

        res.json(looks);
      } catch (error: any) {
        console.error("Failed to generate new looks:", error);

        // Check if it's a HeyGen API error about model not found
        if (
          error?.message?.includes("Model not found") ||
          error?.message?.includes("invalid_parameter")
        ) {
          return res.status(400).json({
            error:
              "Avatar group training is not complete yet. Please wait for training to finish before generating new looks.",
            code: "TRAINING_REQUIRED",
          });
        }

        res.status(500).json({ error: "Failed to generate new looks" });
      }
    }
  );

  // Check training status
  app.get(
    "/api/photo-avatars/groups/:groupId/status",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const status = await photoAvatarService.checkTrainingStatus(groupId);

        res.json(status);
      } catch (error) {
        console.error("Failed to check training status:", error);
        res.status(500).json({ error: "Failed to check training status" });
      }
    }
  );

  // Add motion to avatar/look
  app.post(
    "/api/photo-avatars/:avatarId/add-motion",
    requireAuth,
    async (req, res) => {
      try {
        const { avatarId } = req.params;
        const userId = String(req.user?.id);
        const { prompt, motionType } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        console.log(`🎬 Adding motion to avatar ${avatarId}`);

        // Verify ownership by checking if avatar belongs to user's group
        const photoAvatarService = new HeyGenPhotoAvatarService();

        try {
          const avatarDetails = await photoAvatarService.getAvatarDetails(
            avatarId
          );
          const groupId = avatarDetails?.data?.group_id;

          if (groupId) {
            const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
              groupId,
              userId
            );
            if (!dbGroup) {
              return res
                .status(404)
                .json({ error: "Avatar not found or access denied" });
            }
          }
        } catch (error) {
          console.warn("Could not verify avatar ownership:", error);
          // Continue anyway - HeyGen API will reject if user doesn't own it
        }

        const result = await photoAvatarService.addMotion({
          avatarId,
          prompt,
          motionType,
        });

        res.json(result);
      } catch (error: any) {
        console.error("Failed to add motion:", error);
        res.status(500).json({
          error: "Failed to add motion",
          details: error?.message || String(error),
        });
      }
    }
  );

  // Delete avatar group
  app.delete(
    "/api/photo-avatars/groups/:groupId",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check and delete
        const deleted = await storage.deletePhotoAvatarGroup(groupId, userId);
        if (!deleted) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();
        await photoAvatarService.deleteAvatarGroup(groupId);

        res.json({ success: true });
      } catch (error) {
        console.error("Failed to delete avatar group:", error);
        res.status(500).json({ error: "Failed to delete avatar group" });
      }
    }
  );

  // Delete individual avatar
  app.delete("/api/photo-avatars/:avatarId", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { avatarId } = req.params;

      // First, try to find the avatar in the database (uploaded avatars)
      const dbAvatar = await storage.getPhotoAvatarByHeygenIdAndUser(
        avatarId,
        userId
      );

      // If not in database, verify ownership via group (AI-generated avatars)
      if (!dbAvatar) {
        console.log(
          "⚠️ Avatar not in database, checking group ownership via HeyGen API"
        );
        const photoAvatarService = new HeyGenPhotoAvatarService();

        try {
          // Get avatar details from HeyGen to find its group
          const avatarDetails = await photoAvatarService.getAvatarDetails(
            avatarId
          );
          const groupId = avatarDetails?.data?.group_id;

          if (!groupId) {
            return res.status(404).json({ error: "Avatar not found" });
          }

          // Verify user owns the group
          const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
            groupId,
            userId
          );
          if (!dbGroup) {
            return res.status(404).json({ error: "Avatar not found" });
          }

          console.log("✅ Group ownership verified for AI-generated avatar");
        } catch (error) {
          console.error("Failed to verify avatar ownership:", error);
          return res.status(404).json({ error: "Avatar not found" });
        }
      }

      console.log("🗑️ Deleting individual avatar:", avatarId);

      const photoAvatarService = new HeyGenPhotoAvatarService();
      await photoAvatarService.deleteIndividualAvatar(avatarId);

      // Delete from database if it exists there
      if (dbAvatar) {
        await storage.deletePhotoAvatar(avatarId, userId);
      }

      console.log("✅ Individual avatar deleted successfully");

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete individual avatar:", error);
      res.status(500).json({ error: "Failed to delete individual avatar" });
    }
  });

  // Edit/Generate new look with custom prompt
  app.post("/api/heygen/avatars/:groupId/generate-look", async (req, res) => {
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

      // Check training status first
      const photoAvatarService = new HeyGenPhotoAvatarService();
      try {
        const statusCheck = await photoAvatarService.checkTrainingStatus(
          groupId
        );
        console.log("📋 Avatar group training status:", statusCheck);

        if (statusCheck.status !== "ready") {
          return res.status(400).json({
            error: "Avatar group must be trained before generating looks",
            status: statusCheck.status,
            message: `Current status: ${statusCheck.status}. Please train the avatar group first using the 'Train Avatar' button.`,
          });
        }
      } catch (statusError) {
        console.error("Failed to check training status:", statusError);
        // Continue anyway - the generate call will fail with a better error if not trained
      }

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
      const errorMessage =
        error instanceof Error ? error.message : "Failed to edit look";

      // Check if it's a "model not found" error
      if (errorMessage.toLowerCase().includes("model not found")) {
        return res.status(400).json({
          error: "Avatar group not trained",
          message:
            "This avatar group must be TRAINED before you can generate new looks. Click the 'Train Avatar' button, wait for training to complete, then try again.",
        });
      }

      res.status(500).json({ error: errorMessage });
    }
  });

  // Add looks to existing avatar group
  app.post(
    "/api/photo-avatars/groups/:groupId/add-looks",
    requireAuth,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const userId = String(req.user?.id);
        const { imageKeys, name } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        // Ownership check
        const dbGroup = await storage.getPhotoAvatarGroupByHeygenIdAndUser(
          groupId,
          userId
        );
        if (!dbGroup) {
          return res.status(404).json({ error: "Avatar group not found" });
        }

        if (!imageKeys || !Array.isArray(imageKeys) || imageKeys.length === 0) {
          return res
            .status(400)
            .json({ error: "Image keys array is required" });
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
    }
  );

  // Add sound effect to photo avatar
  app.post(
    "/api/photo-avatars/:avatarId/add-sound-effect",
    requireAuth,
    async (req, res) => {
      try {
        const userId = String(req.user?.id);
        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        const { avatarId } = req.params;

        // Ownership validation: verify user owns a group containing this avatar
        const photoAvatarService = new HeyGenPhotoAvatarService();
        const allUserGroups = await storage.listPhotoAvatarGroups(userId);

        let ownsAvatar = false;

        for (const group of allUserGroups) {
          try {
            const looks = await photoAvatarService.getAvatarGroupLooks(
              group.heygenGroupId
            );
            if (
              looks.avatar_list &&
              looks.avatar_list.some((a: any) => a.id === avatarId)
            ) {
              ownsAvatar = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!ownsAvatar) {
          return res.status(404).json({ error: "Avatar not found" });
        }

        console.log("🔊 Adding sound effect to avatar:", avatarId);

        const result = await photoAvatarService.addSoundEffect(avatarId);

        // Get avatar name for notification
        let avatarName = "Avatar";
        try {
          const dbAvatar = await storage.getPhotoAvatarByHeygenIdAndUser(
            avatarId,
            userId
          );
          if (dbAvatar) {
            avatarName = dbAvatar.name || avatarName;
            await storage.updatePhotoAvatar(avatarId, userId, {
              status: "processing",
              metadata: { ...dbAvatar.metadata, background_sound_effect: true },
            });
          }
        } catch (e) {
          console.warn("Could not update avatar in database:", e);
        }

        // Send notification
        realtimeService.notifySoundEffectAdded(
          parseInt(userId),
          avatarId,
          avatarName
        );

        res.json(result);
      } catch (error) {
        console.error("Failed to add sound effect:", error);
        res.status(500).json({ error: "Failed to add sound effect" });
      }
    }
  );

  // Get avatar status (for checking motion/sound effect processing)
  app.get(
    "/api/photo-avatars/:avatarId/status",
    requireAuth,
    async (req, res) => {
      try {
        const userId = String(req.user?.id);
        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        const { avatarId } = req.params;

        // Ownership validation
        const dbAvatar = await storage.getPhotoAvatarByHeygenIdAndUser(
          avatarId,
          userId
        );
        if (!dbAvatar) {
          return res.status(404).json({ error: "Avatar not found" });
        }

        const photoAvatarService = new HeyGenPhotoAvatarService();
        const status = await photoAvatarService.getAvatarStatus(avatarId);

        // Update status in database if changed
        if (status.status && status.status !== dbAvatar.status) {
          await storage.updatePhotoAvatar(avatarId, userId, {
            status: status.status,
            metadata: { ...dbAvatar.metadata, ...status },
          });
        }

        res.json(status);
      } catch (error) {
        console.error("Failed to get avatar status:", error);
        res.status(500).json({ error: "Failed to get avatar status" });
      }
    }
  );

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

  // Upload video avatar footage (training/consent)
  app.post(
    "/api/upload/video-avatar-footage",
    requireAuth,
    videoUpload.single("video"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No video file provided" });
        }

        const { type } = req.body; // 'training' or 'consent'
        const userId = req.user?.id;

        console.log("🎥 Backend: Upload video avatar footage");
        console.log("🎥 Backend: Type:", type);
        console.log("🎥 Backend: File size:", req.file.size);

        // Validate file type
        if (!req.file.mimetype.startsWith("video/")) {
          return res.status(400).json({ error: "File must be a video" });
        }

        // Read file buffer
        const fileBuffer = fs.readFileSync(req.file.path);

        // Upload to S3
        const s3Service = new S3UploadService();
        const s3VideoUrl = await s3Service.uploadFile(
          userId,
          fileBuffer,
          `video-avatar-footage/${type}/${nanoid()}_${req.file.originalname}`,
          req.file.mimetype
        );

        console.log("✅ Video uploaded to S3:", s3VideoUrl);

        // Clean up temporary file
        fs.unlinkSync(req.file.path);

        res.json({
          url: s3VideoUrl,
          type,
          size: req.file.size,
        });
      } catch (error: any) {
        console.error("❌ Failed to upload video avatar footage:", error);
        res.status(500).json({
          error: "Failed to upload video",
          details: error?.message || String(error),
        });
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
              groupName: name,
              imageHash: imageHash || null,
              s3ImageUrl: s3ImageUrl || null,
              heygenImageKey: imageKeys[0], // Primary image key
              trainingStatus: "pending",
            });
            console.log("💾 Avatar group metadata saved to database");
          } catch (dbError) {
            console.error("⚠️ Failed to save avatar group metadata:", dbError);
            // Don't fail the request, just log the error
          }
        }

        // Don't auto-train - HeyGen needs time to process images first
        // Training will happen when user clicks "Train" button after images are ready
        console.log(
          "✅ Backend: Avatar group created, waiting for HeyGen to process images"
        );

        const responseData = {
          success: true,
          groupId: groupId,
          message:
            "Avatar group created. Waiting for HeyGen to process images before training.",
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

  // ==================== VIDEO AVATAR API ENDPOINTS (ENTERPRISE) ====================

  // Create video avatar from training footage
  app.post("/api/video-avatars", requireAuth, async (req, res) => {
    try {
      const { name, trainingVideoUrl, consentVideoUrl, voiceId } = req.body;
      const userId = req.user?.id;

      console.log("🎥 Backend: Create video avatar request received");
      console.log("🎥 Backend: Name:", name);
      console.log("🎥 Backend: Training video URL:", trainingVideoUrl);
      console.log("🎥 Backend: Consent video URL:", consentVideoUrl);
      console.log("🎥 Backend: Voice ID:", voiceId);

      if (!name || !trainingVideoUrl || !consentVideoUrl) {
        return res.status(400).json({
          error: "Name, training video URL, and consent video URL are required",
        });
      }

      const videoAvatarService = new HeyGenVideoAvatarService();

      // Validate training footage requirements
      try {
        await videoAvatarService.validateTrainingFootage(trainingVideoUrl);
        console.log("✅ Training footage validation passed");
      } catch (validationError: any) {
        console.error(
          "❌ Training footage validation failed:",
          validationError.message
        );
        return res.status(400).json({
          error: "Training footage validation failed",
          details: validationError.message,
        });
      }

      // Create video avatar
      const createRequest: any = {
        avatar_name: name,
        training_footage_url: trainingVideoUrl,
        video_consent_url: consentVideoUrl,
      };

      // Add optional callback URL if configured
      if (process.env.HEYGEN_WEBHOOK_URL) {
        createRequest.callback_url = process.env.HEYGEN_WEBHOOK_URL;
      }

      const result = await videoAvatarService.createVideoAvatar(createRequest);
      console.log("✅ Video avatar creation initiated:", result);

      // Save to database
      if (userId && result.data?.avatar_id) {
        try {
          await storage.createVideoAvatar({
            userId,
            heygenAvatarId: result.data.avatar_id,
            avatarName: name,
            trainingVideoUrl,
            consentVideoUrl,
            voiceId: voiceId || null,
            status: "in_progress",
          });
          console.log("💾 Video avatar metadata saved to database");
        } catch (dbError) {
          console.error("⚠️ Failed to save video avatar metadata:", dbError);
        }
      }

      res.json({
        success: true,
        avatarId: result.data?.avatar_id,
        status: result.data?.status || "in_progress",
        message:
          "Video avatar creation initiated. This may take several hours.",
      });
    } catch (error: any) {
      console.error("❌ Failed to create video avatar:", error);
      res.status(500).json({
        error: "Failed to create video avatar",
        details: error?.message || String(error),
      });
    }
  });

  // Check video avatar creation status
  app.get(
    "/api/video-avatars/:avatarId/status",
    requireAuth,
    async (req, res) => {
      try {
        const { avatarId } = req.params;
        console.log("🎥 Backend: Check video avatar status:", avatarId);

        const videoAvatarService = new HeyGenVideoAvatarService();
        const status = await videoAvatarService.checkVideoAvatarStatus(
          avatarId
        );

        console.log("✅ Video avatar status:", status);

        // Update database if status changed
        const userId = req.user?.id;
        if (
          userId &&
          (status.status === "complete" || status.status === "failed")
        ) {
          try {
            await storage.updateVideoAvatarStatus(
              userId,
              avatarId,
              status.status,
              status.error_message
            );
            console.log("💾 Video avatar status updated in database");
          } catch (dbError) {
            console.error("⚠️ Failed to update video avatar status:", dbError);
          }
        }

        res.json(status);
      } catch (error: any) {
        console.error("❌ Failed to check video avatar status:", error);
        res.status(500).json({
          error: "Failed to check video avatar status",
          details: error?.message || String(error),
        });
      }
    }
  );

  // List all video avatars
  app.get("/api/video-avatars", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      console.log("🎥 Backend: List video avatars for user:", userId);

      // Get from database instead of HeyGen API
      const avatars = await storage.listVideoAvatars(userId);

      console.log("✅ Video avatars retrieved:", avatars.length);
      res.json(avatars);
    } catch (error: any) {
      console.error("❌ Failed to list video avatars:", error);
      res.status(500).json({
        error: "Failed to list video avatars",
        details: error?.message || String(error),
      });
    }
  });

  // Delete video avatar
  app.delete("/api/video-avatars/:avatarId", requireAuth, async (req, res) => {
    try {
      const { avatarId } = req.params;
      const userId = req.user?.id;

      console.log("🎥 Backend: Delete video avatar:", avatarId);

      const videoAvatarService = new HeyGenVideoAvatarService();
      await videoAvatarService.deleteVideoAvatar(avatarId);

      console.log("✅ Video avatar deleted from HeyGen");

      // Delete from database
      if (userId) {
        try {
          await storage.deleteVideoAvatar(userId, avatarId);
          console.log("💾 Video avatar deleted from database");
        } catch (dbError) {
          console.error(
            "⚠️ Failed to delete video avatar from database:",
            dbError
          );
        }
      }

      res.json({
        success: true,
        message: "Video avatar deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ Failed to delete video avatar:", error);
      res.status(500).json({
        error: "Failed to delete video avatar",
        details: error?.message || String(error),
      });
    }
  });

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

      // Validate that we got a video_id from HeyGen
      if (!result.data?.video_id) {
        console.error("❌ Backend: HeyGen did not return a video_id");
        return res.status(500).json({
          error: "Video generation failed - no video ID received",
        });
      }

      // Save video to database
      const user = (req as any).user;
      const videoRecord = await storage.createVideoContent({
        userId: String(user.id),
        avatarId,
        title: title || "Generated Video",
        script,
        status: "generating",
        metadata: {
          heygenVideoId: result.data.video_id,
          test,
          voiceSpeed,
          voiceId: finalVoiceId,
          audioAssetId,
        },
      });

      console.log("💾 Backend: Saved video to database:", videoRecord.id);

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

      // If video is completed, update database first with HeyGen URLs
      if (status.status === "completed" && status.video_url && userId) {
        // Find and update the database record
        try {
          const allVideos = await storage.getVideoContent(String(userId));
          const videoRecord = allVideos.find(
            (v: any) =>
              v.metadata &&
              typeof v.metadata === "object" &&
              "heygenVideoId" in v.metadata &&
              v.metadata.heygenVideoId === videoId
          );

          if (videoRecord) {
            // First, mark video as ready with HeyGen URLs
            await storage.updateVideoContent(videoRecord.id, {
              status: "ready",
              videoUrl: status.video_url,
              thumbnailUrl: status.thumbnail_url,
            });
            console.log(
              "💾 Backend: Updated video record with HeyGen URLs:",
              videoRecord.id
            );

            // Then attempt S3 backup (optional enhancement)
            try {
              console.log("💾 Backend: Attempting S3 backup...");

              // Download video from HeyGen CDN
              const videoResponse = await fetch(status.video_url);
              if (videoResponse.ok) {
                const videoBuffer = Buffer.from(
                  await videoResponse.arrayBuffer()
                );

                // Upload to S3
                const s3Service = new S3UploadService();
                const s3VideoUrl = await s3Service.uploadFile(
                  userId,
                  videoBuffer,
                  `generated-videos/${videoId}.mp4`,
                  "video/mp4"
                );

                console.log("✅ Backend: Video backed up to S3:", s3VideoUrl);
                response.s3_video_url = s3VideoUrl;

                // Download and backup thumbnail if available
                let s3ThumbnailUrl = null;
                if (status.thumbnail_url) {
                  try {
                    const thumbnailResponse = await fetch(status.thumbnail_url);
                    if (thumbnailResponse.ok) {
                      const thumbnailBuffer = Buffer.from(
                        await thumbnailResponse.arrayBuffer()
                      );
                      s3ThumbnailUrl = await s3Service.uploadFile(
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

                // Update database with S3 URLs (enhancement)
                await storage.updateVideoContent(videoRecord.id, {
                  videoUrl: s3VideoUrl,
                  thumbnailUrl: s3ThumbnailUrl || status.thumbnail_url,
                });
                console.log(
                  "💾 Backend: Updated video record with S3 URLs:",
                  videoRecord.id
                );
              }
            } catch (backupError) {
              console.error(
                "⚠️ Backend: S3 backup failed, HeyGen URLs still available:",
                backupError
              );
            }
          }
        } catch (dbError) {
          console.error("⚠️ Backend: Database update failed:", dbError);
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

  // Get all user videos from database
  app.get("/api/videos", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const status = req.query.status as string | undefined;

      console.log(
        "📹 Backend: Getting videos for user:",
        userId,
        "status filter:",
        status
      );

      const videos = await storage.getVideoContent(String(userId), status);

      // Ensure all video URLs are properly formatted
      const videosWithUrls = videos.map((video) => ({
        ...video,
        videoUrl: ensureS3Url(video.videoUrl),
        thumbnailUrl: ensureS3Url(video.thumbnailUrl),
      }));

      console.log("✅ Backend: Found", videos.length, "videos");
      res.json(videosWithUrls);
    } catch (error: any) {
      console.error("❌ Backend: Failed to get videos");
      console.error("❌ Backend: Error message:", error?.message);
      res.status(500).json({
        error: "Failed to get videos",
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

  // Get template details
  app.get("/api/templates/:templateId", async (req, res) => {
    try {
      const { templateId } = req.params;

      const templateService = new HeyGenTemplateService();
      const template = await templateService.getTemplate(templateId);

      res.json(template);
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

  // Get real estate templates
  app.get("/api/templates/real-estate", async (req, res) => {
    try {
      const templateService = new HeyGenTemplateService();
      const templates = await templateService.getRealEstateTemplates();

      res.json(templates);
    } catch (error) {
      console.error("Failed to get real estate templates:", error);
      // Return suggestions when HeyGen API is not available
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
  app.put("/api/brand-settings", requireAuth, async (req, res) => {
    try {
      const user = await resolveMemStorageUser(req);
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const {
        assets,
        colors,
        fonts,
        description,
        socialConnections,
        logoInfo,
      } = req.body;

      // Validate the payload using Zod schema (partial to allow updates)
      const validationResult = insertBrandSettingsSchema.partial().safeParse({
        userId: user.id,
        assets,
        colors,
        fonts,
        description,
        socialConnections,
        logoInfo,
      });

      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid brand settings data",
          details: validationResult.error.errors,
        });
      }

      // Save to database using storage interface
      const brandSettings = await storage.upsertBrandSettings({
        userId: user.id,
        assets: assets || null,
        colors: colors || null,
        fonts: fonts || null,
        description: description || null,
        socialConnections: socialConnections || null,
        logoInfo: logoInfo || null,
      });

      console.log(`✅ Brand settings saved for user ${user.id}`);

      res.json({
        success: true,
        message: "Brand settings saved successfully",
        data: brandSettings,
      });
    } catch (error) {
      console.error("Error saving brand settings:", error);
      res.status(500).json({ error: "Failed to save brand settings" });
    }
  });

  // Get brand settings
  app.get("/api/brand-settings", requireAuth, async (req, res) => {
    try {
      const user = await resolveMemStorageUser(req);
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Fetch from database
      const brandSettings = await storage.getBrandSettings(user.id);

      // If no settings exist, return defaults
      if (!brandSettings) {
        const defaultBrandSettings = {
          assets: [
            { id: "primary-logo", name: "Primary Logo", type: "logo" },
            { id: "icon", name: "Icon/Favicon", type: "icon" },
            { id: "banner", name: "Banner/Header Image", type: "banner" },
            {
              id: "background",
              name: "Background Pattern",
              type: "background",
            },
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
        return res.json(defaultBrandSettings);
      }

      // Return the saved settings
      res.json({
        assets: brandSettings.assets || [],
        colors: brandSettings.colors || {},
        fonts: brandSettings.fonts || {},
        description: brandSettings.description || "",
        socialConnections: brandSettings.socialConnections || {},
        logoInfo: brandSettings.logoInfo || null,
      });
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

      // Convert S3 paths to full URLs (handle both keys and existing URLs)
      const s3Service = new S3UploadService();
      const videosWithUrls = videos.map((video) => ({
        ...video,
        videoUrl: video.videoUrl.startsWith("http")
          ? video.videoUrl
          : s3Service.getS3Url(video.videoUrl),
        thumbnailUrl: video.thumbnailUrl
          ? video.thumbnailUrl.startsWith("http")
            ? video.thumbnailUrl
            : s3Service.getS3Url(video.thumbnailUrl)
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

  // =====================================================
  // COMPANY PROFILE ROUTES
  // =====================================================

  // Get company profile
  app.get("/api/company/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile = await storage.getCompanyProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ error: "Failed to fetch company profile" });
    }
  });

  // Create or update company profile
  app.post("/api/company/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate request body
      const validation = insertCompanyProfileSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid company profile data",
          details: validation.error.errors,
        });
      }

      const profile = await storage.upsertCompanyProfile(validation.data);
      res.json(profile);
    } catch (error) {
      console.error("Error saving company profile:", error);
      res.status(500).json({ error: "Failed to save company profile" });
    }
  });

  // Import company profile from template or external app (for iframe embedding)
  app.post("/api/company/profile/import", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log("📥 Importing company profile template for user:", userId);

      // Accept template data from external app or manual import
      const templateData = req.body;

      // Validate and merge with userId
      const validation = insertCompanyProfileSchema.safeParse({
        ...templateData,
        userId,
      });

      if (!validation.success) {
        console.error(
          "❌ Template validation failed:",
          validation.error.errors
        );
        return res.status(400).json({
          error: "Invalid template data",
          details: validation.error.errors,
        });
      }

      const profile = await storage.upsertCompanyProfile(validation.data);
      console.log("✅ Company profile imported successfully");

      res.json({
        success: true,
        profile,
        message: "Company profile imported successfully",
      });
    } catch (error) {
      console.error("Error importing company profile:", error);
      res.status(500).json({ error: "Failed to import company profile" });
    }
  });

  // Serve uploaded files statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // ====================================
  // ENGAGEMENT TRACKING & ANALYTICS ENDPOINTS
  // ====================================

  // Track user session
  app.post("/api/track/session", async (req, res) => {
    try {
      const { sessionId, agentSlug, pageVisited, deviceType } = req.body;

      if (!sessionId || !agentSlug) {
        return res
          .status(400)
          .json({ error: "sessionId and agentSlug are required" });
      }

      // Import tracking schemas
      const { userSessions } = await import("@shared/schema");
      const { sql: drizzleSql, eq, and } = await import("drizzle-orm");

      // Check if session exists
      const existing = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.sessionId, sessionId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing session
        await db
          .update(userSessions)
          .set({
            lastPageVisited: pageVisited,
            totalPageViews: drizzleSql`${userSessions.totalPageViews} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(userSessions.sessionId, sessionId));
      } else {
        // Create new session
        await db.insert(userSessions).values({
          sessionId,
          agentSlug,
          firstPageVisited: pageVisited || "/",
          lastPageVisited: pageVisited || "/",
          deviceType: deviceType || "desktop",
          ipAddress: (req.ip || "").substring(0, 50),
          userAgent: (req.get("user-agent") || "").substring(0, 500),
          totalPageViews: 1,
          isActive: true,
        });
      }

      res.json({ success: true, sessionId });
    } catch (error) {
      console.error("❌ Error tracking session:", error);
      res.status(500).json({ error: "Failed to track session" });
    }
  });

  // Track property interaction
  app.post("/api/track/property-interaction", async (req, res) => {
    try {
      const {
        sessionId,
        agentSlug,
        propertyId,
        interactionType,
        interactionValue,
        timeSpentSeconds,
        currentUrl,
      } = req.body;

      if (!agentSlug || !interactionType) {
        return res
          .status(400)
          .json({ error: "agentSlug and interactionType are required" });
      }

      const { propertyInteractions, userSessions } = await import(
        "@shared/schema"
      );
      const { sql: drizzleSql, eq } = await import("drizzle-orm");

      // Track the interaction
      await db.insert(propertyInteractions).values({
        propertyId: propertyId || null,
        agentSlug,
        interactionType,
        interactionValue: interactionValue || null,
        timeSpentSeconds: timeSpentSeconds || 0,
        currentUrl: currentUrl || null,
        sessionId: sessionId || null,
        ipAddress: (req.ip || "").substring(0, 50),
        userAgent: (req.get("user-agent") || "").substring(0, 500),
      });

      // Update session counters if applicable
      if (sessionId) {
        if (interactionType === "view" && propertyId) {
          await db
            .update(userSessions)
            .set({
              totalPropertiesViewed: drizzleSql`${userSessions.totalPropertiesViewed} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(userSessions.sessionId, sessionId));
        }

        if (timeSpentSeconds && timeSpentSeconds > 0) {
          await db
            .update(userSessions)
            .set({
              totalTimeSpentSeconds: drizzleSql`${userSessions.totalTimeSpentSeconds} + ${timeSpentSeconds}`,
              updatedAt: new Date(),
            })
            .where(eq(userSessions.sessionId, sessionId));
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error tracking interaction:", error);
      res.status(500).json({ error: "Failed to track interaction" });
    }
  });

  // Track property like
  app.post("/api/track/property-like", async (req, res) => {
    try {
      const { sessionId, agentSlug, propertyId, liked } = req.body;

      if (!agentSlug || !propertyId) {
        return res
          .status(400)
          .json({ error: "agentSlug and propertyId are required" });
      }

      const { propertyLikes, userSessions } = await import("@shared/schema");
      const { eq, and, sql: drizzleSql } = await import("drizzle-orm");

      if (liked) {
        // Add like
        await db.insert(propertyLikes).values({
          propertyId,
          agentSlug,
          sessionId: sessionId || null,
          ipAddress: (req.ip || "").substring(0, 50),
          userAgent: (req.get("user-agent") || "").substring(0, 500),
        });

        // Update session counter
        if (sessionId) {
          await db
            .update(userSessions)
            .set({
              totalPropertiesLiked: drizzleSql`${userSessions.totalPropertiesLiked} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(userSessions.sessionId, sessionId));
        }
      } else {
        // Remove like
        const conditions = [eq(propertyLikes.propertyId, propertyId)];
        if (sessionId) {
          conditions.push(eq(propertyLikes.sessionId, sessionId));
        }

        await db.delete(propertyLikes).where(and(...conditions));

        // Update session counter
        if (sessionId) {
          await db
            .update(userSessions)
            .set({
              totalPropertiesLiked: drizzleSql`GREATEST(${userSessions.totalPropertiesLiked} - 1, 0)`,
              updatedAt: new Date(),
            })
            .where(eq(userSessions.sessionId, sessionId));
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error tracking like:", error);
      res.status(500).json({ error: "Failed to track like" });
    }
  });

  // Generate engagement lead
  app.post("/api/track/generate-engagement-lead", async (req, res) => {
    try {
      const { sessionId, agentSlug } = req.body;

      if (!sessionId || !agentSlug) {
        return res
          .status(400)
          .json({ error: "sessionId and agentSlug required" });
      }

      const {
        engagementLeads,
        userSessions,
        propertyInteractions,
        propertyLikes,
      } = await import("@shared/schema");
      const { eq, and, sql: drizzleSql, desc } = await import("drizzle-orm");

      // Check if lead already exists for this session
      const existingLead = await db
        .select()
        .from(engagementLeads)
        .where(eq(engagementLeads.sessionId, sessionId))
        .limit(1);

      if (existingLead.length > 0) {
        return res.json({
          success: true,
          leadId: existingLead[0].id,
          alreadyExists: true,
        });
      }

      // Get session data
      const session = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.sessionId, sessionId))
        .limit(1);

      if (session.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Calculate engagement score
      const sessionData = session[0];
      let score = 0;

      if (sessionData.totalTimeSpentSeconds > 300) score += 20;
      if (sessionData.totalPropertiesViewed > 3) score += 15;
      if (sessionData.totalPropertiesLiked > 0)
        score += sessionData.totalPropertiesLiked * 10;

      // Get liked properties
      const likedProps = await db
        .select()
        .from(propertyLikes)
        .where(eq(propertyLikes.sessionId, sessionId));

      const likedPropertyIds = likedProps.map((p) => p.propertyId);

      // Determine reason
      let reason = "high_engagement";
      if (sessionData.totalPropertiesLiked >= 2)
        reason = "liked_multiple_properties";
      else if (sessionData.totalTimeSpentSeconds > 600)
        reason = "spent_long_time_on_site";
      else if (sessionData.totalPropertiesViewed > 5)
        reason = "viewed_many_properties";

      // Determine quality
      let quality = "warm";
      if (score >= 40) quality = "hot";
      else if (score < 25) quality = "cold";

      // Create engagement lead
      const lead = await db
        .insert(engagementLeads)
        .values({
          sessionId,
          agentSlug,
          engagementScore: score,
          engagementReason: reason,
          engagementDetails: {
            timeSpent: sessionData.totalTimeSpentSeconds,
            propertiesViewed: sessionData.totalPropertiesViewed,
            propertiesLiked: sessionData.totalPropertiesLiked,
          },
          likedPropertyIds:
            likedPropertyIds.length > 0 ? likedPropertyIds : null,
          leadQuality: quality,
          leadStatus: "auto_generated",
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
        })
        .returning();

      console.log(
        `✅ Generated ${quality} lead for session ${sessionId} (score: ${score})`
      );

      res.json({ success: true, leadId: lead[0].id, score, quality });
    } catch (error) {
      console.error("❌ Error generating engagement lead:", error);
      res.status(500).json({ error: "Failed to generate lead" });
    }
  });

  // ====================================
  // ANALYTICS ENDPOINTS
  // ====================================

  // Get engagement overview for agent
  app.get("/api/analytics/engagement/:agentSlug", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const {
        userSessions,
        propertyInteractions,
        propertyLikes,
        engagementLeads,
      } = await import("@shared/schema");
      const {
        eq,
        and,
        gte,
        sql: drizzleSql,
        count,
      } = await import("drizzle-orm");

      // Get date range (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Total sessions
      const totalSessionsResult = await db
        .select({ count: count() })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.agentSlug, agentSlug),
            gte(userSessions.createdAt, thirtyDaysAgo)
          )
        );

      // Active sessions (visited in last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const activeSessionsResult = await db
        .select({ count: count() })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.agentSlug, agentSlug),
            eq(userSessions.isActive, true),
            gte(userSessions.updatedAt, oneDayAgo)
          )
        );

      // Total property views
      const propertyViewsResult = await db
        .select({ count: count() })
        .from(propertyInteractions)
        .where(
          and(
            eq(propertyInteractions.agentSlug, agentSlug),
            eq(propertyInteractions.interactionType, "view"),
            gte(propertyInteractions.createdAt, thirtyDaysAgo)
          )
        );

      // Total likes
      const likesResult = await db
        .select({ count: count() })
        .from(propertyLikes)
        .where(
          and(
            eq(propertyLikes.agentSlug, agentSlug),
            gte(propertyLikes.createdAt, thirtyDaysAgo)
          )
        );

      // Total engagement leads
      const leadsResult = await db
        .select({ count: count() })
        .from(engagementLeads)
        .where(
          and(
            eq(engagementLeads.agentSlug, agentSlug),
            gte(engagementLeads.createdAt, thirtyDaysAgo)
          )
        );

      // Hot leads (score >= 40)
      const hotLeadsResult = await db
        .select({ count: count() })
        .from(engagementLeads)
        .where(
          and(
            eq(engagementLeads.agentSlug, agentSlug),
            eq(engagementLeads.leadQuality, "hot"),
            gte(engagementLeads.createdAt, thirtyDaysAgo)
          )
        );

      // Average session time
      const avgTimeResult = await db
        .select({
          avgTime: drizzleSql<number>`AVG(${userSessions.totalTimeSpentSeconds})`,
        })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.agentSlug, agentSlug),
            gte(userSessions.createdAt, thirtyDaysAgo)
          )
        );

      res.json({
        totalSessions: totalSessionsResult[0]?.count || 0,
        activeSessions: activeSessionsResult[0]?.count || 0,
        totalPropertyViews: propertyViewsResult[0]?.count || 0,
        totalLikes: likesResult[0]?.count || 0,
        totalLeads: leadsResult[0]?.count || 0,
        hotLeads: hotLeadsResult[0]?.count || 0,
        averageSessionTime: Math.round(avgTimeResult[0]?.avgTime || 0),
      });
    } catch (error) {
      console.error("❌ Error fetching engagement analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Get recent engagement leads
  app.get("/api/analytics/leads/:agentSlug", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      const { engagementLeads } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const leads = await db
        .select()
        .from(engagementLeads)
        .where(eq(engagementLeads.agentSlug, agentSlug))
        .orderBy(desc(engagementLeads.createdAt))
        .limit(limit);

      res.json(leads);
    } catch (error) {
      console.error("❌ Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get property engagement stats
  app.get("/api/analytics/properties/:agentSlug", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const { propertyInteractions, propertyLikes } = await import(
        "@shared/schema"
      );
      const { eq, and, sql: drizzleSql } = await import("drizzle-orm");

      // Get top properties by views
      const topViewed = await db
        .select({
          propertyId: propertyInteractions.propertyId,
          viewCount: drizzleSql<number>`COUNT(*)`,
          totalTimeSpent: drizzleSql<number>`SUM(${propertyInteractions.timeSpentSeconds})`,
        })
        .from(propertyInteractions)
        .where(
          and(
            eq(propertyInteractions.agentSlug, agentSlug),
            eq(propertyInteractions.interactionType, "view")
          )
        )
        .groupBy(propertyInteractions.propertyId)
        .orderBy(drizzleSql`COUNT(*) DESC`)
        .limit(10);

      // Get like counts
      const likeCounts = await db
        .select({
          propertyId: propertyLikes.propertyId,
          likeCount: drizzleSql<number>`COUNT(*)`,
        })
        .from(propertyLikes)
        .where(eq(propertyLikes.agentSlug, agentSlug))
        .groupBy(propertyLikes.propertyId);

      res.json({
        topViewed,
        likeCounts,
      });
    } catch (error) {
      console.error("❌ Error fetching property analytics:", error);
      res.status(500).json({ error: "Failed to fetch property analytics" });
    }
  });

  // Get session details
  app.get("/api/analytics/sessions/:agentSlug", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const { userSessions } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const sessions = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.agentSlug, agentSlug))
        .orderBy(desc(userSessions.updatedAt))
        .limit(limit);

      res.json(sessions);
    } catch (error) {
      console.error("❌ Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // ==================== UNIFIED MEDIA LIBRARY ENDPOINTS ====================

  // Get all media (unified: media_assets + video_content)
  app.get("/api/media", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const typeFilter = req.query.type as string | undefined;

      console.log(
        "📚 Backend: Getting unified media library for user:",
        userId
      );

      // Get media assets from media_assets table
      const mediaAssets = await storage.getMediaAssets(
        String(userId),
        typeFilter
      );

      // Get generated videos from video_content table and transform to media format
      const videos = await storage.getVideoContent(String(userId), "ready");

      // Transform videos to media asset format with proper S3 URLs
      const videoAssets = videos.map((video) => ({
        id: video.id,
        userId: video.userId,
        type: "video" as const,
        source: "heygen" as const,
        url: ensureS3Url(video.videoUrl) || "",
        thumbnailUrl: ensureS3Url(video.thumbnailUrl),
        title: video.title,
        description: video.script?.substring(0, 200) || null,
        avatarId: video.avatarId || null,
        fileSize: null,
        mimeType: "video/mp4",
        width: null,
        height: null,
        duration: video.duration || null,
        metadata: video.metadata || null,
        createdAt: video.createdAt || new Date().toISOString(),
      }));

      // Combine and sort by creation date (newest first)
      const allMedia = [...mediaAssets, ...videoAssets].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Apply type filter if specified
      const filteredMedia =
        typeFilter && typeFilter !== "all"
          ? allMedia.filter((item) => item.type === typeFilter)
          : allMedia;

      console.log(
        `✅ Backend: Found ${filteredMedia.length} media items (${mediaAssets.length} assets + ${videoAssets.length} videos)`
      );
      res.json(filteredMedia);
    } catch (error: any) {
      console.error("❌ Backend: Failed to get media library");
      console.error("❌ Backend: Error message:", error?.message);
      res.status(500).json({
        error: "Failed to get media library",
        details: error?.message || String(error),
      });
    }
  });

  // Upload media to library
  app.post(
    "/api/media/upload",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      try {
        const userId = req.user?.id;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: "No file provided" });
        }

        console.log(
          "📤 Backend: Uploading media to library:",
          file.originalname
        );

        const type =
          req.body.type ||
          (file.mimetype.startsWith("video/") ? "video" : "photo");
        const source = req.body.source || "upload";

        // Upload to S3 if configured
        let fileUrl = "";
        let thumbnailUrl = null;

        if (
          process.env.AWS_ACCESS_KEY_ID &&
          process.env.AWS_SECRET_ACCESS_KEY
        ) {
          const s3Service = new S3UploadService();
          const fileBuffer = await fs.promises.readFile(file.path);
          fileUrl = await s3Service.uploadFile(
            parseInt(userId!),
            fileBuffer,
            `${Date.now()}-${file.originalname}`,
            file.mimetype
          );
        } else {
          // Use local file path if S3 not configured
          fileUrl = `/uploads/${file.filename}`;
        }

        // Create media asset record
        const mediaAsset = await storage.createMediaAsset({
          userId: String(userId),
          type,
          source,
          url: fileUrl,
          thumbnailUrl,
          title: req.body.title || file.originalname,
          description: req.body.description || null,
          avatarId: req.body.avatarId || null,
          mimeType: file.mimetype,
          fileSize: file.size,
          width: null,
          height: null,
          durationSeconds: null,
          metadata: null,
        });

        console.log("✅ Backend: Media uploaded successfully:", mediaAsset.id);
        res.json(mediaAsset);
      } catch (error: any) {
        console.error("❌ Backend: Failed to upload media");
        console.error("❌ Backend: Error message:", error?.message);
        res.status(500).json({
          error: "Failed to upload media",
          details: error?.message || String(error),
        });
      }
    }
  );

  // Get specific media item
  app.get("/api/media/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      console.log("📚 Backend: Getting media item:", id);

      // Try media_assets first
      const mediaAsset = await storage.getMediaAssetById(id);

      if (mediaAsset) {
        console.log("✅ Backend: Found media asset");
        return res.json(mediaAsset);
      }

      // Try video_content table
      const video = await storage.getVideoById(id);

      if (video && video.status === "ready") {
        // Transform to media format
        const videoAsset = {
          id: video.id,
          userId: video.userId,
          type: "video" as const,
          source: "heygen" as const,
          url: video.videoUrl || "",
          thumbnailUrl: video.thumbnailUrl || null,
          title: video.title,
          description: video.script?.substring(0, 200) || null,
          avatarId: video.avatarId || null,
          fileSize: null,
          mimeType: "video/mp4",
          width: null,
          height: null,
          duration: video.duration || null,
          metadata: video.metadata || null,
          createdAt: video.createdAt || new Date().toISOString(),
        };

        console.log("✅ Backend: Found video content");
        return res.json(videoAsset);
      }

      res.status(404).json({ error: "Media not found" });
    } catch (error: any) {
      console.error("❌ Backend: Failed to get media");
      console.error("❌ Backend: Error message:", error?.message);
      res.status(500).json({
        error: "Failed to get media",
        details: error?.message || String(error),
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
