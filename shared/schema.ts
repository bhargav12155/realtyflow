import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  real,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =====================================================
// 1. USERS TABLE
// =====================================================
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// PUBLIC USERS TABLE (for multi-user support)
// =====================================================
export const publicUsers = pgTable(
  "public_users",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    email: text("email").notNull(),
    name: text("name"),
    agentSlug: text("agent_slug").notNull(),
    preferences: jsonb("preferences"), // Store user preferences
    lastLogin: timestamp("last_login"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Composite unique constraint: one email per agent
    uniqueAgentClient: unique().on(table.agentSlug, table.email),
  })
);

// =====================================================
// 2. CONTENT PIECES TABLE (AI Generated Content)
// =====================================================
export const contentPieces = pgTable("content_pieces", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // 'blog', 'social', 'property_feature'
  title: text("title").notNull(),
  content: text("content").notNull(),
  keywords: text("keywords").array(),
  neighborhood: text("neighborhood"),
  seoOptimized: boolean("seo_optimized").default(false),
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'scheduled'
  publishedAt: timestamp("published_at"),
  scheduledFor: timestamp("scheduled_for"),
  socialPlatforms: text("social_platforms").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// 3. SCHEDULED POSTS TABLE (Social Media)
// =====================================================
export const scheduledPosts = pgTable("scheduled_posts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  platform: text("platform").notNull(), // 'facebook', 'instagram', 'linkedin', 'x'
  postType: text("post_type"), // 'open_houses', 'just_listed', 'just_sold', etc.
  content: text("content").notNull(),
  hashtags: text("hashtags").array(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'posted', 'cancelled'
  isEdited: boolean("is_edited").default(false),
  originalContent: text("original_content"),
  neighborhood: text("neighborhood"),
  seoScore: integer("seo_score").default(0), // SEO score from 0-100
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// 4. AVATARS TABLE (HeyGen Integration)
// =====================================================
export const avatars = pgTable("avatars", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  avatarImageUrl: text("avatar_image_url"), // URL to the avatar's appearance image
  voiceId: text("voice_id"), // ID for AI voice synthesis
  style: text("style").default("professional"), // 'professional', 'casual', 'friendly'
  gender: text("gender"), // 'male', 'female', 'neutral'
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// 5. VIDEO CONTENT TABLE (YouTube & Video)
// =====================================================
export const videoContent = pgTable("video_content", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  avatarId: varchar("avatar_id"),
  title: text("title").notNull(),
  script: text("script").notNull(),
  topic: text("topic"), // Generated topic or custom topic
  neighborhood: text("neighborhood"),
  videoType: text("video_type"), // 'market_update', 'neighborhood_tour', 'buyer_tips', etc.
  platform: text("platform").default("youtube"), // 'youtube', 'reels', 'story'
  duration: integer("duration"), // in seconds
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"), // Generated video URL
  youtubeUrl: text("youtube_url"), // YouTube video URL after upload
  youtubeVideoId: text("youtube_video_id"),
  status: text("status").notNull().default("draft"), // 'draft', 'generating', 'ready', 'uploaded', 'failed'
  tags: text("tags").array(),
  seoOptimized: boolean("seo_optimized").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// 6. SOCIAL MEDIA ACCOUNTS TABLE (Platform Connections)
// =====================================================
export const socialMediaAccounts = pgTable("social_media_accounts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  platform: text("platform").notNull(), // 'facebook', 'instagram', 'linkedin', 'x'
  accountId: text("account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  isConnected: boolean("is_connected").default(false),
  lastSync: timestamp("last_sync"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// 7. SEO KEYWORDS TABLE (Keyword Tracking)
// =====================================================
export const seoKeywords = pgTable("seo_keywords", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  keyword: text("keyword").notNull(),
  currentRank: integer("current_rank"),
  previousRank: integer("previous_rank"),
  searchVolume: integer("search_volume"),
  difficulty: integer("difficulty"),
  neighborhood: text("neighborhood"),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// 8. MARKET DATA TABLE (Real Estate Market)
// =====================================================
export const marketData = pgTable("market_data", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  neighborhood: text("neighborhood").notNull(),
  avgPrice: integer("avg_price"),
  daysOnMarket: integer("days_on_market"),
  inventory: text("inventory"),
  priceGrowth: text("price_growth"),
  trend: text("trend"), // 'hot', 'rising', 'steady', 'cooling'
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// =====================================================
// 9. ANALYTICS TABLE (Performance Tracking)
// =====================================================
export const analytics = pgTable("analytics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  metric: text("metric").notNull(),
  value: integer("value").notNull(),
  date: timestamp("date").defaultNow(),
  metadata: jsonb("metadata"),
});

// =====================================================
// 10. PROPERTIES TABLE (MLS/Property Listings)
// =====================================================
export const properties = pgTable("properties", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  mlsId: text("mls_id").notNull(),
  listPrice: integer("list_price").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: real("bathrooms"),
  squareFootage: integer("square_footage"),
  lotSize: real("lot_size"),
  yearBuilt: integer("year_built"),
  propertyType: text("property_type").notNull(),
  listingStatus: text("listing_status").notNull(),
  listingDate: timestamp("listing_date").notNull(),
  description: text("description"),
  features: text("features").array(),
  photoUrls: text("photo_urls").array(),
  virtualTourUrl: text("virtual_tour_url"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  neighborhood: text("neighborhood"),
  schoolDistrict: text("school_district"),
  agentId: text("agent_id"),
  agentName: text("agent_name"),
  officeId: text("office_id"),
  officeName: text("office_name"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertContentPieceSchema = createInsertSchema(contentPieces).omit({
  id: true,
  createdAt: true,
});

export const insertSocialMediaAccountSchema = createInsertSchema(
  socialMediaAccounts
).omit({
  id: true,
  createdAt: true,
});

export const insertSeoKeywordSchema = createInsertSchema(seoKeywords).omit({
  id: true,
  createdAt: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
});

export const insertScheduledPostSchema = createInsertSchema(
  scheduledPosts
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPublicUserSchema = createInsertSchema(publicUsers).omit({
  id: true,
  createdAt: true,
});

export const insertAvatarSchema = createInsertSchema(avatars).omit({
  id: true,
  createdAt: true,
});

export const insertVideoContentSchema = createInsertSchema(videoContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PublicUser = typeof publicUsers.$inferSelect;
export type InsertPublicUser = typeof publicUsers.$inferInsert;

export type ContentPiece = typeof contentPieces.$inferSelect;
export type InsertContentPiece = z.infer<typeof insertContentPieceSchema>;

export type SocialMediaAccount = typeof socialMediaAccounts.$inferSelect;
export type InsertSocialMediaAccount = z.infer<
  typeof insertSocialMediaAccountSchema
>;

export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type InsertSeoKeyword = z.infer<typeof insertSeoKeywordSchema>;

export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;

export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;

export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;

export type Avatar = typeof avatars.$inferSelect;
export type InsertAvatar = z.infer<typeof insertAvatarSchema>;

export type VideoContent = typeof videoContent.$inferSelect;
export type InsertVideoContent = z.infer<typeof insertVideoContentSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
