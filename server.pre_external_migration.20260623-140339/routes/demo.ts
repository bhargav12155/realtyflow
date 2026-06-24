import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { users, properties, scheduledPosts, avatars, socialMediaAccounts, photoAvatarGroups, photoAvatars } from "../../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateToken } from "../middleware/auth";

const router = Router();

const DEMO_PROPERTY_IMAGE = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800";

const DEMO_PROPERTIES = [
  {
    mlsId: "DEMO-001",
    listPrice: 475000,
    address: "1234 Maple Street",
    city: "Omaha",
    state: "NE",
    zipCode: "68154",
    bedrooms: 4,
    bathrooms: 3.5,
    squareFootage: 3200,
    lotSize: 0.35,
    yearBuilt: 2018,
    propertyType: "Single Family",
    listingStatus: "Active",
    listingDate: new Date("2024-11-01"),
    description: "Stunning modern home in highly sought-after Westside neighborhood. Features open floor plan, gourmet kitchen with granite counters, hardwood floors throughout, and finished basement with wet bar.",
    features: ["Open Floor Plan", "Granite Counters", "Hardwood Floors", "Finished Basement", "3-Car Garage", "Smart Home"],
    photoUrls: [DEMO_PROPERTY_IMAGE],
    neighborhood: "Westside",
    schoolDistrict: "Westside Community Schools",
    agentName: "Demo Agent",
  },
  {
    mlsId: "DEMO-002",
    listPrice: 325000,
    address: "5678 Oak Lane",
    city: "Omaha",
    state: "NE",
    zipCode: "68116",
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 1850,
    lotSize: 0.25,
    yearBuilt: 2010,
    propertyType: "Single Family",
    listingStatus: "Active",
    listingDate: new Date("2024-11-15"),
    description: "Charming ranch home perfect for first-time buyers. Updated kitchen, spacious backyard, and convenient location near shopping and restaurants.",
    features: ["Ranch Style", "Updated Kitchen", "Fenced Yard", "2-Car Garage", "Near Schools"],
    photoUrls: [DEMO_PROPERTY_IMAGE],
    neighborhood: "Millard",
    schoolDistrict: "Millard Public Schools",
    agentName: "Demo Agent",
  },
  {
    mlsId: "DEMO-003",
    listPrice: 675000,
    address: "9012 Executive Drive",
    city: "Omaha",
    state: "NE",
    zipCode: "68022",
    bedrooms: 5,
    bathrooms: 4,
    squareFootage: 4500,
    lotSize: 0.5,
    yearBuilt: 2020,
    propertyType: "Single Family",
    listingStatus: "Active",
    listingDate: new Date("2024-12-01"),
    description: "Luxury executive home in premier Elkhorn location. Custom finishes throughout, chef's kitchen, theater room, wine cellar, and resort-style backyard with pool.",
    features: ["Custom Home", "Pool", "Theater Room", "Wine Cellar", "Chef's Kitchen", "4-Car Garage"],
    photoUrls: [DEMO_PROPERTY_IMAGE],
    neighborhood: "Elkhorn",
    schoolDistrict: "Elkhorn Public Schools",
    agentName: "Demo Agent",
  },
];

const DEMO_SCHEDULED_POSTS = [
  {
    platform: "facebook",
    postType: "just_listed",
    content: "🏡 Just Listed! Beautiful 4BR/3.5BA home in Westside at $475,000. Open floor plan, gourmet kitchen, finished basement. Schedule your showing today! #OmahaRealEstate #JustListed",
    hashtags: ["OmahaRealEstate", "JustListed", "WestsideHomes"],
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "pending",
    isAiGenerated: true,
    neighborhood: "Westside",
    seoScore: 85,
  },
  {
    platform: "instagram",
    postType: "market_update",
    content: "📊 Omaha Market Update: Home prices up 5% this quarter. Great time to list! DM for a free home valuation.",
    hashtags: ["OmahaRealEstate", "MarketUpdate", "RealEstateAgent"],
    scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000),
    status: "pending",
    isAiGenerated: true,
    neighborhood: "Omaha Metro",
    seoScore: 78,
  },
  {
    platform: "linkedin",
    postType: "open_house",
    content: "Join us this Sunday for an Open House at 1234 Maple Street in Westside! 1-4 PM. This stunning 4BR home won't last long.",
    hashtags: ["OpenHouse", "OmahaRealEstate", "BHHS"],
    scheduledFor: new Date(Date.now() + 72 * 60 * 60 * 1000),
    status: "approved",
    isAiGenerated: false,
    neighborhood: "Westside",
    seoScore: 72,
  },
  {
    platform: "x",
    postType: "tip",
    content: "🔑 Buying tip: Get pre-approved before house hunting to show sellers you're serious! #RealEstateTips #HomeBuyers",
    hashtags: ["RealEstateTips", "HomeBuyers", "OmahaRealEstate"],
    scheduledFor: new Date(Date.now() + 96 * 60 * 60 * 1000),
    status: "pending",
    isAiGenerated: true,
    neighborhood: null,
    seoScore: 90,
  },
];

const getAvatarTemplates = (uniqueId: string) => [
  {
    name: "Professional Agent - Business",
    heygenAvatarId: `demo-avatar-professional-${uniqueId}`,
    avatarType: "talking_photo",
    gender: "female",
    previewImageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
    isPublic: false,
    supportsGestures: false,
  },
  {
    name: "Casual Agent - Friendly",
    heygenAvatarId: `demo-avatar-casual-${uniqueId}`,
    avatarType: "talking_photo",
    gender: "male",
    previewImageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400",
    isPublic: false,
    supportsGestures: false,
  },
  {
    name: "Virtual Tour Guide",
    heygenAvatarId: `demo-avatar-tour-${uniqueId}`,
    avatarType: "public",
    gender: "female",
    previewImageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400",
    isPublic: true,
    supportsGestures: true,
  },
];

const getPhotoAvatarGroupTemplates = (userId: string) => [
  {
    userId,
    groupName: "Professional Headshots",
    heygenGroupId: `demo-group-professional-${userId}`,
    trainingStatus: "completed",
    s3ImageUrl: "/attached_assets/demo-avatar-preview.jpg",
  },
  {
    userId,
    groupName: "Casual Style",
    heygenGroupId: `demo-group-casual-${userId}`,
    trainingStatus: "completed",
    s3ImageUrl: "/attached_assets/demo-avatar-preview.jpg",
  },
];

const getPhotoAvatarLooksTemplates = (groupId: string, groupIndex: number) => {
  const demoImage = "/attached_assets/demo-avatar-preview.jpg";
  
  return [0, 1, 2].map((i) => ({
    groupId,
    photoUrl: demoImage,
    heygenPhotoId: `demo-look-${groupId}-${i}`,
    poseType: i === 0 ? "front" : i === 1 ? "side" : "angle",
    processingStatus: "completed",
  }));
};

const DEMO_SOCIAL_ACCOUNTS = [
  {
    platform: "facebook",
    isConnected: true,
    accountUsername: "Nebraska Home Hub",
  },
  {
    platform: "instagram",
    isConnected: true,
    accountUsername: "@nebraskahomehub",
  },
  {
    platform: "linkedin",
    isConnected: true,
    accountUsername: "Nebraska Home Hub Real Estate",
  },
  {
    platform: "x",
    isConnected: true,
    accountUsername: "@NebraskaHomeHub",
  },
  {
    platform: "youtube",
    isConnected: true,
    accountUsername: "Nebraska Home Hub Channel",
  },
  {
    platform: "tiktok",
    isConnected: true,
    accountUsername: "@nebraskahomehub",
  },
];

/**
 * POST /api/demo/create
 * Create a new demo account with pre-populated data
 */
router.post("/create", async (req: Request, res: Response) => {
  try {
    console.log("📱 [DEMO] Starting demo account creation...");
    
    const demoUsername = `demo_${Date.now()}`;
    const demoPassword = await bcrypt.hash("demo123", 10);
    
    console.log("📱 [DEMO] Creating user:", demoUsername);
    
    const [demoUser] = await db.insert(users).values({
      username: demoUsername,
      password: demoPassword,
      name: "Demo Agent",
      email: `${demoUsername}@demo.nebraskahomehub.com`,
      role: "agent",
      isDemo: true,
    }).returning();
    
    console.log("📱 [DEMO] User created with id:", demoUser.id);

    const userId = demoUser.id;

    console.log("📱 [DEMO] Inserting demo properties...");
    await db.insert(properties).values(
      DEMO_PROPERTIES.map(p => ({ ...p, agentId: userId }))
    );
    console.log("📱 [DEMO] Properties inserted");

    console.log("📱 [DEMO] Inserting scheduled posts...");
    await db.insert(scheduledPosts).values(
      DEMO_SCHEDULED_POSTS.map(p => ({ ...p, userId }))
    );
    console.log("📱 [DEMO] Scheduled posts inserted");

    console.log("📱 [DEMO] Inserting avatars...");
    const demoAvatars = getAvatarTemplates(demoUser.id);
    await db.insert(avatars).values(
      demoAvatars.map(a => ({ ...a, userId }))
    );
    console.log("📱 [DEMO] Avatars inserted");

    console.log("📱 [DEMO] Inserting photo avatar groups...");
    const photoGroupTemplates = getPhotoAvatarGroupTemplates(userId);
    const insertedGroups = await db.insert(photoAvatarGroups).values(photoGroupTemplates).returning();
    console.log("📱 [DEMO] Photo avatar groups inserted:", insertedGroups.length);

    console.log("📱 [DEMO] Inserting photo avatar looks...");
    for (let i = 0; i < insertedGroups.length; i++) {
      const group = insertedGroups[i];
      const looks = getPhotoAvatarLooksTemplates(group.heygenGroupId, i);
      await db.insert(photoAvatars).values(looks);
    }
    console.log("📱 [DEMO] Photo avatar looks inserted");

    console.log("📱 [DEMO] Inserting social media accounts...");
    await db.insert(socialMediaAccounts).values(
      DEMO_SOCIAL_ACCOUNTS.map(s => ({
        ...s,
        userId,
        accessToken: "demo_token",
        refreshToken: "demo_refresh",
        tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }))
    );
    console.log("📱 [DEMO] Social media accounts inserted");

    const token = generateToken({
      id: demoUser.id,
      username: demoUser.username,
      email: demoUser.email,
      type: "agent",
      name: demoUser.name,
      isDemo: true,
    });

    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "Demo account created successfully",
      user: {
        id: demoUser.id,
        username: demoUser.username,
        name: demoUser.name,
        email: demoUser.email,
        isDemo: true,
      },
      credentials: {
        username: demoUsername,
        password: "demo123",
      },
    });
  } catch (error: any) {
    console.error("📱 [DEMO] Error creating demo account:", error);
    console.error("📱 [DEMO] Error message:", error.message);
    console.error("📱 [DEMO] Error stack:", error.stack);
    res.status(500).json({
      success: false,
      error: "Failed to create demo account",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/demo/seed-existing
 * Add demo data to an existing user account (requires auth)
 */
router.post("/seed-existing", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = String(req.user?.id);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    await db.update(users).set({ isDemo: true }).where(eq(users.id, userId));

    const existingProperties = await db.query.properties.findMany({
      where: eq(properties.agentId, userId),
    });
    if (existingProperties.length === 0) {
      await db.insert(properties).values(
        DEMO_PROPERTIES.map(p => ({ ...p, agentId: userId }))
      );
    }

    const existingPosts = await db.query.scheduledPosts.findMany({
      where: eq(scheduledPosts.userId, userId),
    });
    if (existingPosts.length === 0) {
      await db.insert(scheduledPosts).values(
        DEMO_SCHEDULED_POSTS.map(p => ({ ...p, userId }))
      );
    }

    const existingAvatars = await db.query.avatars.findMany({
      where: eq(avatars.userId, userId),
    });
    if (existingAvatars.length === 0) {
      await db.insert(avatars).values(
        DEMO_AVATARS.map(a => ({ ...a, userId }))
      );
    }

    const existingAccounts = await db.query.socialMediaAccounts.findMany({
      where: eq(socialMediaAccounts.userId, userId),
    });
    if (existingAccounts.length === 0) {
      await db.insert(socialMediaAccounts).values(
        DEMO_SOCIAL_ACCOUNTS.map(s => ({
          ...s,
          userId,
          accessToken: "demo_token",
          refreshToken: "demo_refresh",
          tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }))
      );
    }

    res.json({
      success: true,
      message: "Demo data added to your account",
      seeded: {
        properties: existingProperties.length === 0 ? DEMO_PROPERTIES.length : 0,
        scheduledPosts: existingPosts.length === 0 ? DEMO_SCHEDULED_POSTS.length : 0,
        avatars: existingAvatars.length === 0 ? DEMO_AVATARS.length : 0,
        socialAccounts: existingAccounts.length === 0 ? DEMO_SOCIAL_ACCOUNTS.length : 0,
      },
    });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to seed demo data",
    });
  }
});

/**
 * GET /api/demo/status
 * Check if current user is in demo mode
 */
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = String(req.user?.id);
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    res.json({
      success: true,
      isDemo: user?.isDemo || false,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to check demo status",
    });
  }
});

/**
 * POST /api/demo/toggle
 * Toggle demo mode for current user
 */
router.post("/toggle", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = String(req.user?.id);
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const newDemoStatus = !user.isDemo;
    
    await db.update(users).set({ isDemo: newDemoStatus }).where(eq(users.id, userId));

    res.json({
      success: true,
      isDemo: newDemoStatus,
      message: newDemoStatus ? "Demo mode enabled" : "Demo mode disabled",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to toggle demo mode",
    });
  }
});

export default router;
