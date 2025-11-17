import {
  type Analytics,
  type Avatar,
  type CompanyProfile,
  companyProfiles,
  type ContentPiece,
  type CustomVoice,
  customVoices,
  type InsertAnalytics,
  type InsertAvatar,
  type InsertCompanyProfile,
  type InsertContentPiece,
  type InsertCustomVoice,
  type InsertMarketData,
  type InsertMediaAsset,
  type InsertPhotoAvatar,
  type InsertPhotoAvatarGroup,
  type InsertPhotoAvatarGroupVoice,
  type InsertPostMedia,
  type InsertScheduledPost,
  type InsertSeoKeyword,
  type InsertSocialMediaAccount,
  type InsertUser,
  type InsertVideoContent,
  type MarketData,
  type MediaAsset,
  type PhotoAvatar,
  type PhotoAvatarGroup,
  photoAvatarGroups,
  type PhotoAvatarGroupVoice,
  photoAvatarGroupVoices,
  photoAvatars,
  type PostMedia,
  type ScheduledPost,
  scheduledPosts as scheduledPostsTable,
  type SeoKeyword,
  type SocialMediaAccount,
  type User,
  type VideoContent,
  videoContent as videoContentTable,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Content
  getContentPieces(userId: string): Promise<ContentPiece[]>;
  getContentPieceById(id: string): Promise<ContentPiece | undefined>;
  createContentPiece(content: InsertContentPiece): Promise<ContentPiece>;
  updateContentPiece(
    id: string,
    updates: Partial<ContentPiece>
  ): Promise<ContentPiece | undefined>;
  deleteContentPiece(id: string): Promise<boolean>;

  // Social Media
  getSocialMediaAccounts(userId: string): Promise<SocialMediaAccount[]>;
  getSocialMediaAccountById(
    id: string
  ): Promise<SocialMediaAccount | undefined>;
  createSocialMediaAccount(
    account: InsertSocialMediaAccount
  ): Promise<SocialMediaAccount>;
  updateSocialMediaAccount(
    id: string,
    updates: Partial<SocialMediaAccount>
  ): Promise<SocialMediaAccount | undefined>;
  disconnectSocialMediaAccount(
    userId: string,
    platform: string
  ): Promise<SocialMediaAccount | undefined>;

  // SEO
  getSeoKeywords(userId: string): Promise<SeoKeyword[]>;
  createSeoKeyword(keyword: InsertSeoKeyword): Promise<SeoKeyword>;
  updateSeoKeyword(
    id: string,
    updates: Partial<SeoKeyword>
  ): Promise<SeoKeyword | undefined>;

  // Market Data
  getMarketData(userId: string): Promise<MarketData[]>;
  getMarketDataByNeighborhood(
    userId: string,
    neighborhood: string
  ): Promise<MarketData | undefined>;
  createMarketData(data: InsertMarketData): Promise<MarketData>;
  updateMarketData(
    id: string,
    updates: Partial<MarketData>
  ): Promise<MarketData | undefined>;
  refreshMarketData(
    userId: string,
    neighborhoods: InsertMarketData[]
  ): Promise<MarketData[]>;

  // Analytics
  getAnalytics(userId: string, metric?: string): Promise<Analytics[]>;
  createAnalytics(analytics: InsertAnalytics): Promise<Analytics>;

  // Scheduled Posts
  getScheduledPosts(userId: string, status?: string): Promise<ScheduledPost[]>;
  getScheduledPostById(id: string): Promise<ScheduledPost | undefined>;
  createScheduledPost(post: InsertScheduledPost): Promise<ScheduledPost>;
  updateScheduledPost(
    id: string,
    updates: Partial<ScheduledPost>
  ): Promise<ScheduledPost | undefined>;
  deleteScheduledPost(id: string): Promise<boolean>;

  // Avatars
  getAvatars(userId: string): Promise<Avatar[]>;
  getAvatarById(id: string): Promise<Avatar | undefined>;
  createAvatar(avatar: InsertAvatar): Promise<Avatar>;
  updateAvatar(
    id: string,
    updates: Partial<Avatar>
  ): Promise<Avatar | undefined>;
  deleteAvatar(id: string): Promise<boolean>;

  // Video Content
  getVideoContent(userId: string, status?: string): Promise<VideoContent[]>;
  getVideoById(id: string): Promise<VideoContent | undefined>;
  getVideoByIdAndUser(
    id: string,
    userId: string
  ): Promise<VideoContent | undefined>;
  createVideoContent(video: InsertVideoContent): Promise<VideoContent>;
  updateVideoContent(
    id: string,
    updates: Partial<VideoContent>
  ): Promise<VideoContent | undefined>;
  updateVideoContentWithUserGuard(
    id: string,
    userId: string,
    updates: Partial<VideoContent>
  ): Promise<VideoContent | undefined>;
  deleteVideoContent(id: string): Promise<boolean>;
  deleteVideoContentWithUserGuard(id: string, userId: string): Promise<boolean>;

  // Custom Voices
  listCustomVoices(userId: string): Promise<CustomVoice[]>;
  getCustomVoice(id: string): Promise<CustomVoice | undefined>;
  createCustomVoice(voice: InsertCustomVoice): Promise<CustomVoice>;
  deleteCustomVoice(id: string, userId: string): Promise<boolean>;

  // Photo Avatar Groups
  createPhotoAvatarGroup(
    group: InsertPhotoAvatarGroup
  ): Promise<PhotoAvatarGroup>;
  getPhotoAvatarGroup(groupId: string): Promise<PhotoAvatarGroup | undefined>;
  getPhotoAvatarGroupByHeygenId(
    heygenGroupId: string
  ): Promise<PhotoAvatarGroup | undefined>;
  getPhotoAvatarGroupByHeygenIdAndUser(
    heygenGroupId: string,
    userId: string
  ): Promise<PhotoAvatarGroup | undefined>;
  getPhotoAvatarGroupByImageHash(
    imageHash: string,
    userId: string
  ): Promise<PhotoAvatarGroup | undefined>;
  listPhotoAvatarGroups(userId: string): Promise<PhotoAvatarGroup[]>;
  updatePhotoAvatarGroup(
    id: string,
    updates: Partial<PhotoAvatarGroup>
  ): Promise<PhotoAvatarGroup | undefined>;
  deletePhotoAvatarGroup(groupId: string, userId: string): Promise<boolean>;

  // Photo Avatar Group Voices
  savePhotoAvatarGroupVoice(
    voice: InsertPhotoAvatarGroupVoice
  ): Promise<PhotoAvatarGroupVoice>;
  getPhotoAvatarGroupVoice(
    groupId: string,
    userId: number
  ): Promise<PhotoAvatarGroupVoice | undefined>;
  listPhotoAvatarGroupVoices(userId: number): Promise<PhotoAvatarGroupVoice[]>;

  // Individual Photo Avatars
  createPhotoAvatar(avatar: InsertPhotoAvatar): Promise<PhotoAvatar>;
  getPhotoAvatarByHeygenIdAndUser(
    heygenAvatarId: string,
    userId: string
  ): Promise<PhotoAvatar | undefined>;
  updatePhotoAvatar(
    heygenAvatarId: string,
    userId: string,
    updates: Partial<PhotoAvatar>
  ): Promise<PhotoAvatar | undefined>;
  deletePhotoAvatar(heygenAvatarId: string, userId: string): Promise<boolean>;

  // Company Profile
  getCompanyProfile(userId: string): Promise<CompanyProfile | null>;
  upsertCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;

  // Media Assets
  getMediaAssets(
    userId: string,
    type?: string,
    source?: string
  ): Promise<MediaAsset[]>;
  getMediaAssetById(id: string): Promise<MediaAsset | undefined>;
  createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset>;
  updateMediaAsset(
    id: string,
    updates: Partial<MediaAsset>
  ): Promise<MediaAsset | undefined>;
  deleteMediaAsset(id: string): Promise<boolean>;

  // Post Media (junction table for post attachments)
  createPostMedia(postMedias: InsertPostMedia[]): Promise<PostMedia[]>;
  getPostMedia(postId: string): Promise<PostMedia[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private contentPieces: Map<string, ContentPiece> = new Map();
  private socialMediaAccounts: Map<string, SocialMediaAccount> = new Map();
  private seoKeywords: Map<string, SeoKeyword> = new Map();
  private marketData: Map<string, MarketData> = new Map();
  private analytics: Map<string, Analytics> = new Map();
  private scheduledPosts: Map<string, ScheduledPost> = new Map();
  private avatars: Map<string, Avatar> = new Map();
  private videoContent: Map<string, VideoContent> = new Map();
  private customVoices: Map<string, CustomVoice> = new Map();
  private photoAvatarGroupVoices: Map<string, PhotoAvatarGroupVoice> =
    new Map();
  private mediaAssets: Map<string, MediaAsset> = new Map();
  private postMedia: Map<string, PostMedia> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create default user (Mike Bjork)
    const userId = randomUUID();
    const user: User = {
      id: userId,
      username: "mikebjork",
      password: "password",
      name: "Mike Bjork",
      email: "mike@bjorkgroup.com",
      role: "team_lead",
      createdAt: new Date(),
    };
    this.users.set(userId, user);

    // Seed market data for Omaha neighborhoods
    const neighborhoods = [
      {
        name: "Aksarben",
        avgPrice: 425000,
        daysOnMarket: 18,
        inventory: "0.8 months",
        priceGrowth: "+15.2%",
        trend: "hot",
      },
      {
        name: "Dundee",
        avgPrice: 385000,
        daysOnMarket: 12,
        inventory: "0.6 months",
        priceGrowth: "+12.8%",
        trend: "rising",
      },
      {
        name: "Blackstone",
        avgPrice: 225000,
        daysOnMarket: 28,
        inventory: "1.4 months",
        priceGrowth: "+6.4%",
        trend: "steady",
      },
      {
        name: "Old Market",
        avgPrice: 350000,
        daysOnMarket: 22,
        inventory: "1.1 months",
        priceGrowth: "+9.1%",
        trend: "rising",
      },
      {
        name: "Benson",
        avgPrice: 195000,
        daysOnMarket: 35,
        inventory: "1.8 months",
        priceGrowth: "+4.2%",
        trend: "steady",
      },
    ];

    neighborhoods.forEach((n) => {
      const marketId = randomUUID();
      const market: MarketData = {
        id: marketId,
        userId, // Associate market data with the seeded user
        neighborhood: n.name,
        avgPrice: n.avgPrice,
        daysOnMarket: n.daysOnMarket,
        inventory: n.inventory,
        priceGrowth: n.priceGrowth,
        trend: n.trend as any,
        lastUpdated: new Date(),
      };
      this.marketData.set(marketId, market);
    });

    // SEO keywords will be AI-generated on first login based on user's service areas and specialties
    // No seed keywords - users start with empty keyword list

    // Seed analytics data
    const metrics = [
      { metric: "monthly_leads", value: 847 },
      { metric: "content_published", value: 23 },
      { metric: "seo_ranking", value: 32 }, // avg position * 10
      { metric: "social_engagement", value: 4800 },
      { metric: "site_health", value: 94 },
      { metric: "monthly_visitors", value: 12000 },
    ];

    metrics.forEach((m) => {
      const analyticsId = randomUUID();
      const analytic: Analytics = {
        id: analyticsId,
        userId,
        metric: m.metric,
        value: m.value,
        date: new Date(),
        metadata: null,
      };
      this.analytics.set(analyticsId, analytic);
    });

    // Scheduled posts will be generated on-demand via "Generate Content Plan" button
    // No seed posts - users start with empty calendar

    // Create default avatar with user's actual name
    this.createDefaultAvatar(userId, user.name);

    // Create sample video content
    this.createSampleVideoContent(userId);
  }

  async getUser(id: string): Promise<User | undefined> {
    // Check memory first (for seeded users)
    const memUser = this.users.get(id);
    if (memUser) {
      console.log(`[STORAGE] getUser(${id}) - Found in memory`);
      return memUser;
    }

    // Check database for DB-authenticated users
    try {
      const { db } = await import("./db");
      const dbUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.id, id),
      });
      if (dbUser) {
        console.log(`[STORAGE] getUser(${id}) - Found in database`);
        return dbUser as User;
      }
    } catch (error) {
      console.error(`[STORAGE] getUser(${id}) - Database error:`, error);
    }

    console.log(`[STORAGE] getUser(${id}) - Not found`);
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Check memory first (for seeded users)
    const memUser = Array.from(this.users.values()).find(
      (user) => user.username === username
    );
    if (memUser) {
      console.log(
        `[STORAGE] getUserByUsername(${username}) - Found in memory: ${memUser.id}`
      );
      return memUser;
    }

    // Check database for DB-authenticated users
    try {
      const { db } = await import("./db");
      const dbUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.username, username),
      });
      if (dbUser) {
        console.log(
          `[STORAGE] getUserByUsername(${username}) - Found in database: ${dbUser.id}`
        );
        return dbUser as User;
      }
    } catch (error) {
      console.error(
        `[STORAGE] getUserByUsername(${username}) - Database error:`,
        error
      );
    }

    console.log(`[STORAGE] getUserByUsername(${username}) - Not found`);
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Check memory first (for seeded users)
    const memUser = Array.from(this.users.values()).find(
      (user) => user.email === email
    );
    if (memUser) {
      console.log(
        `[STORAGE] getUserByEmail(${email}) - Found in memory: ${memUser.id}`
      );
      return memUser;
    }

    // Check database for DB-authenticated users
    try {
      const { db } = await import("./db");
      const dbUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.email, email),
      });
      if (dbUser) {
        console.log(
          `[STORAGE] getUserByEmail(${email}) - Found in database: ${dbUser.id}`
        );
        return dbUser as User;
      }
    } catch (error) {
      console.error(
        `[STORAGE] getUserByEmail(${email}) - Database error:`,
        error
      );
    }

    console.log(`[STORAGE] getUserByEmail(${email}) - Not found`);
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // 🔥 FIX: Use passed ID if provided, otherwise generate new UUID
    const id = insertUser.id || randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
      role: insertUser.role || "agent",
    };
    this.users.set(id, user);
    console.log(`[STORAGE] createUser - Created user with ID: ${id} (email: ${insertUser.email})`);
    return user;
  }

  async getContentPieces(userId: string): Promise<ContentPiece[]> {
    return Array.from(this.contentPieces.values()).filter(
      (content) => content.userId === userId
    );
  }

  async getContentPieceById(id: string): Promise<ContentPiece | undefined> {
    return this.contentPieces.get(id);
  }

  async createContentPiece(
    insertContent: InsertContentPiece
  ): Promise<ContentPiece> {
    const id = randomUUID();
    const content: ContentPiece = {
      ...insertContent,
      id,
      createdAt: new Date(),
      metadata: insertContent.metadata || null,
      neighborhood: insertContent.neighborhood || null,
      keywords: insertContent.keywords || null,
      seoOptimized: insertContent.seoOptimized || false,
    };
    this.contentPieces.set(id, content);
    return content;
  }

  async updateContentPiece(
    id: string,
    updates: Partial<ContentPiece>
  ): Promise<ContentPiece | undefined> {
    const content = this.contentPieces.get(id);
    if (!content) return undefined;

    const updated = { ...content, ...updates };
    this.contentPieces.set(id, updated);
    return updated;
  }

  async deleteContentPiece(id: string): Promise<boolean> {
    return this.contentPieces.delete(id);
  }

  async getSocialMediaAccounts(userId: string): Promise<SocialMediaAccount[]> {
    // Use database instead of memory
    const { db } = await import("./db");
    const { socialMediaAccounts: socialMediaAccountsTable } = await import(
      "../shared/schema"
    );
    const accounts = await db.query.socialMediaAccounts.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
    });
    console.log(
      `[STORAGE] Found ${accounts.length} social media accounts for user ${userId}`
    );
    return accounts;
  }

  async getSocialMediaAccountById(
    id: string
  ): Promise<SocialMediaAccount | undefined> {
    // Use database instead of memory
    const { db } = await import("./db");
    const account = await db.query.socialMediaAccounts.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    });
    return account;
  }

  async createSocialMediaAccount(
    insertAccount: InsertSocialMediaAccount
  ): Promise<SocialMediaAccount> {
    // Use database instead of memory
    const { db } = await import("./db");
    const { socialMediaAccounts: socialMediaAccountsTable } = await import(
      "../shared/schema"
    );

    const [account] = await db
      .insert(socialMediaAccountsTable)
      .values({
        ...insertAccount,
        isConnected: insertAccount.isConnected ?? true,
      })
      .returning();

    console.log(
      `[STORAGE] Created social media account for user ${insertAccount.userId}, platform ${insertAccount.platform}`
    );
    return account;
  }

  async updateSocialMediaAccount(
    id: string,
    updates: Partial<SocialMediaAccount>
  ): Promise<SocialMediaAccount | undefined> {
    // Use database instead of memory
    const { db } = await import("./db");
    const { socialMediaAccounts: socialMediaAccountsTable } = await import(
      "../shared/schema"
    );

    const [updated] = await db
      .update(socialMediaAccountsTable)
      .set(updates)
      .where(eq(socialMediaAccountsTable.id, id))
      .returning();

    console.log(`[STORAGE] Updated social media account ${id}`);
    return updated;
  }

  async disconnectSocialMediaAccount(
    userId: string,
    platform: string
  ): Promise<SocialMediaAccount | undefined> {
    // Use database instead of memory
    const { db } = await import("./db");
    const { socialMediaAccounts: socialMediaAccountsTable } = await import(
      "../shared/schema"
    );

    // Find account by userId and platform
    const account = await db.query.socialMediaAccounts.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.userId, userId), eq(table.platform, platform)),
    });

    if (!account) {
      console.log(
        `[STORAGE] No account found for user ${userId}, platform ${platform}`
      );
      return undefined;
    }

    if (!account.isConnected) {
      console.log(
        `[STORAGE] Account already disconnected for user ${userId}, platform ${platform}`
      );
      return account; // Already disconnected
    }

    // Mark as disconnected and clear OAuth credentials
    const [updated] = await db
      .update(socialMediaAccountsTable)
      .set({
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        lastSync: null,
      })
      .where(eq(socialMediaAccountsTable.id, account.id))
      .returning();

    console.log(
      `[STORAGE] Disconnected social media account for user ${userId}, platform ${platform}`
    );
    return updated;
  }

  async getSeoKeywords(userId: string): Promise<SeoKeyword[]> {
    return Array.from(this.seoKeywords.values()).filter(
      (keyword) => keyword.userId === userId
    );
  }

  async createSeoKeyword(insertKeyword: InsertSeoKeyword): Promise<SeoKeyword> {
    const id = randomUUID();
    const keyword: SeoKeyword = {
      ...insertKeyword,
      id,
      createdAt: new Date(),
      neighborhood: insertKeyword.neighborhood || null,
      currentRank: insertKeyword.currentRank || null,
      previousRank: insertKeyword.previousRank || null,
      searchVolume: insertKeyword.searchVolume || null,
      difficulty: insertKeyword.difficulty || null,
      lastChecked: insertKeyword.lastChecked || null,
    };
    this.seoKeywords.set(id, keyword);
    return keyword;
  }

  async updateSeoKeyword(
    id: string,
    updates: Partial<SeoKeyword>
  ): Promise<SeoKeyword | undefined> {
    const keyword = this.seoKeywords.get(id);
    if (!keyword) return undefined;

    const updated = { ...keyword, ...updates };
    this.seoKeywords.set(id, updated);
    return updated;
  }

  async getMarketData(userId: string): Promise<MarketData[]> {
    return Array.from(this.marketData.values()).filter(
      (data) => data.userId === userId
    );
  }

  async getMarketDataByNeighborhood(
    userId: string,
    neighborhood: string
  ): Promise<MarketData | undefined> {
    return Array.from(this.marketData.values()).find(
      (data) => data.userId === userId && data.neighborhood === neighborhood
    );
  }

  async createMarketData(insertData: InsertMarketData): Promise<MarketData> {
    const id = randomUUID();
    const data: MarketData = {
      ...insertData,
      id,
      avgPrice: insertData.avgPrice || null,
      daysOnMarket: insertData.daysOnMarket || null,
      inventory: insertData.inventory || null,
      priceGrowth: insertData.priceGrowth || null,
      trend: insertData.trend || null,
      lastUpdated: insertData.lastUpdated || new Date(),
    };
    this.marketData.set(id, data);
    return data;
  }

  async updateMarketData(
    id: string,
    updates: Partial<MarketData>
  ): Promise<MarketData | undefined> {
    const data = this.marketData.get(id);
    if (!data) return undefined;

    const updated = { ...data, ...updates };
    this.marketData.set(id, updated);
    return updated;
  }

  async refreshMarketData(
    userId: string,
    neighborhoods: InsertMarketData[]
  ): Promise<MarketData[]> {
    // Clear existing market data for this user only
    const userMarketDataIds = Array.from(this.marketData.entries())
      .filter(([_, data]) => data.userId === userId)
      .map(([id, _]) => id);

    userMarketDataIds.forEach((id) => this.marketData.delete(id));

    // Create new market data from AI-generated neighborhoods for this user
    const newMarketData: MarketData[] = [];

    for (const neighborhood of neighborhoods) {
      // Verify userId matches (security check)
      if (neighborhood.userId !== userId) {
        console.warn(
          `⚠️  Skipping neighborhood with mismatched userId: ${neighborhood.userId} !== ${userId}`
        );
        continue;
      }

      const id = randomUUID();
      const data: MarketData = {
        ...neighborhood,
        id,
        avgPrice: neighborhood.avgPrice || null,
        daysOnMarket: neighborhood.daysOnMarket || null,
        inventory: neighborhood.inventory || null,
        priceGrowth: neighborhood.priceGrowth || null,
        trend: neighborhood.trend || null,
        lastUpdated: new Date(),
      };
      this.marketData.set(id, data);
      newMarketData.push(data);
    }

    console.log(
      `📊 Refreshed market data for user ${userId}: ${newMarketData.length} neighborhoods`
    );
    return newMarketData;
  }

  async getAnalytics(userId: string, metric?: string): Promise<Analytics[]> {
    const userAnalytics = Array.from(this.analytics.values()).filter(
      (a) => a.userId === userId
    );
    if (metric) {
      return userAnalytics.filter((a) => a.metric === metric);
    }
    return userAnalytics;
  }

  async createAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    const id = randomUUID();
    const analytics: Analytics = {
      ...insertAnalytics,
      id,
      metadata: insertAnalytics.metadata || null,
      date: insertAnalytics.date || new Date(),
    };
    this.analytics.set(id, analytics);
    return analytics;
  }

  async getScheduledPosts(
    userId: string,
    status?: string
  ): Promise<ScheduledPost[]> {
    if (status) {
      return await db
        .select()
        .from(scheduledPostsTable)
        .where(
          and(
            eq(scheduledPostsTable.userId, userId),
            eq(scheduledPostsTable.status, status)
          )
        )
        .orderBy(scheduledPostsTable.scheduledFor);
    }

    return await db
      .select()
      .from(scheduledPostsTable)
      .where(eq(scheduledPostsTable.userId, userId))
      .orderBy(scheduledPostsTable.scheduledFor);
  }

  async getScheduledPostById(id: string): Promise<ScheduledPost | undefined> {
    const [post] = await db
      .select()
      .from(scheduledPostsTable)
      .where(eq(scheduledPostsTable.id, id))
      .limit(1);
    return post;
  }

  async createScheduledPost(
    insertPost: InsertScheduledPost
  ): Promise<ScheduledPost> {
    const [post] = await db
      .insert(scheduledPostsTable)
      .values({
        ...insertPost,
        metadata: insertPost.metadata || null,
        isEdited: insertPost.isEdited || false,
        originalContent: insertPost.originalContent || null,
        neighborhood: insertPost.neighborhood || null,
        hashtags: insertPost.hashtags || null,
        postType: insertPost.postType || null,
        status: insertPost.status || "pending",
        seoScore: insertPost.seoScore ?? 0,
      })
      .returning();
    return post;
  }

  async updateScheduledPost(
    id: string,
    updates: Partial<ScheduledPost>
  ): Promise<ScheduledPost | undefined> {
    const existing = await this.getScheduledPostById(id);
    if (!existing) return undefined;

    const [post] = await db
      .update(scheduledPostsTable)
      .set({
        ...updates,
        updatedAt: new Date(),
        isEdited:
          updates.content && updates.content !== existing.originalContent
            ? true
            : existing.isEdited,
      })
      .where(eq(scheduledPostsTable.id, id))
      .returning();
    return post;
  }

  async deleteScheduledPost(id: string): Promise<boolean> {
    const result = await db
      .delete(scheduledPostsTable)
      .where(eq(scheduledPostsTable.id, id))
      .returning();
    return result.length > 0;
  }

  private generateWeeklyScheduledPosts(userId: string) {
    const neighborhoods = [
      "Dundee",
      "Aksarben",
      "Old Market",
      "Blackstone",
      "Benson",
    ];
    const platforms = ["facebook", "instagram", "linkedin", "x"];

    const localMarketTopics = [
      "Dundee neighborhood walkability and charm",
      "Aksarben Village amenities and luxury living",
      "Old Market historic character and dining scene",
      "Blackstone emerging arts district",
      "Benson affordable family-friendly community",
    ];

    const movingToOmahaTopics = [
      "Best Omaha neighborhoods for families",
      "Omaha job market and major employers",
      "Winter in Omaha: what to expect",
      "Omaha school districts comparison",
      "Cost of living in Omaha vs other cities",
    ];

    const today = new Date();
    let postId = 0;

    // Generate 2 weeks of scheduled posts
    for (let day = 0; day < 14; day++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + day + 1);
      scheduleDate.setHours(9 + (day % 8), 0, 0, 0); // Vary posting times

      const platformIndex = day % platforms.length;
      const platform = platforms[platformIndex];

      let content, postType, neighborhood;

      if (day % 3 === 0) {
        // Local market focus
        const topicIndex = day % localMarketTopics.length;
        content = localMarketTopics[topicIndex];
        postType = "local_market";
        neighborhood = neighborhoods[topicIndex % neighborhoods.length];
      } else {
        // Moving to Omaha focus
        const topicIndex = day % movingToOmahaTopics.length;
        content = movingToOmahaTopics[topicIndex];
        postType = "moving_guide";
        neighborhood = null;
      }

      const scheduledPost: ScheduledPost = {
        id: randomUUID(),
        userId,
        platform,
        postType,
        content,
        hashtags:
          platform === "instagram"
            ? ["OmahaRealEstate", "MovingToOmaha", "NebraskaHomes"]
            : [],
        scheduledFor: scheduleDate,
        status: "pending",
        isEdited: false,
        originalContent: content,
        neighborhood,
        seoScore: 80, // Default SEO score for generated content
        metadata: { generated: true, focus: postType },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.scheduledPosts.set(scheduledPost.id, scheduledPost);
    }
  }

  private createDefaultAvatar(userId: string, userName?: string) {
    const displayName = userName || "Professional Agent";
    const avatar: Avatar = {
      id: randomUUID(),
      userId,
      name: `${displayName} - Professional`,
      description:
        "Professional real estate agent avatar for client-facing content",
      avatarImageUrl: null, // Would be set when user uploads their photo
      voiceId: "119caed25533477ba63822d5d1552d25", // HeyGen default professional voice
      style: "professional",
      gender: "male",
      isActive: true,
      metadata: { defaultAvatar: true },
      createdAt: new Date(),
    };
    this.avatars.set(avatar.id, avatar);
  }

  private createSampleVideoContent(userId: string) {
    const sampleTopics = [
      {
        title: "Why Dundee is Perfect for Families",
        topic: "Dundee neighborhood family benefits",
        videoType: "neighborhood_tour",
        neighborhood: "Dundee",
      },
      {
        title: "Moving to Omaha: Your Complete Guide",
        topic: "Complete relocation guide for Omaha",
        videoType: "moving_guide",
        neighborhood: null,
      },
      {
        title: "Omaha Market Update - January 2025",
        topic: "Current market trends and opportunities",
        videoType: "market_update",
        neighborhood: null,
      },
    ];

    sampleTopics.forEach((sample, index) => {
      const video: VideoContent = {
        id: randomUUID(),
        userId,
        avatarId:
          Array.from(this.avatars.values()).find((a) => a.userId === userId)
            ?.id || null,
        title: sample.title,
        script: `Welcome! Today I want to talk about ${sample.topic}. As your local Omaha real estate expert, I'm here to provide you with valuable insights that can help with your real estate decisions.`,
        topic: sample.topic,
        neighborhood: sample.neighborhood,
        videoType: sample.videoType,
        duration: null,
        thumbnailUrl: null,
        videoUrl: null,
        youtubeUrl: null,
        youtubeVideoId: null,
        status: "draft",
        tags: [
          "OmahaRealEstate",
          "RealEstateExpert",
          "HomesBuying",
          "Nebraska",
        ],
        seoOptimized: false,
        metadata: { sampleContent: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.videoContent.set(video.id, video);
    });
  }

  // Avatar methods
  async getAvatars(userId: string): Promise<Avatar[]> {
    return Array.from(this.avatars.values()).filter(
      (avatar) => avatar.userId === userId
    );
  }

  async getAvatarById(id: string): Promise<Avatar | undefined> {
    return this.avatars.get(id);
  }

  async createAvatar(insertAvatar: InsertAvatar): Promise<Avatar> {
    const id = randomUUID();
    const avatar: Avatar = {
      ...insertAvatar,
      id,
      createdAt: new Date(),
      avatarImageUrl: insertAvatar.avatarImageUrl || null,
      voiceId: insertAvatar.voiceId || null,
      description: insertAvatar.description || null,
      gender: insertAvatar.gender || null,
      metadata: insertAvatar.metadata || null,
      style: insertAvatar.style || "professional",
      isActive: insertAvatar.isActive !== false,
    };
    this.avatars.set(id, avatar);
    return avatar;
  }

  async updateAvatar(
    id: string,
    updates: Partial<Avatar>
  ): Promise<Avatar | undefined> {
    const avatar = this.avatars.get(id);
    if (!avatar) return undefined;

    const updated = { ...avatar, ...updates };
    this.avatars.set(id, updated);
    return updated;
  }

  async deleteAvatar(id: string): Promise<boolean> {
    return this.avatars.delete(id);
  }

  // Video Content methods
  async getVideoContent(
    userId: string,
    status?: string
  ): Promise<VideoContent[]> {
    const conditions = [eq(videoContentTable.userId, userId)];
    if (status) {
      conditions.push(eq(videoContentTable.status, status));
    }

    return await db
      .select()
      .from(videoContentTable)
      .where(and(...conditions))
      .orderBy(desc(videoContentTable.createdAt));
  }

  async getVideoById(id: string): Promise<VideoContent | undefined> {
    const [video] = await db
      .select()
      .from(videoContentTable)
      .where(eq(videoContentTable.id, id))
      .limit(1);
    return video;
  }

  async createVideoContent(
    insertVideo: InsertVideoContent
  ): Promise<VideoContent> {
    const [video] = await db
      .insert(videoContentTable)
      .values({
        ...insertVideo,
        avatarId: insertVideo.avatarId || null,
        topic: insertVideo.topic || null,
        neighborhood: insertVideo.neighborhood || null,
        videoType: insertVideo.videoType || null,
        duration: insertVideo.duration || null,
        thumbnailUrl: insertVideo.thumbnailUrl || null,
        videoUrl: insertVideo.videoUrl || null,
        youtubeUrl: insertVideo.youtubeUrl || null,
        youtubeVideoId: insertVideo.youtubeVideoId || null,
        tags: insertVideo.tags || null,
        seoOptimized: insertVideo.seoOptimized || false,
        metadata: insertVideo.metadata || null,
        status: insertVideo.status || "draft",
        platform: insertVideo.platform || null,
        heygenVideoId: insertVideo.heygenVideoId || null,
        heygenAvatarId: insertVideo.heygenAvatarId || null,
        heygenVoiceId: insertVideo.heygenVoiceId || null,
        heygenTemplateId: insertVideo.heygenTemplateId || null,
      })
      .returning();
    return video;
  }

  async updateVideoContent(
    id: string,
    updates: Partial<VideoContent>
  ): Promise<VideoContent | undefined> {
    const [updated] = await db
      .update(videoContentTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoContentTable.id, id))
      .returning();
    return updated;
  }

  async deleteVideoContent(id: string): Promise<boolean> {
    const result = await db
      .delete(videoContentTable)
      .where(eq(videoContentTable.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getVideoByIdAndUser(
    id: string,
    userId: string
  ): Promise<VideoContent | undefined> {
    const [video] = await db
      .select()
      .from(videoContentTable)
      .where(
        and(eq(videoContentTable.id, id), eq(videoContentTable.userId, userId))
      )
      .limit(1);
    return video;
  }

  async updateVideoContentWithUserGuard(
    id: string,
    userId: string,
    updates: Partial<VideoContent>
  ): Promise<VideoContent | undefined> {
    const [updated] = await db
      .update(videoContentTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(eq(videoContentTable.id, id), eq(videoContentTable.userId, userId))
      )
      .returning();
    return updated;
  }

  async deleteVideoContentWithUserGuard(
    id: string,
    userId: string
  ): Promise<boolean> {
    const result = await db
      .delete(videoContentTable)
      .where(
        and(eq(videoContentTable.id, id), eq(videoContentTable.userId, userId))
      );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Custom Voices
  async listCustomVoices(userId: string): Promise<CustomVoice[]> {
    return await db
      .select()
      .from(customVoices)
      .where(eq(customVoices.userId, userId));
  }

  async getCustomVoice(id: string): Promise<CustomVoice | undefined> {
    const [voice] = await db
      .select()
      .from(customVoices)
      .where(eq(customVoices.id, id))
      .limit(1);
    return voice;
  }

  async createCustomVoice(
    insertVoice: InsertCustomVoice
  ): Promise<CustomVoice> {
    const [voice] = await db
      .insert(customVoices)
      .values({
        ...insertVoice,
        duration: insertVoice.duration || null,
        fileSize: insertVoice.fileSize || null,
        heygenAudioAssetId: insertVoice.heygenAudioAssetId || null,
        status: insertVoice.status || "pending",
      })
      .returning();
    return voice;
  }

  async deleteCustomVoice(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(customVoices)
      .where(and(eq(customVoices.id, id), eq(customVoices.userId, userId)));
    return true;
  }

  async savePhotoAvatarGroupVoice(
    insertVoice: InsertPhotoAvatarGroupVoice
  ): Promise<PhotoAvatarGroupVoice> {
    const [voice] = await db
      .insert(photoAvatarGroupVoices)
      .values({
        ...insertVoice,
        heygenAudioAssetId: insertVoice.heygenAudioAssetId || null,
      })
      .returning();
    return voice;
  }

  async getPhotoAvatarGroupVoice(
    groupId: string,
    userId: number
  ): Promise<PhotoAvatarGroupVoice | undefined> {
    const [voice] = await db
      .select()
      .from(photoAvatarGroupVoices)
      .where(
        and(
          eq(photoAvatarGroupVoices.groupId, groupId),
          eq(photoAvatarGroupVoices.userId, userId)
        )
      )
      .limit(1);
    return voice;
  }

  async listPhotoAvatarGroupVoices(
    userId: number
  ): Promise<PhotoAvatarGroupVoice[]> {
    return await db
      .select()
      .from(photoAvatarGroupVoices)
      .where(eq(photoAvatarGroupVoices.userId, userId));
  }

  // Photo Avatar Groups
  async createPhotoAvatarGroup(
    insertGroup: InsertPhotoAvatarGroup
  ): Promise<PhotoAvatarGroup> {
    const [group] = await db
      .insert(photoAvatarGroups)
      .values(insertGroup)
      .returning();
    return group;
  }

  async getPhotoAvatarGroup(id: string): Promise<PhotoAvatarGroup | undefined> {
    const [group] = await db
      .select()
      .from(photoAvatarGroups)
      .where(eq(photoAvatarGroups.id, id))
      .limit(1);
    return group;
  }

  async getPhotoAvatarGroupByHeygenId(
    heygenGroupId: string
  ): Promise<PhotoAvatarGroup | undefined> {
    const [group] = await db
      .select()
      .from(photoAvatarGroups)
      .where(eq(photoAvatarGroups.heygenGroupId, heygenGroupId))
      .limit(1);
    return group;
  }

  async getPhotoAvatarGroupByImageHash(
    imageHash: string,
    userId: string
  ): Promise<PhotoAvatarGroup | undefined> {
    const [group] = await db
      .select()
      .from(photoAvatarGroups)
      .where(
        and(
          eq(photoAvatarGroups.imageHash, imageHash),
          eq(photoAvatarGroups.userId, userId)
        )
      )
      .limit(1);
    return group;
  }

  async listPhotoAvatarGroups(userId: string): Promise<PhotoAvatarGroup[]> {
    return await db
      .select()
      .from(photoAvatarGroups)
      .where(eq(photoAvatarGroups.userId, userId));
  }

  async updatePhotoAvatarGroup(
    id: string,
    updates: Partial<PhotoAvatarGroup>
  ): Promise<PhotoAvatarGroup | undefined> {
    const [updated] = await db
      .update(photoAvatarGroups)
      .set(updates)
      .where(eq(photoAvatarGroups.id, id))
      .returning();
    return updated;
  }

  async getPhotoAvatarGroupByHeygenIdAndUser(
    heygenGroupId: string,
    userId: string
  ): Promise<PhotoAvatarGroup | undefined> {
    const [group] = await db
      .select()
      .from(photoAvatarGroups)
      .where(
        and(
          eq(photoAvatarGroups.heygenGroupId, heygenGroupId),
          eq(photoAvatarGroups.userId, userId)
        )
      )
      .limit(1);
    return group;
  }

  async deletePhotoAvatarGroup(
    groupId: string,
    userId: string
  ): Promise<boolean> {
    const result = await db
      .delete(photoAvatarGroups)
      .where(
        and(
          eq(photoAvatarGroups.heygenGroupId, groupId),
          eq(photoAvatarGroups.userId, userId)
        )
      );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Individual Photo Avatars
  async createPhotoAvatar(avatar: InsertPhotoAvatar): Promise<PhotoAvatar> {
    const [result] = await db.insert(photoAvatars).values(avatar).returning();
    return result;
  }

  async getPhotoAvatarByHeygenIdAndUser(
    heygenAvatarId: string,
    userId: string
  ): Promise<PhotoAvatar | undefined> {
    const [avatar] = await db
      .select()
      .from(photoAvatars)
      .where(
        and(
          eq(photoAvatars.heygenAvatarId, heygenAvatarId),
          eq(photoAvatars.userId, userId)
        )
      )
      .limit(1);
    return avatar;
  }

  async updatePhotoAvatar(
    heygenAvatarId: string,
    userId: string,
    updates: Partial<PhotoAvatar>
  ): Promise<PhotoAvatar | undefined> {
    const [result] = await db
      .update(photoAvatars)
      .set(updates)
      .where(
        and(
          eq(photoAvatars.heygenAvatarId, heygenAvatarId),
          eq(photoAvatars.userId, userId)
        )
      )
      .returning();
    return result;
  }

  async deletePhotoAvatar(
    heygenAvatarId: string,
    userId: string
  ): Promise<boolean> {
    const result = await db
      .delete(photoAvatars)
      .where(
        and(
          eq(photoAvatars.heygenAvatarId, heygenAvatarId),
          eq(photoAvatars.userId, userId)
        )
      );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getCompanyProfile(userId: string): Promise<CompanyProfile | null> {
    const [profile] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.userId, userId))
      .limit(1);
    return profile || null;
  }

  async upsertCompanyProfile(
    profile: InsertCompanyProfile
  ): Promise<CompanyProfile> {
    const [result] = await db
      .insert(companyProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: companyProfiles.userId,
        set: {
          ...profile,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getMediaAssets(
    userId: string,
    type?: string,
    source?: string
  ): Promise<MediaAsset[]> {
    let assets = Array.from(this.mediaAssets.values()).filter(
      (asset) => asset.userId === userId
    );

    if (type) {
      assets = assets.filter((asset) => asset.type === type);
    }

    if (source) {
      assets = assets.filter((asset) => asset.source === source);
    }

    return assets.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getMediaAssetById(id: string): Promise<MediaAsset | undefined> {
    return this.mediaAssets.get(id);
  }

  async createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset> {
    const newAsset: MediaAsset = {
      id: randomUUID(),
      ...asset,
      title: asset.title ?? null,
      metadata: asset.metadata ?? null,
      createdAt: new Date(),
    };
    this.mediaAssets.set(newAsset.id, newAsset);
    return newAsset;
  }

  async updateMediaAsset(
    id: string,
    updates: Partial<MediaAsset>
  ): Promise<MediaAsset | undefined> {
    const asset = this.mediaAssets.get(id);
    if (!asset) return undefined;

    const updated = { ...asset, ...updates };
    this.mediaAssets.set(id, updated);
    return updated;
  }

  async deleteMediaAsset(id: string): Promise<boolean> {
    return this.mediaAssets.delete(id);
  }

  async createPostMedia(postMedias: InsertPostMedia[]): Promise<PostMedia[]> {
    const results: PostMedia[] = [];
    for (const pm of postMedias) {
      const newPostMedia: PostMedia = {
        id: randomUUID(),
        ...pm,
        orderIndex: pm.orderIndex ?? null,
        createdAt: new Date(),
      };
      this.postMedia.set(newPostMedia.id, newPostMedia);
      results.push(newPostMedia);
    }
    return results;
  }

  async getPostMedia(postId: string): Promise<PostMedia[]> {
    return Array.from(this.postMedia.values())
      .filter((pm) => pm.postId === postId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }
}

export const storage = new MemStorage();
