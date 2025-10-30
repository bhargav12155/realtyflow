import { 
  type User, 
  type InsertUser,
  type ContentPiece,
  type InsertContentPiece,
  type SocialMediaAccount,
  type InsertSocialMediaAccount,
  type SeoKeyword,
  type InsertSeoKeyword,
  type MarketData,
  type InsertMarketData,
  type Analytics,
  type InsertAnalytics,
  type ScheduledPost,
  type InsertScheduledPost,
  type Avatar,
  type InsertAvatar,
  type VideoContent,
  type InsertVideoContent,
  type CustomVoice,
  type InsertCustomVoice,
  type PhotoAvatarGroupVoice,
  type InsertPhotoAvatarGroupVoice,
  photoAvatarGroupVoices,
  customVoices
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Content
  getContentPieces(userId: string): Promise<ContentPiece[]>;
  getContentPieceById(id: string): Promise<ContentPiece | undefined>;
  createContentPiece(content: InsertContentPiece): Promise<ContentPiece>;
  updateContentPiece(id: string, updates: Partial<ContentPiece>): Promise<ContentPiece | undefined>;
  deleteContentPiece(id: string): Promise<boolean>;

  // Social Media
  getSocialMediaAccounts(userId: string): Promise<SocialMediaAccount[]>;
  getSocialMediaAccountById(id: string): Promise<SocialMediaAccount | undefined>;
  createSocialMediaAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount>;
  updateSocialMediaAccount(id: string, updates: Partial<SocialMediaAccount>): Promise<SocialMediaAccount | undefined>;

  // SEO
  getSeoKeywords(userId: string): Promise<SeoKeyword[]>;
  createSeoKeyword(keyword: InsertSeoKeyword): Promise<SeoKeyword>;
  updateSeoKeyword(id: string, updates: Partial<SeoKeyword>): Promise<SeoKeyword | undefined>;

  // Market Data
  getMarketData(): Promise<MarketData[]>;
  getMarketDataByNeighborhood(neighborhood: string): Promise<MarketData | undefined>;
  createMarketData(data: InsertMarketData): Promise<MarketData>;
  updateMarketData(id: string, updates: Partial<MarketData>): Promise<MarketData | undefined>;

  // Analytics
  getAnalytics(userId: string, metric?: string): Promise<Analytics[]>;
  createAnalytics(analytics: InsertAnalytics): Promise<Analytics>;

  // Scheduled Posts
  getScheduledPosts(userId: string, status?: string): Promise<ScheduledPost[]>;
  getScheduledPostById(id: string): Promise<ScheduledPost | undefined>;
  createScheduledPost(post: InsertScheduledPost): Promise<ScheduledPost>;
  updateScheduledPost(id: string, updates: Partial<ScheduledPost>): Promise<ScheduledPost | undefined>;
  deleteScheduledPost(id: string): Promise<boolean>;

  // Avatars
  getAvatars(userId: string): Promise<Avatar[]>;
  getAvatarById(id: string): Promise<Avatar | undefined>;
  createAvatar(avatar: InsertAvatar): Promise<Avatar>;
  updateAvatar(id: string, updates: Partial<Avatar>): Promise<Avatar | undefined>;
  deleteAvatar(id: string): Promise<boolean>;

  // Video Content
  getVideoContent(userId: string, status?: string): Promise<VideoContent[]>;
  getVideoById(id: string): Promise<VideoContent | undefined>;
  createVideoContent(video: InsertVideoContent): Promise<VideoContent>;
  updateVideoContent(id: string, updates: Partial<VideoContent>): Promise<VideoContent | undefined>;
  deleteVideoContent(id: string): Promise<boolean>;

  // Custom Voices
  listCustomVoices(userId: string): Promise<CustomVoice[]>;
  getCustomVoice(id: string): Promise<CustomVoice | undefined>;
  createCustomVoice(voice: InsertCustomVoice): Promise<CustomVoice>;
  deleteCustomVoice(id: string, userId: string): Promise<boolean>;

  // Photo Avatar Group Voices
  savePhotoAvatarGroupVoice(voice: InsertPhotoAvatarGroupVoice): Promise<PhotoAvatarGroupVoice>;
  getPhotoAvatarGroupVoice(groupId: string, userId: number): Promise<PhotoAvatarGroupVoice | undefined>;
  listPhotoAvatarGroupVoices(userId: number): Promise<PhotoAvatarGroupVoice[]>;
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
  private photoAvatarGroupVoices: Map<string, PhotoAvatarGroupVoice> = new Map();

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
      { name: "Aksarben", avgPrice: 425000, daysOnMarket: 18, inventory: "0.8 months", priceGrowth: "+15.2%", trend: "hot" },
      { name: "Dundee", avgPrice: 385000, daysOnMarket: 12, inventory: "0.6 months", priceGrowth: "+12.8%", trend: "rising" },
      { name: "Blackstone", avgPrice: 225000, daysOnMarket: 28, inventory: "1.4 months", priceGrowth: "+6.4%", trend: "steady" },
      { name: "Old Market", avgPrice: 350000, daysOnMarket: 22, inventory: "1.1 months", priceGrowth: "+9.1%", trend: "rising" },
      { name: "Benson", avgPrice: 195000, daysOnMarket: 35, inventory: "1.8 months", priceGrowth: "+4.2%", trend: "steady" },
    ];

    neighborhoods.forEach(n => {
      const marketId = randomUUID();
      const market: MarketData = {
        id: marketId,
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

    // Seed SEO keywords
    const keywords = [
      { keyword: "omaha real estate agent", currentRank: 3, searchVolume: 1200, difficulty: 75 },
      { keyword: "dundee homes for sale", currentRank: 1, searchVolume: 450, difficulty: 45, neighborhood: "Dundee" },
      { keyword: "aksarben luxury condos", currentRank: 7, searchVolume: 320, difficulty: 60, neighborhood: "Aksarben" },
      { keyword: "moving to omaha guide", currentRank: 2, searchVolume: 890, difficulty: 55 },
    ];

    keywords.forEach(k => {
      const keywordId = randomUUID();
      const seoKeyword: SeoKeyword = {
        id: keywordId,
        userId,
        keyword: k.keyword,
        currentRank: k.currentRank,
        previousRank: k.currentRank + Math.floor(Math.random() * 3),
        searchVolume: k.searchVolume,
        difficulty: k.difficulty,
        neighborhood: k.neighborhood || null,
        lastChecked: new Date(),
        createdAt: new Date(),
      };
      this.seoKeywords.set(keywordId, seoKeyword);
    });

    // Seed analytics data
    const metrics = [
      { metric: "monthly_leads", value: 847 },
      { metric: "content_published", value: 23 },
      { metric: "seo_ranking", value: 32 }, // avg position * 10
      { metric: "social_engagement", value: 4800 },
      { metric: "site_health", value: 94 },
      { metric: "monthly_visitors", value: 12000 },
    ];

    metrics.forEach(m => {
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

    // Seed scheduled posts focused on local markets and moving to Omaha
    this.generateWeeklyScheduledPosts(userId);

    // Create default avatar for Mike Bjork
    this.createDefaultAvatar(userId);

    // Create sample video content
    this.createSampleVideoContent(userId);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date(),
      role: insertUser.role || "agent"
    };
    this.users.set(id, user);
    return user;
  }

  async getContentPieces(userId: string): Promise<ContentPiece[]> {
    return Array.from(this.contentPieces.values()).filter(content => content.userId === userId);
  }

  async getContentPieceById(id: string): Promise<ContentPiece | undefined> {
    return this.contentPieces.get(id);
  }

  async createContentPiece(insertContent: InsertContentPiece): Promise<ContentPiece> {
    const id = randomUUID();
    const content: ContentPiece = { 
      ...insertContent, 
      id, 
      createdAt: new Date(),
      metadata: insertContent.metadata || null,
      neighborhood: insertContent.neighborhood || null,
      keywords: insertContent.keywords || null,
      seoOptimized: insertContent.seoOptimized || false
    };
    this.contentPieces.set(id, content);
    return content;
  }

  async updateContentPiece(id: string, updates: Partial<ContentPiece>): Promise<ContentPiece | undefined> {
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
    return Array.from(this.socialMediaAccounts.values()).filter(account => account.userId === userId);
  }

  async getSocialMediaAccountById(id: string): Promise<SocialMediaAccount | undefined> {
    return this.socialMediaAccounts.get(id);
  }

  async createSocialMediaAccount(insertAccount: InsertSocialMediaAccount): Promise<SocialMediaAccount> {
    const id = randomUUID();
    const account: SocialMediaAccount = { 
      ...insertAccount, 
      id, 
      createdAt: new Date(),
      metadata: insertAccount.metadata || null,
      accessToken: insertAccount.accessToken || null,
      refreshToken: insertAccount.refreshToken || null,
      isConnected: insertAccount.isConnected || false,
      lastSync: insertAccount.lastSync || null
    };
    this.socialMediaAccounts.set(id, account);
    return account;
  }

  async updateSocialMediaAccount(id: string, updates: Partial<SocialMediaAccount>): Promise<SocialMediaAccount | undefined> {
    const account = this.socialMediaAccounts.get(id);
    if (!account) return undefined;
    
    const updated = { ...account, ...updates };
    this.socialMediaAccounts.set(id, updated);
    return updated;
  }

  async getSeoKeywords(userId: string): Promise<SeoKeyword[]> {
    return Array.from(this.seoKeywords.values()).filter(keyword => keyword.userId === userId);
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
      lastChecked: insertKeyword.lastChecked || null
    };
    this.seoKeywords.set(id, keyword);
    return keyword;
  }

  async updateSeoKeyword(id: string, updates: Partial<SeoKeyword>): Promise<SeoKeyword | undefined> {
    const keyword = this.seoKeywords.get(id);
    if (!keyword) return undefined;
    
    const updated = { ...keyword, ...updates };
    this.seoKeywords.set(id, updated);
    return updated;
  }

  async getMarketData(): Promise<MarketData[]> {
    return Array.from(this.marketData.values());
  }

  async getMarketDataByNeighborhood(neighborhood: string): Promise<MarketData | undefined> {
    return Array.from(this.marketData.values()).find(data => data.neighborhood === neighborhood);
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
      lastUpdated: insertData.lastUpdated || new Date()
    };
    this.marketData.set(id, data);
    return data;
  }

  async updateMarketData(id: string, updates: Partial<MarketData>): Promise<MarketData | undefined> {
    const data = this.marketData.get(id);
    if (!data) return undefined;
    
    const updated = { ...data, ...updates };
    this.marketData.set(id, updated);
    return updated;
  }

  async getAnalytics(userId: string, metric?: string): Promise<Analytics[]> {
    const userAnalytics = Array.from(this.analytics.values()).filter(a => a.userId === userId);
    if (metric) {
      return userAnalytics.filter(a => a.metric === metric);
    }
    return userAnalytics;
  }

  async createAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    const id = randomUUID();
    const analytics: Analytics = { 
      ...insertAnalytics, 
      id,
      metadata: insertAnalytics.metadata || null,
      date: insertAnalytics.date || new Date()
    };
    this.analytics.set(id, analytics);
    return analytics;
  }

  async getScheduledPosts(userId: string, status?: string): Promise<ScheduledPost[]> {
    const userPosts = Array.from(this.scheduledPosts.values()).filter(post => post.userId === userId);
    if (status) {
      return userPosts.filter(post => post.status === status);
    }
    return userPosts.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  async getScheduledPostById(id: string): Promise<ScheduledPost | undefined> {
    return this.scheduledPosts.get(id);
  }

  async createScheduledPost(insertPost: InsertScheduledPost): Promise<ScheduledPost> {
    const id = randomUUID();
    const post: ScheduledPost = {
      ...insertPost,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: insertPost.metadata || null,
      isEdited: insertPost.isEdited || false,
      originalContent: insertPost.originalContent || null,
      neighborhood: insertPost.neighborhood || null,
      hashtags: insertPost.hashtags || null,
      postType: insertPost.postType || null,
      status: insertPost.status || "pending",
      seoScore: insertPost.seoScore ?? 0
    };
    this.scheduledPosts.set(id, post);
    return post;
  }

  async updateScheduledPost(id: string, updates: Partial<ScheduledPost>): Promise<ScheduledPost | undefined> {
    const post = this.scheduledPosts.get(id);
    if (!post) return undefined;
    
    const updated = { 
      ...post, 
      ...updates, 
      updatedAt: new Date(),
      isEdited: updates.content && updates.content !== post.originalContent ? true : post.isEdited
    };
    this.scheduledPosts.set(id, updated);
    return updated;
  }

  async deleteScheduledPost(id: string): Promise<boolean> {
    return this.scheduledPosts.delete(id);
  }

  private generateWeeklyScheduledPosts(userId: string) {
    const neighborhoods = ["Dundee", "Aksarben", "Old Market", "Blackstone", "Benson"];
    const platforms = ["facebook", "instagram", "linkedin", "x"];
    
    const localMarketTopics = [
      "Dundee neighborhood walkability and charm",
      "Aksarben Village amenities and luxury living",
      "Old Market historic character and dining scene",
      "Blackstone emerging arts district",
      "Benson affordable family-friendly community"
    ];
    
    const movingToOmahaTopics = [
      "Best Omaha neighborhoods for families",
      "Omaha job market and major employers",
      "Winter in Omaha: what to expect",
      "Omaha school districts comparison",
      "Cost of living in Omaha vs other cities"
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
        hashtags: platform === "instagram" ? ["OmahaRealEstate", "MovingToOmaha", "NebraskaHomes"] : [],
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

  private createDefaultAvatar(userId: string) {
    const avatar: Avatar = {
      id: randomUUID(),
      userId,
      name: "Mike Bjork - Professional",
      description: "Professional real estate agent avatar for client-facing content",
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
        neighborhood: "Dundee"
      },
      {
        title: "Moving to Omaha: Your Complete Guide",
        topic: "Complete relocation guide for Omaha", 
        videoType: "moving_guide",
        neighborhood: null
      },
      {
        title: "Omaha Market Update - January 2025",
        topic: "Current market trends and opportunities",
        videoType: "market_update", 
        neighborhood: null
      }
    ];

    sampleTopics.forEach((sample, index) => {
      const video: VideoContent = {
        id: randomUUID(),
        userId,
        avatarId: Array.from(this.avatars.values()).find(a => a.userId === userId)?.id || null,
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
        tags: ["OmahaRealEstate", "RealEstateExpert", "HomesBuying", "Nebraska"],
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
    return Array.from(this.avatars.values()).filter(avatar => avatar.userId === userId);
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
      isActive: insertAvatar.isActive !== false
    };
    this.avatars.set(id, avatar);
    return avatar;
  }

  async updateAvatar(id: string, updates: Partial<Avatar>): Promise<Avatar | undefined> {
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
  async getVideoContent(userId: string, status?: string): Promise<VideoContent[]> {
    const userVideos = Array.from(this.videoContent.values()).filter(video => video.userId === userId);
    if (status) {
      return userVideos.filter(video => video.status === status);
    }
    return userVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getVideoById(id: string): Promise<VideoContent | undefined> {
    return this.videoContent.get(id);
  }

  async createVideoContent(insertVideo: InsertVideoContent): Promise<VideoContent> {
    const id = randomUUID();
    const video: VideoContent = {
      ...insertVideo,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
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
      status: insertVideo.status || "draft"
    };
    this.videoContent.set(id, video);
    return video;
  }

  async updateVideoContent(id: string, updates: Partial<VideoContent>): Promise<VideoContent | undefined> {
    const video = this.videoContent.get(id);
    if (!video) return undefined;
    
    const updated = { 
      ...video, 
      ...updates, 
      updatedAt: new Date()
    };
    this.videoContent.set(id, updated);
    return updated;
  }

  async deleteVideoContent(id: string): Promise<boolean> {
    return this.videoContent.delete(id);
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

  async createCustomVoice(insertVoice: InsertCustomVoice): Promise<CustomVoice> {
    const [voice] = await db
      .insert(customVoices)
      .values({
        ...insertVoice,
        duration: insertVoice.duration || null,
        fileSize: insertVoice.fileSize || null,
        heygenAudioAssetId: insertVoice.heygenAudioAssetId || null,
        status: insertVoice.status || 'pending',
      })
      .returning();
    return voice;
  }

  async deleteCustomVoice(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(customVoices)
      .where(
        and(
          eq(customVoices.id, id),
          eq(customVoices.userId, userId)
        )
      );
    return true;
  }

  async savePhotoAvatarGroupVoice(insertVoice: InsertPhotoAvatarGroupVoice): Promise<PhotoAvatarGroupVoice> {
    const [voice] = await db
      .insert(photoAvatarGroupVoices)
      .values({
        ...insertVoice,
        heygenAudioAssetId: insertVoice.heygenAudioAssetId || null,
      })
      .returning();
    return voice;
  }

  async getPhotoAvatarGroupVoice(groupId: string, userId: number): Promise<PhotoAvatarGroupVoice | undefined> {
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

  async listPhotoAvatarGroupVoices(userId: number): Promise<PhotoAvatarGroupVoice[]> {
    return await db
      .select()
      .from(photoAvatarGroupVoices)
      .where(eq(photoAvatarGroupVoices.userId, userId));
  }
}

export const storage = new MemStorage();
