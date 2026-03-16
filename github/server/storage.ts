import {
  type Analytics,
  type Avatar,
  avatars,
  type BrandSettings,
  brandSettings as brandSettingsTable,
  type CompanyProfile,
  companyProfiles,
  type ComplianceSettings,
  complianceSettings as complianceSettingsTable,
  type ContentPiece,
  type CustomVoice,
  customVoices,
  type Event,
  type EventPostSuggestion,
  type EventSource,
  eventPostSuggestions as eventPostSuggestionsTable,
  events as eventsTable,
  eventSources as eventSourcesTable,
  type GeneratedVideo,
  generatedVideos as generatedVideosTable,
  type InsertAnalytics,
  type InsertAvatar,
  type InsertBrandSettings,
  type InsertCompanyProfile,
  type InsertComplianceSettings,
  type InsertContentPiece,
  type InsertCustomVoice,
  type InsertEvent,
  type InsertEventPostSuggestion,
  type InsertEventSource,
  type InsertGeneratedVideo,
  type InsertMarketData,
  type InsertMediaAsset,
  type InsertPhotoAvatar,
  type InsertLookGenerationJob,
  type InsertPhotoAvatarGroup,
  type InsertPhotoAvatarGroupVoice,
  type InsertPostMedia,
  type InsertScheduledPost,
  type InsertSeoKeyword,
  type InsertSocialMediaAccount,
  type InsertTemplateVariable,
  type InsertTwilioConversation,
  type InsertTwilioMessage,
  type InsertTwilioSettings,
  type InsertUser,
  type InsertVideoAvatar,
  type InsertVideoContent,
  type InsertVideoTemplate,
  type InsertVideoGenerationJob,
  type LookGenerationJob,
  lookGenerationJobs,
  type MarketData,
  type MediaAsset,
  mediaAssets,
  type MobileUploadSession,
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
  type TemplateVariable,
  templateVariables as templateVariablesTable,
  type TwilioConversation,
  twilioConversations as twilioConversationsTable,
  type TwilioMessage,
  twilioMessages as twilioMessagesTable,
  type TwilioSettings,
  twilioSettings as twilioSettingsTable,
  type User,
  type VideoAvatar,
  videoAvatars,
  type VideoContent,
  videoContent as videoContentTable,
  type VideoGenerationJob,
  videoGenerationJobs as videoGenerationJobsTable,
  type VideoTemplate,
  videoTemplates as videoTemplatesTable,
  type WhatsappSettings,
  type InsertWhatsappSettings,
  type WhatsappConversation,
  type InsertWhatsappConversation,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type WhatsappBulkQueue,
  type InsertWhatsappBulkQueue,
  whatsappSettings as whatsappSettingsTable,
  whatsappConversations as whatsappConversationsTable,
  whatsappMessages as whatsappMessagesTable,
  whatsappBulkQueues as whatsappBulkQueuesTable,
  whatsappBulkSendResults as whatsappBulkSendResultsTable,
  type MenuItem,
  type InsertMenuItem,
  menuItems as menuItemsTable,
  type BusinessLocation,
  type InsertBusinessLocation,
  businessLocations as businessLocationsTable,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Public Users
  getPublicUserById(id: number): Promise<{ id: number; email: string; role?: string | null } | undefined>;

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
  deleteScheduledPostsBulk(ids: string[], userId: string): Promise<number>;
  deleteAllScheduledPosts(userId: string): Promise<number>;

  // Avatars
  getAvatars(userId: string): Promise<Avatar[]>;
  getAvatarById(id: string): Promise<Avatar | undefined>;
  getAvatarByIdAndUser(id: string, userId: string): Promise<Avatar | undefined>;
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
  getVideoByHeygenId(heygenVideoId: string): Promise<VideoContent | undefined>;
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
  getCustomVoices(userId: string): Promise<CustomVoice[]>;
  getCustomVoice(id: string): Promise<CustomVoice | undefined>;
  getCustomVoiceByIdAndUser(id: string, userId: string): Promise<CustomVoice | undefined>;
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
    userId: string
  ): Promise<PhotoAvatarGroupVoice | undefined>;
  listPhotoAvatarGroupVoices(userId: string): Promise<PhotoAvatarGroupVoice[]>;

  // Individual Photo Avatars (training photos within groups)
  createPhotoAvatar(avatar: InsertPhotoAvatar): Promise<PhotoAvatar>;
  listPhotoAvatarsByGroup(groupId: string): Promise<PhotoAvatar[]>;
  listPhotoAvatarsByUser(userId: string): Promise<any[]>;
  
  // Avatar Looks (trained avatars from HeyGen - uses avatars table)
  getPhotoAvatarByHeygenIdAndUser(
    heygenAvatarId: string,
    userId: string
  ): Promise<Avatar | undefined>;
  updatePhotoAvatar(
    heygenAvatarId: string,
    userId: string,
    updates: Partial<Avatar>
  ): Promise<Avatar | undefined>;
  deletePhotoAvatar(heygenAvatarId: string, userId: string): Promise<boolean>;

  // Video Avatars (Enterprise HeyGen Feature)
  createVideoAvatar(avatar: InsertVideoAvatar): Promise<VideoAvatar>;
  getVideoAvatar(
    userId: string,
    heygenAvatarId: string
  ): Promise<VideoAvatar | undefined>;
  listVideoAvatars(userId: string): Promise<VideoAvatar[]>;
  updateVideoAvatarStatus(
    userId: string,
    heygenAvatarId: string,
    status: string,
    errorMessage?: string
  ): Promise<VideoAvatar | undefined>;
  deleteVideoAvatar(userId: string, heygenAvatarId: string): Promise<boolean>;

  // Company Profile
  getCompanyProfile(userId: string): Promise<CompanyProfile | null>;
  upsertCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;

  // Brand Settings
  getBrandSettings(userId: string): Promise<BrandSettings | null>;
  upsertBrandSettings(settings: InsertBrandSettings): Promise<BrandSettings>;

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

  // Mobile Upload Sessions (for QR code-based mobile uploads)
  createMobileUploadSession(userId: string, type: string): Promise<{ sessionId: string }>;
  getMobileUploadSession(sessionId: string): Promise<MobileUploadSession | null>;
  updateMobileUploadSession(sessionId: string, uploadedUrl: string): Promise<void>;

  // Event Sources (Calendar and Event Feed Sources)
  getEventSources(userId: string): Promise<EventSource[]>;
  getEventSourceById(id: string): Promise<EventSource | undefined>;
  createEventSource(source: InsertEventSource): Promise<EventSource>;
  updateEventSource(id: string, updates: Partial<EventSource>): Promise<EventSource | undefined>;
  deleteEventSource(id: string, userId: string): Promise<boolean>;

  // Events (from various sources)
  getEvents(userId: string, options?: { 
    startDate?: Date; 
    endDate?: Date; 
    sourceId?: string;
    category?: string;
  }): Promise<Event[]>;
  getEventById(id: string): Promise<Event | undefined>;
  getEventByExternalId(userId: string, sourceId: string, externalId: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: string, userId: string): Promise<boolean>;
  deleteEventsBySource(sourceId: string, userId: string): Promise<number>;

  // Event Post Suggestions (AI-generated post ideas for events)
  getEventPostSuggestions(userId: string, eventId?: string): Promise<EventPostSuggestion[]>;
  createEventPostSuggestion(suggestion: InsertEventPostSuggestion): Promise<EventPostSuggestion>;
  updateEventPostSuggestion(id: string, updates: Partial<EventPostSuggestion>): Promise<EventPostSuggestion | undefined>;
  deleteEventPostSuggestion(id: string, userId: string): Promise<boolean>;

  // Compliance Settings (Brokerage Compliance)
  getComplianceSettings(userId: string): Promise<ComplianceSettings | undefined>;
  createComplianceSettings(settings: InsertComplianceSettings): Promise<ComplianceSettings>;
  updateComplianceSettings(userId: string, updates: Partial<ComplianceSettings>): Promise<ComplianceSettings | undefined>;

  // Video Templates
  getVideoTemplates(activeOnly?: boolean): Promise<VideoTemplate[]>;
  getVideoTemplateById(id: string): Promise<VideoTemplate | undefined>;
  getVideoTemplateBySlug(slug: string): Promise<VideoTemplate | undefined>;
  createVideoTemplate(template: InsertVideoTemplate): Promise<VideoTemplate>;
  updateVideoTemplate(id: string, updates: Partial<VideoTemplate>): Promise<VideoTemplate | undefined>;

  // Template Variables
  getTemplateVariables(templateId: string): Promise<TemplateVariable[]>;
  createTemplateVariables(variables: InsertTemplateVariable[]): Promise<TemplateVariable[]>;

  // Generated Videos
  getGeneratedVideos(userId: string): Promise<GeneratedVideo[]>;
  getGeneratedVideoById(id: string): Promise<GeneratedVideo | undefined>;
  createGeneratedVideo(video: InsertGeneratedVideo): Promise<GeneratedVideo>;
  updateGeneratedVideo(id: string, updates: Partial<GeneratedVideo>): Promise<GeneratedVideo | undefined>;

  // Look Generation Jobs
  createLookGenerationJob(job: InsertLookGenerationJob): Promise<LookGenerationJob>;
  getLookGenerationJobsByGroup(groupId: string, userId: string): Promise<LookGenerationJob[]>;
  updateLookGenerationJob(id: string, updates: Partial<LookGenerationJob>): Promise<LookGenerationJob | undefined>;
  getPendingLookGenerationJobs(): Promise<LookGenerationJob[]>;

  // Twilio Settings
  getTwilioSettingsByUserId(userId: string): Promise<TwilioSettings | undefined>;
  getTwilioSettingsByPhoneNumber(phoneNumber: string): Promise<TwilioSettings | undefined>;
  createOrUpdateTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings>;

  // Twilio Conversations
  getTwilioConversationByPhone(userId: string, fromNumber: string): Promise<TwilioConversation | undefined>;
  createTwilioConversation(data: InsertTwilioConversation): Promise<TwilioConversation>;
  updateTwilioConversation(id: string, updates: Partial<TwilioConversation>): Promise<TwilioConversation | undefined>;
  getTwilioConversationsByUserId(userId: string): Promise<TwilioConversation[]>;
  getTwilioConversationById(id: string): Promise<TwilioConversation | undefined>;

  // Twilio Messages
  createTwilioMessage(data: InsertTwilioMessage): Promise<TwilioMessage>;
  getTwilioMessagesByConversationId(conversationId: string): Promise<TwilioMessage[]>;

  // WhatsApp Settings
  getWhatsappSettingsByUserId(userId: string): Promise<WhatsappSettings | undefined>;
  getWhatsappSettingsByPhoneNumberId(phoneNumberId: string): Promise<WhatsappSettings | undefined>;
  createOrUpdateWhatsappSettings(settings: InsertWhatsappSettings): Promise<WhatsappSettings>;

  // WhatsApp Conversations
  getWhatsappConversationByWaId(userId: string, waId: string): Promise<WhatsappConversation | undefined>;
  createWhatsappConversation(data: InsertWhatsappConversation): Promise<WhatsappConversation>;
  updateWhatsappConversation(id: string, updates: Partial<WhatsappConversation>): Promise<WhatsappConversation | undefined>;
  getWhatsappConversationsByUserId(userId: string): Promise<WhatsappConversation[]>;
  getWhatsappConversationById(id: string): Promise<WhatsappConversation | undefined>;

  // WhatsApp Messages
  createWhatsappMessage(data: InsertWhatsappMessage): Promise<WhatsappMessage>;
  getWhatsappMessagesByConversationId(conversationId: string): Promise<WhatsappMessage[]>;

  // WhatsApp Bulk Queues
  createWhatsappBulkQueue(data: InsertWhatsappBulkQueue): Promise<WhatsappBulkQueue>;
  getWhatsappBulkQueuesByUserId(userId: string): Promise<WhatsappBulkQueue[]>;
  getWhatsappBulkQueueById(id: string): Promise<WhatsappBulkQueue | undefined>;
  updateWhatsappBulkQueue(id: string, updates: Partial<WhatsappBulkQueue>): Promise<WhatsappBulkQueue | undefined>;
  getActiveWhatsappBulkQueues(): Promise<WhatsappBulkQueue[]>;

  // WhatsApp Bulk Send Results
  saveWhatsappBulkSendResult(userId: string, data: any): Promise<any>;
  getLatestWhatsappBulkSendResult(userId: string): Promise<any | null>;

  // Menu Items (multi-vertical catalog)
  getMenuItems(userId: string, businessType?: string): Promise<MenuItem[]>;
  getMenuItemById(id: string): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: string): Promise<boolean>;

  // Business Locations
  getBusinessLocations(userId: string): Promise<BusinessLocation[]>;
  getBusinessLocationById(id: string): Promise<BusinessLocation | undefined>;
  createBusinessLocation(location: InsertBusinessLocation): Promise<BusinessLocation>;
  updateBusinessLocation(id: string, updates: Partial<BusinessLocation>): Promise<BusinessLocation | undefined>;
  deleteBusinessLocation(id: string): Promise<boolean>;
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
  private mobileUploadSessions: Map<string, MobileUploadSession> = new Map();
  private eventSources: Map<string, EventSource> = new Map();
  private events: Map<string, Event> = new Map();
  private eventPostSuggestions: Map<string, EventPostSuggestion> = new Map();
  private complianceSettings: Map<string, ComplianceSettings> = new Map();
  private videoTemplates: Map<string, VideoTemplate> = new Map();
  private templateVariables: Map<string, TemplateVariable> = new Map();
  private generatedVideos: Map<string, GeneratedVideo> = new Map();

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

  async getPublicUserById(id: number): Promise<{ id: number; email: string; role?: string | null } | undefined> {
    try {
      const { db } = await import("./db");
      const { publicUsers } = await import("@shared/schema");
      const result = await db.select({
        id: publicUsers.id,
        email: publicUsers.email,
        role: publicUsers.role,
      }).from(publicUsers).where(eq(publicUsers.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error(`[STORAGE] getPublicUserById(${id}) - Error:`, error);
      return undefined;
    }
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

  async getAllUsers(): Promise<User[]> {
    const memUsers = Array.from(this.users.values());
    
    try {
      const { db } = await import("./db");
      const dbUsers = await db.query.users.findMany();
      
      const allUsers = [...memUsers];
      for (const dbUser of dbUsers) {
        if (!allUsers.some(u => u.id === dbUser.id)) {
          allUsers.push(dbUser as User);
        }
      }
      
      return allUsers;
    } catch (error) {
      console.error('[STORAGE] getAllUsers - Database error:', error);
      return memUsers;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // 🔥 FIX: Use passed ID if provided, otherwise generate new UUID
    const id = (insertUser as any).id || randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
      role: insertUser.role || "agent",
    };
    this.users.set(id, user);
    console.log(
      `[STORAGE] createUser - Created user with ID: ${id} (email: ${insertUser.email})`
    );
    return user;
  }

  async getContentPieces(userId: string): Promise<ContentPiece[]> {
    try {
      const { db } = await import("./db");
      const { contentPieces: contentPiecesTable } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const rows = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.userId, userId)).orderBy(desc(contentPiecesTable.createdAt));
      return rows;
    } catch (error) {
      console.error("[STORAGE] getContentPieces DB error, falling back to memory:", error);
      return Array.from(this.contentPieces.values()).filter(
        (content) => content.userId === userId
      );
    }
  }

  async getContentPieceById(id: string): Promise<ContentPiece | undefined> {
    try {
      const { db } = await import("./db");
      const { contentPieces: contentPiecesTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, id));
      return rows[0] || undefined;
    } catch (error) {
      console.error("[STORAGE] getContentPieceById DB error:", error);
      return this.contentPieces.get(id);
    }
  }

  async createContentPiece(
    insertContent: InsertContentPiece
  ): Promise<ContentPiece> {
    try {
      const { db } = await import("./db");
      const { contentPieces: contentPiecesTable } = await import("@shared/schema");
      const [created] = await db.insert(contentPiecesTable).values({
        userId: insertContent.userId,
        type: insertContent.type,
        title: insertContent.title,
        content: insertContent.content,
        keywords: insertContent.keywords || null,
        neighborhood: insertContent.neighborhood || null,
        seoOptimized: insertContent.seoOptimized || false,
        status: insertContent.status || "draft",
        publishedAt: insertContent.publishedAt || null,
        scheduledFor: insertContent.scheduledFor || null,
        socialPlatforms: insertContent.socialPlatforms || null,
        metadata: insertContent.metadata || null,
      }).returning();
      return created;
    } catch (error) {
      console.error("[STORAGE] createContentPiece DB error, falling back to memory:", error);
      const id = randomUUID();
      const content: ContentPiece = {
        ...insertContent,
        id,
        createdAt: new Date(),
        metadata: insertContent.metadata || null,
        neighborhood: insertContent.neighborhood || null,
        keywords: insertContent.keywords || null,
        seoOptimized: insertContent.seoOptimized || false,
        status: insertContent.status || "draft",
        publishedAt: insertContent.publishedAt || null,
        scheduledFor: insertContent.scheduledFor || null,
      };
      this.contentPieces.set(id, content);
      return content;
    }
  }

  async updateContentPiece(
    id: string,
    updates: Partial<ContentPiece>
  ): Promise<ContentPiece | undefined> {
    try {
      const { db } = await import("./db");
      const { contentPieces: contentPiecesTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [updated] = await db.update(contentPiecesTable).set(updates).where(eq(contentPiecesTable.id, id)).returning();
      return updated || undefined;
    } catch (error) {
      console.error("[STORAGE] updateContentPiece DB error:", error);
      const content = this.contentPieces.get(id);
      if (!content) return undefined;
      const updated = { ...content, ...updates };
      this.contentPieces.set(id, updated);
      return updated;
    }
  }

  async deleteContentPiece(id: string): Promise<boolean> {
    try {
      const { db } = await import("./db");
      const { contentPieces: contentPiecesTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const result = await db.delete(contentPiecesTable).where(eq(contentPiecesTable.id, id));
      return true;
    } catch (error) {
      console.error("[STORAGE] deleteContentPiece DB error:", error);
      return this.contentPieces.delete(id);
    }
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
      lastUpdated: new Date(),
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

  async deleteScheduledPostsBulk(ids: string[], userId: string): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db
      .delete(scheduledPostsTable)
      .where(
        and(
          inArray(scheduledPostsTable.id, ids),
          eq(scheduledPostsTable.userId, userId)
        )
      )
      .returning();
    return result.length;
  }

  async deleteAllScheduledPosts(userId: string): Promise<number> {
    const result = await db
      .delete(scheduledPostsTable)
      .where(eq(scheduledPostsTable.userId, userId))
      .returning();
    return result.length;
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
        isAiGenerated: true,
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
        platform: null,
        heygenVideoId: null,
        heygenAvatarId: null,
        heygenVoiceId: null,
        heygenTemplateId: null,
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

  async getAvatarByIdAndUser(id: string, userId: string): Promise<Avatar | undefined> {
    const avatar = this.avatars.get(id);
    if (avatar && avatar.userId === userId) {
      return avatar;
    }
    return undefined;
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

  async getVideoByHeygenId(heygenVideoId: string): Promise<VideoContent | undefined> {
    const [video] = await db
      .select()
      .from(videoContentTable)
      .where(eq(videoContentTable.heygenVideoId, heygenVideoId))
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

  async getCustomVoices(userId: string): Promise<CustomVoice[]> {
    return this.listCustomVoices(userId);
  }

  async getCustomVoice(id: string): Promise<CustomVoice | undefined> {
    const [voice] = await db
      .select()
      .from(customVoices)
      .where(eq(customVoices.id, id))
      .limit(1);
    return voice;
  }

  async getCustomVoiceByIdAndUser(id: string, userId: string): Promise<CustomVoice | undefined> {
    const [voice] = await db
      .select()
      .from(customVoices)
      .where(and(eq(customVoices.id, id), eq(customVoices.userId, userId)))
      .limit(1);
    return voice;
  }

  async createCustomVoice(
    insertVoice: InsertCustomVoice
  ): Promise<CustomVoice> {
    const [voice] = await db
      .insert(customVoices)
      .values(insertVoice)
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
    userId: string
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
    userId: string
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
    console.log(`📸 [STORAGE] listPhotoAvatarGroups called with userId: "${userId}"`);
    const result = await db
      .select()
      .from(photoAvatarGroups)
      .where(eq(photoAvatarGroups.userId, userId));
    console.log(`📸 [STORAGE] Found ${result.length} groups, group user_ids: ${result.map(g => g.userId).join(', ')}`);
    return result;
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

  async listPhotoAvatarsByGroup(groupId: string): Promise<PhotoAvatar[]> {
    return await db
      .select()
      .from(photoAvatars)
      .where(eq(photoAvatars.groupId, groupId));
  }

  async listPhotoAvatarsByUser(userId: string): Promise<any[]> {
    const results = await db
      .select({
        id: lookGenerationJobs.id,
        groupId: lookGenerationJobs.groupId,
        photoUrl: lookGenerationJobs.resultImageUrl,
        lookLabel: lookGenerationJobs.lookLabel,
        lookName: lookGenerationJobs.lookName,
        prompt: lookGenerationJobs.prompt,
        status: lookGenerationJobs.status,
        createdAt: lookGenerationJobs.createdAt,
        groupName: photoAvatarGroups.groupName,
      })
      .from(lookGenerationJobs)
      .leftJoin(photoAvatarGroups, eq(lookGenerationJobs.groupId, photoAvatarGroups.heygenGroupId))
      .where(eq(lookGenerationJobs.userId, userId))
      .orderBy(lookGenerationJobs.createdAt);
    return results;
  }

  async getPhotoAvatarByHeygenIdAndUser(
    heygenAvatarId: string,
    userId: string
  ): Promise<Avatar | undefined> {
    // Use avatars table for individual avatar looks (not photoAvatars which is for training photos)
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(
        and(
          eq(avatars.heygenAvatarId, heygenAvatarId),
          eq(avatars.userId, userId)
        )
      )
      .limit(1);
    return avatar;
  }

  async updatePhotoAvatar(
    heygenAvatarId: string,
    userId: string,
    updates: Partial<Avatar>
  ): Promise<Avatar | undefined> {
    // Use avatars table for individual avatar looks (not photoAvatars which is for training photos)
    const [result] = await db
      .update(avatars)
      .set(updates)
      .where(
        and(
          eq(avatars.heygenAvatarId, heygenAvatarId),
          eq(avatars.userId, userId)
        )
      )
      .returning();
    return result;
  }

  async deletePhotoAvatar(
    heygenAvatarId: string,
    userId: string
  ): Promise<boolean> {
    // Use avatars table for individual avatar looks (not photoAvatars which is for training photos)
    const result = await db
      .delete(avatars)
      .where(
        and(
          eq(avatars.heygenAvatarId, heygenAvatarId),
          eq(avatars.userId, userId)
        )
      );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Video Avatars (Enterprise HeyGen Feature)
  async createVideoAvatar(avatar: InsertVideoAvatar): Promise<VideoAvatar> {
    const [result] = await db.insert(videoAvatars).values(avatar).returning();
    return result;
  }

  async getVideoAvatar(
    userId: string,
    heygenAvatarId: string
  ): Promise<VideoAvatar | undefined> {
    const [avatar] = await db
      .select()
      .from(videoAvatars)
      .where(
        and(
          eq(videoAvatars.heygenAvatarId, heygenAvatarId),
          eq(videoAvatars.userId, userId)
        )
      )
      .limit(1);
    return avatar;
  }

  async listVideoAvatars(userId: string): Promise<VideoAvatar[]> {
    return await db
      .select()
      .from(videoAvatars)
      .where(eq(videoAvatars.userId, userId))
      .orderBy(desc(videoAvatars.createdAt));
  }

  async updateVideoAvatarStatus(
    userId: string,
    heygenAvatarId: string,
    status: string,
    errorMessage?: string
  ): Promise<VideoAvatar | undefined> {
    const updates: any = {
      status,
      errorMessage: errorMessage || null,
    };

    if (status === "complete") {
      updates.completedAt = new Date();
    }

    const [result] = await db
      .update(videoAvatars)
      .set(updates)
      .where(
        and(
          eq(videoAvatars.heygenAvatarId, heygenAvatarId),
          eq(videoAvatars.userId, userId)
        )
      )
      .returning();
    return result;
  }

  async deleteVideoAvatar(
    userId: string,
    heygenAvatarId: string
  ): Promise<boolean> {
    const result = await db
      .delete(videoAvatars)
      .where(
        and(
          eq(videoAvatars.heygenAvatarId, heygenAvatarId),
          eq(videoAvatars.userId, userId)
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

  async getBrandSettings(userId: string): Promise<BrandSettings | null> {
    const [settings] = await db
      .select()
      .from(brandSettingsTable)
      .where(eq(brandSettingsTable.userId, userId))
      .limit(1);
    return settings || null;
  }

  async upsertBrandSettings(
    settings: InsertBrandSettings
  ): Promise<BrandSettings> {
    const [result] = await db
      .insert(brandSettingsTable)
      .values(settings)
      .onConflictDoUpdate({
        target: brandSettingsTable.userId,
        set: {
          ...settings,
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
    // Use database for persistent storage with proper conditional filtering
    const conditions = [eq(mediaAssets.userId, userId)];
    
    if (type) {
      conditions.push(eq(mediaAssets.type, type));
    }
    
    if (source) {
      conditions.push(eq(mediaAssets.source, source));
    }
    
    // Drizzle's and() handles arrays properly
    const assets = await db
      .select()
      .from(mediaAssets)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(mediaAssets.createdAt));
    
    return assets;
  }

  async getMediaAssetById(id: string): Promise<MediaAsset | undefined> {
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    return asset;
  }

  async createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset> {
    const [newAsset] = await db
      .insert(mediaAssets)
      .values({
        id: randomUUID(),
        ...asset,
        title: asset.title ?? null,
        description: asset.description ?? null,
        metadata: asset.metadata ?? null,
        createdAt: new Date(),
      })
      .returning();
    return newAsset;
  }

  async updateMediaAsset(
    id: string,
    updates: Partial<MediaAsset>
  ): Promise<MediaAsset | undefined> {
    const [updated] = await db
      .update(mediaAssets)
      .set(updates)
      .where(eq(mediaAssets.id, id))
      .returning();
    return updated;
  }

  async deleteMediaAsset(id: string): Promise<boolean> {
    const result = await db
      .delete(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .returning();
    return result.length > 0;
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

  async createMobileUploadSession(userId: string, type: string): Promise<{ sessionId: string }> {
    const { nanoid } = await import("nanoid");
    const sessionId = nanoid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const session: MobileUploadSession = {
      id: sessionId,
      userId,
      type: type as "training" | "consent",
      createdAt: now,
      expiresAt,
      uploadedUrl: null,
    };

    this.mobileUploadSessions.set(sessionId, session);
    return { sessionId };
  }

  async getMobileUploadSession(sessionId: string): Promise<MobileUploadSession | null> {
    const session = this.mobileUploadSessions.get(sessionId);
    if (!session) return null;

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      this.mobileUploadSessions.delete(sessionId);
      return null;
    }

    return session;
  }

  async updateMobileUploadSession(sessionId: string, uploadedUrl: string): Promise<void> {
    const session = this.mobileUploadSessions.get(sessionId);
    if (session) {
      session.uploadedUrl = uploadedUrl;
      this.mobileUploadSessions.set(sessionId, session);
    }
  }

  // Event Sources implementation
  async getEventSources(userId: string): Promise<EventSource[]> {
    return db
      .select()
      .from(eventSourcesTable)
      .where(eq(eventSourcesTable.userId, userId))
      .orderBy(desc(eventSourcesTable.createdAt));
  }

  async getEventSourceById(id: string): Promise<EventSource | undefined> {
    const [source] = await db
      .select()
      .from(eventSourcesTable)
      .where(eq(eventSourcesTable.id, id));
    return source;
  }

  async createEventSource(source: InsertEventSource): Promise<EventSource> {
    const [created] = await db
      .insert(eventSourcesTable)
      .values(source)
      .returning();
    return created;
  }

  async updateEventSource(id: string, updates: Partial<EventSource>): Promise<EventSource | undefined> {
    const [updated] = await db
      .update(eventSourcesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(eventSourcesTable.id, id))
      .returning();
    return updated;
  }

  async deleteEventSource(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(eventSourcesTable)
      .where(and(eq(eventSourcesTable.id, id), eq(eventSourcesTable.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Events implementation
  async getEvents(userId: string, options?: { 
    startDate?: Date; 
    endDate?: Date; 
    sourceId?: string;
    category?: string;
  }): Promise<Event[]> {
    const { gte, lte } = await import("drizzle-orm");
    
    let query = db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.userId, userId));

    const conditions: any[] = [eq(eventsTable.userId, userId)];
    
    if (options?.startDate) {
      conditions.push(gte(eventsTable.startTime, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(eventsTable.startTime, options.endDate));
    }
    if (options?.sourceId) {
      conditions.push(eq(eventsTable.sourceId, options.sourceId));
    }
    if (options?.category) {
      conditions.push(eq(eventsTable.category, options.category));
    }

    return db
      .select()
      .from(eventsTable)
      .where(and(...conditions))
      .orderBy(eventsTable.startTime);
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, id));
    return event;
  }

  async getEventByExternalId(userId: string, sourceId: string, externalId: string): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(
        eq(eventsTable.userId, userId),
        eq(eventsTable.sourceId, sourceId),
        eq(eventsTable.externalId, externalId)
      ));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db
      .insert(eventsTable)
      .values(event)
      .returning();
    return created;
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined> {
    const [updated] = await db
      .update(eventsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(eventsTable.id, id))
      .returning();
    return updated;
  }

  async deleteEvent(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(eventsTable)
      .where(and(eq(eventsTable.id, id), eq(eventsTable.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteEventsBySource(sourceId: string, userId: string): Promise<number> {
    const result = await db
      .delete(eventsTable)
      .where(and(eq(eventsTable.sourceId, sourceId), eq(eventsTable.userId, userId)));
    return result.rowCount ?? 0;
  }

  // Event Post Suggestions implementation
  async getEventPostSuggestions(userId: string, eventId?: string): Promise<EventPostSuggestion[]> {
    if (eventId) {
      return db
        .select()
        .from(eventPostSuggestionsTable)
        .where(and(
          eq(eventPostSuggestionsTable.userId, userId),
          eq(eventPostSuggestionsTable.eventId, eventId)
        ))
        .orderBy(desc(eventPostSuggestionsTable.createdAt));
    }
    
    return db
      .select()
      .from(eventPostSuggestionsTable)
      .where(eq(eventPostSuggestionsTable.userId, userId))
      .orderBy(desc(eventPostSuggestionsTable.createdAt));
  }

  async createEventPostSuggestion(suggestion: InsertEventPostSuggestion): Promise<EventPostSuggestion> {
    const [created] = await db
      .insert(eventPostSuggestionsTable)
      .values(suggestion)
      .returning();
    return created;
  }

  async updateEventPostSuggestion(id: string, updates: Partial<EventPostSuggestion>): Promise<EventPostSuggestion | undefined> {
    const [updated] = await db
      .update(eventPostSuggestionsTable)
      .set(updates)
      .where(eq(eventPostSuggestionsTable.id, id))
      .returning();
    return updated;
  }

  async deleteEventPostSuggestion(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(eventPostSuggestionsTable)
      .where(and(
        eq(eventPostSuggestionsTable.id, id),
        eq(eventPostSuggestionsTable.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  // Compliance Settings implementation
  async getComplianceSettings(userId: string): Promise<ComplianceSettings | undefined> {
    const [settings] = await db
      .select()
      .from(complianceSettingsTable)
      .where(eq(complianceSettingsTable.userId, userId));
    return settings;
  }

  async createComplianceSettings(settings: InsertComplianceSettings): Promise<ComplianceSettings> {
    const [created] = await db
      .insert(complianceSettingsTable)
      .values(settings)
      .returning();
    return created;
  }

  async updateComplianceSettings(userId: string, updates: Partial<ComplianceSettings>): Promise<ComplianceSettings | undefined> {
    const [updated] = await db
      .update(complianceSettingsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(complianceSettingsTable.userId, userId))
      .returning();
    return updated;
  }

  // Video Templates
  async getVideoTemplates(activeOnly: boolean = true): Promise<VideoTemplate[]> {
    if (activeOnly) {
      return await db
        .select()
        .from(videoTemplatesTable)
        .where(eq(videoTemplatesTable.isActive, true))
        .orderBy(videoTemplatesTable.sortOrder);
    }
    return await db
      .select()
      .from(videoTemplatesTable)
      .orderBy(videoTemplatesTable.sortOrder);
  }

  async getVideoTemplateById(id: string): Promise<VideoTemplate | undefined> {
    const [template] = await db
      .select()
      .from(videoTemplatesTable)
      .where(eq(videoTemplatesTable.id, id));
    return template;
  }

  async getVideoTemplateBySlug(slug: string): Promise<VideoTemplate | undefined> {
    const [template] = await db
      .select()
      .from(videoTemplatesTable)
      .where(eq(videoTemplatesTable.slug, slug));
    return template;
  }

  async createVideoTemplate(template: InsertVideoTemplate): Promise<VideoTemplate> {
    const [newTemplate] = await db
      .insert(videoTemplatesTable)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateVideoTemplate(id: string, updates: Partial<VideoTemplate>): Promise<VideoTemplate | undefined> {
    const [updated] = await db
      .update(videoTemplatesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoTemplatesTable.id, id))
      .returning();
    return updated;
  }

  // Template Variables
  async getTemplateVariables(templateId: string): Promise<TemplateVariable[]> {
    return await db
      .select()
      .from(templateVariablesTable)
      .where(eq(templateVariablesTable.templateId, templateId))
      .orderBy(templateVariablesTable.orderIndex);
  }

  async createTemplateVariables(variables: InsertTemplateVariable[]): Promise<TemplateVariable[]> {
    if (variables.length === 0) return [];
    return await db
      .insert(templateVariablesTable)
      .values(variables)
      .returning();
  }

  // Generated Videos
  async getGeneratedVideos(userId: string): Promise<GeneratedVideo[]> {
    return await db
      .select()
      .from(generatedVideosTable)
      .where(eq(generatedVideosTable.userId, userId))
      .orderBy(desc(generatedVideosTable.createdAt));
  }

  async getGeneratedVideoById(id: string): Promise<GeneratedVideo | undefined> {
    const [video] = await db
      .select()
      .from(generatedVideosTable)
      .where(eq(generatedVideosTable.id, id));
    return video;
  }

  async createGeneratedVideo(video: InsertGeneratedVideo): Promise<GeneratedVideo> {
    const [newVideo] = await db
      .insert(generatedVideosTable)
      .values(video)
      .returning();
    return newVideo;
  }

  async updateGeneratedVideo(id: string, updates: Partial<GeneratedVideo>): Promise<GeneratedVideo | undefined> {
    const [updated] = await db
      .update(generatedVideosTable)
      .set(updates)
      .where(eq(generatedVideosTable.id, id))
      .returning();
    return updated;
  }

  // Look Generation Jobs
  async createLookGenerationJob(job: InsertLookGenerationJob): Promise<LookGenerationJob> {
    const [newJob] = await db
      .insert(lookGenerationJobs)
      .values(job)
      .returning();
    return newJob;
  }

  async getLookGenerationJobsByGroup(groupId: string, userId: string): Promise<LookGenerationJob[]> {
    return await db
      .select()
      .from(lookGenerationJobs)
      .where(
        and(
          eq(lookGenerationJobs.groupId, groupId),
          eq(lookGenerationJobs.userId, userId)
        )
      )
      .orderBy(desc(lookGenerationJobs.createdAt));
  }

  async updateLookGenerationJob(id: string, updates: Partial<LookGenerationJob>): Promise<LookGenerationJob | undefined> {
    const [updated] = await db
      .update(lookGenerationJobs)
      .set(updates)
      .where(eq(lookGenerationJobs.id, id))
      .returning();
    return updated;
  }

  async getPendingLookGenerationJobs(): Promise<LookGenerationJob[]> {
    return await db
      .select()
      .from(lookGenerationJobs)
      .where(eq(lookGenerationJobs.status, "pending"));
  }

  // Video Generation Jobs (Background Processing)
  async createVideoGenerationJob(job: InsertVideoGenerationJob): Promise<VideoGenerationJob> {
    const [newJob] = await db
      .insert(videoGenerationJobsTable)
      .values(job)
      .returning();
    return newJob;
  }

  async getVideoGenerationJob(id: string): Promise<VideoGenerationJob | undefined> {
    const [job] = await db
      .select()
      .from(videoGenerationJobsTable)
      .where(eq(videoGenerationJobsTable.id, id));
    return job;
  }

  async getVideoGenerationJobsByUser(userId: string): Promise<VideoGenerationJob[]> {
    return await db
      .select()
      .from(videoGenerationJobsTable)
      .where(eq(videoGenerationJobsTable.userId, userId))
      .orderBy(desc(videoGenerationJobsTable.createdAt));
  }

  async getPendingVideoGenerationJobs(): Promise<VideoGenerationJob[]> {
    return await db
      .select()
      .from(videoGenerationJobsTable)
      .where(
        eq(videoGenerationJobsTable.status, "pending")
      );
  }

  async getProcessingVideoGenerationJobs(): Promise<VideoGenerationJob[]> {
    return await db
      .select()
      .from(videoGenerationJobsTable)
      .where(
        eq(videoGenerationJobsTable.status, "processing")
      );
  }

  async updateVideoGenerationJob(id: string, updates: Partial<VideoGenerationJob>): Promise<VideoGenerationJob | undefined> {
    const [updated] = await db
      .update(videoGenerationJobsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoGenerationJobsTable.id, id))
      .returning();
    return updated;
  }

  // Twilio Settings
  async getTwilioSettingsByUserId(userId: string): Promise<TwilioSettings | undefined> {
    const [settings] = await db
      .select()
      .from(twilioSettingsTable)
      .where(eq(twilioSettingsTable.userId, userId));
    return settings;
  }

  async getTwilioSettingsByPhoneNumber(phoneNumber: string): Promise<TwilioSettings | undefined> {
    const [settings] = await db
      .select()
      .from(twilioSettingsTable)
      .where(eq(twilioSettingsTable.phoneNumber, phoneNumber));
    return settings;
  }

  async createOrUpdateTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings> {
    const [result] = await db
      .insert(twilioSettingsTable)
      .values(settings)
      .onConflictDoUpdate({
        target: twilioSettingsTable.userId,
        set: { ...settings, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  // Twilio Conversations
  async getTwilioConversationByPhone(userId: string, fromNumber: string): Promise<TwilioConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(twilioConversationsTable)
      .where(
        and(
          eq(twilioConversationsTable.userId, userId),
          eq(twilioConversationsTable.fromNumber, fromNumber)
        )
      );
    return conversation;
  }

  async createTwilioConversation(data: InsertTwilioConversation): Promise<TwilioConversation> {
    const [conversation] = await db
      .insert(twilioConversationsTable)
      .values(data)
      .returning();
    return conversation;
  }

  async updateTwilioConversation(id: string, updates: Partial<TwilioConversation>): Promise<TwilioConversation | undefined> {
    const [updated] = await db
      .update(twilioConversationsTable)
      .set(updates)
      .where(eq(twilioConversationsTable.id, id))
      .returning();
    return updated;
  }

  async getTwilioConversationsByUserId(userId: string): Promise<TwilioConversation[]> {
    return await db
      .select()
      .from(twilioConversationsTable)
      .where(eq(twilioConversationsTable.userId, userId))
      .orderBy(desc(twilioConversationsTable.lastMessageAt));
  }

  async getTwilioConversationById(id: string): Promise<TwilioConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(twilioConversationsTable)
      .where(eq(twilioConversationsTable.id, id));
    return conversation;
  }

  // Twilio Messages
  async createTwilioMessage(data: InsertTwilioMessage): Promise<TwilioMessage> {
    const [message] = await db
      .insert(twilioMessagesTable)
      .values(data)
      .returning();
    return message;
  }

  async getTwilioMessagesByConversationId(conversationId: string): Promise<TwilioMessage[]> {
    return await db
      .select()
      .from(twilioMessagesTable)
      .where(eq(twilioMessagesTable.conversationId, conversationId))
      .orderBy(twilioMessagesTable.createdAt);
  }

  // WhatsApp Settings
  async getWhatsappSettingsByUserId(userId: string): Promise<WhatsappSettings | undefined> {
    const [settings] = await db
      .select()
      .from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.userId, userId));
    return settings;
  }

  async getWhatsappSettingsByPhoneNumberId(phoneNumberId: string): Promise<WhatsappSettings | undefined> {
    const [settings] = await db
      .select()
      .from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.phoneNumberId, phoneNumberId));
    return settings;
  }

  async createOrUpdateWhatsappSettings(settings: InsertWhatsappSettings): Promise<WhatsappSettings> {
    const [result] = await db
      .insert(whatsappSettingsTable)
      .values(settings)
      .onConflictDoUpdate({
        target: whatsappSettingsTable.userId,
        set: { ...settings, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  // WhatsApp Conversations
  async getWhatsappConversationByWaId(userId: string, waId: string): Promise<WhatsappConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(whatsappConversationsTable)
      .where(
        and(
          eq(whatsappConversationsTable.userId, userId),
          eq(whatsappConversationsTable.waId, waId)
        )
      );
    return conversation;
  }

  async createWhatsappConversation(data: InsertWhatsappConversation): Promise<WhatsappConversation> {
    const [conversation] = await db
      .insert(whatsappConversationsTable)
      .values(data)
      .returning();
    return conversation;
  }

  async updateWhatsappConversation(id: string, updates: Partial<WhatsappConversation>): Promise<WhatsappConversation | undefined> {
    const [updated] = await db
      .update(whatsappConversationsTable)
      .set(updates)
      .where(eq(whatsappConversationsTable.id, id))
      .returning();
    return updated;
  }

  async getWhatsappConversationsByUserId(userId: string): Promise<WhatsappConversation[]> {
    return await db
      .select()
      .from(whatsappConversationsTable)
      .where(eq(whatsappConversationsTable.userId, userId))
      .orderBy(desc(whatsappConversationsTable.lastMessageAt));
  }

  async getWhatsappConversationById(id: string): Promise<WhatsappConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(whatsappConversationsTable)
      .where(eq(whatsappConversationsTable.id, id));
    return conversation;
  }

  // WhatsApp Messages
  async createWhatsappMessage(data: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [message] = await db
      .insert(whatsappMessagesTable)
      .values(data)
      .returning();
    return message;
  }

  async getWhatsappMessagesByConversationId(conversationId: string): Promise<WhatsappMessage[]> {
    return await db
      .select()
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.conversationId, conversationId))
      .orderBy(whatsappMessagesTable.createdAt);
  }

  async getMenuItems(userId: string, businessType?: string): Promise<MenuItem[]> {
    const conditions = [eq(menuItemsTable.userId, userId)];
    if (businessType) conditions.push(eq(menuItemsTable.businessType, businessType));
    return await db
      .select()
      .from(menuItemsTable)
      .where(and(...conditions))
      .orderBy(menuItemsTable.sortOrder, menuItemsTable.createdAt);
  }

  async getMenuItemById(id: string): Promise<MenuItem | undefined> {
    const [item] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, id));
    return item;
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [created] = await db.insert(menuItemsTable).values(item).returning();
    return created;
  }

  async updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem | undefined> {
    const [updated] = await db
      .update(menuItemsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(menuItemsTable.id, id))
      .returning();
    return updated;
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    const result = await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
    return true;
  }

  async getBusinessLocations(userId: string): Promise<BusinessLocation[]> {
    return await db
      .select()
      .from(businessLocationsTable)
      .where(eq(businessLocationsTable.userId, userId))
      .orderBy(businessLocationsTable.isPrimary, businessLocationsTable.createdAt);
  }

  async getBusinessLocationById(id: string): Promise<BusinessLocation | undefined> {
    const [location] = await db.select().from(businessLocationsTable).where(eq(businessLocationsTable.id, id));
    return location;
  }

  async createBusinessLocation(location: InsertBusinessLocation): Promise<BusinessLocation> {
    const [created] = await db.insert(businessLocationsTable).values(location).returning();
    return created;
  }

  async updateBusinessLocation(id: string, updates: Partial<BusinessLocation>): Promise<BusinessLocation | undefined> {
    const [updated] = await db
      .update(businessLocationsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(businessLocationsTable.id, id))
      .returning();
    return updated;
  }

  async deleteBusinessLocation(id: string): Promise<boolean> {
    await db.delete(businessLocationsTable).where(eq(businessLocationsTable.id, id));
    return true;
  }

  async createWhatsappBulkQueue(data: InsertWhatsappBulkQueue): Promise<WhatsappBulkQueue> {
    const [created] = await db.insert(whatsappBulkQueuesTable).values(data).returning();
    return created;
  }

  async getWhatsappBulkQueuesByUserId(userId: string): Promise<WhatsappBulkQueue[]> {
    return await db
      .select()
      .from(whatsappBulkQueuesTable)
      .where(eq(whatsappBulkQueuesTable.userId, userId))
      .orderBy(sql`created_at DESC`);
  }

  async getWhatsappBulkQueueById(id: string): Promise<WhatsappBulkQueue | undefined> {
    const [queue] = await db.select().from(whatsappBulkQueuesTable).where(eq(whatsappBulkQueuesTable.id, id));
    return queue;
  }

  async updateWhatsappBulkQueue(id: string, updates: Partial<WhatsappBulkQueue>): Promise<WhatsappBulkQueue | undefined> {
    const [updated] = await db
      .update(whatsappBulkQueuesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(whatsappBulkQueuesTable.id, id))
      .returning();
    return updated;
  }

  async getActiveWhatsappBulkQueues(): Promise<WhatsappBulkQueue[]> {
    return await db
      .select()
      .from(whatsappBulkQueuesTable)
      .where(eq(whatsappBulkQueuesTable.status, "active"));
  }

  async saveWhatsappBulkSendResult(userId: string, data: any): Promise<any> {
    const existing = await db
      .select()
      .from(whatsappBulkSendResultsTable)
      .where(eq(whatsappBulkSendResultsTable.userId, userId))
      .orderBy(sql`created_at DESC`)
      .limit(1);

    if (existing.length > 0 && !existing[0].complete) {
      const [updated] = await db
        .update(whatsappBulkSendResultsTable)
        .set({
          sent: data.sent ?? 0,
          failed: data.failed ?? 0,
          total: data.total ?? 0,
          queued: data.queued ?? 0,
          percent: data.percent ?? 0,
          elapsed: data.elapsed ?? 0,
          estimatedCost: data.estimatedCost ? String(data.estimatedCost) : null,
          errorBreakdown: data.errorBreakdown ? JSON.stringify(data.errorBreakdown) : null,
          complete: data.complete ?? false,
          message: data.message ?? null,
          bulkQueueId: data.bulkQueueId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(whatsappBulkSendResultsTable.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(whatsappBulkSendResultsTable)
      .values({
        userId,
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
        total: data.total ?? 0,
        queued: data.queued ?? 0,
        percent: data.percent ?? 0,
        elapsed: data.elapsed ?? 0,
        estimatedCost: data.estimatedCost ? String(data.estimatedCost) : null,
        errorBreakdown: data.errorBreakdown ? JSON.stringify(data.errorBreakdown) : null,
        complete: data.complete ?? false,
        message: data.message ?? null,
        bulkQueueId: data.bulkQueueId ?? null,
      })
      .returning();
    return created;
  }

  async getLatestWhatsappBulkSendResult(userId: string): Promise<any | null> {
    const [result] = await db
      .select()
      .from(whatsappBulkSendResultsTable)
      .where(eq(whatsappBulkSendResultsTable.userId, userId))
      .orderBy(sql`created_at DESC`)
      .limit(1);
    if (!result) return null;
    return {
      ...result,
      errorBreakdown: result.errorBreakdown ? JSON.parse(result.errorBreakdown) : null,
      estimatedCost: result.estimatedCost ? parseFloat(result.estimatedCost) : 0,
    };
  }
}

export const storage = new MemStorage();
