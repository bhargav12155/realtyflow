import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

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
  isDemo: boolean("is_demo").default(false),
  // Opt-out switch for transactional emails such as the "board shared with
  // you" notification. Defaults to true so existing recipients keep getting
  // emails until they explicitly turn them off.
  emailNotifications: boolean("email_notifications").default(true),
  // Per-admin "snooze admin alert notifications until" timestamp. Stored on
  // the user row so the snooze survives server restarts and redeploys.
  // Null/past values mean no active snooze. Only meaningful for admin users.
  adminAlertSnoozedUntil: timestamp("admin_alert_snoozed_until"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// USER WALLET ACCOUNTS (Credit balance)
// =====================================================
export const walletAccounts = pgTable(
  "wallet_accounts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().unique(),
    balanceCredits: integer("balance_credits").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("IDX_wallet_accounts_user").on(table.userId)],
);

export const insertWalletAccountSchema = createInsertSchema(walletAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type WalletAccount = typeof walletAccounts.$inferSelect;
export type InsertWalletAccount = z.infer<typeof insertWalletAccountSchema>;

// =====================================================
// WALLET LEDGER (immutable credit deltas)
// =====================================================
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    deltaCredits: integer("delta_credits").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    requestId: text("request_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_wallet_ledger_user_created").on(table.userId, table.createdAt),
    index("IDX_wallet_ledger_request").on(table.requestId),
  ],
);

export const insertWalletLedgerSchema = createInsertSchema(walletLedger).omit({
  id: true,
  createdAt: true,
});
export type WalletLedgerEntry = typeof walletLedger.$inferSelect;
export type InsertWalletLedgerEntry = z.infer<typeof insertWalletLedgerSchema>;

// =====================================================
// AI USAGE EVENTS (cost/accounting telemetry)
// =====================================================
export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    provider: text("provider").notNull(),
    feature: text("feature").notNull(),
    status: text("status").notNull(), // charged | refunded | blocked
    estimatedCredits: integer("estimated_credits"),
    actualCredits: integer("actual_credits"),
    requestId: text("request_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_ai_usage_events_user_created").on(table.userId, table.createdAt),
    index("IDX_ai_usage_events_provider").on(table.provider),
    index("IDX_ai_usage_events_request").on(table.requestId),
  ],
);

export const insertAiUsageEventSchema = createInsertSchema(aiUsageEvents).omit({
  id: true,
  createdAt: true,
});
export type AiUsageEvent = typeof aiUsageEvents.$inferSelect;
export type InsertAiUsageEvent = z.infer<typeof insertAiUsageEventSchema>;

// =====================================================
// USER PREFERENCES TABLE (AI Settings & Location)
// =====================================================
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  aiProvider: text("ai_provider").default("auto"), // "auto" | "openai" | "gemini"
  serviceArea: text("service_area"), // Main city/area (e.g., "Omaha, NE")
  communities: text("communities").array(), // List of neighborhoods/communities
  agentPhotoUrl: text("agent_photo_url"), // URL to agent's profile photo/avatar
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
    role: text("role").default("user"),
    preferences: jsonb("preferences"), // Store user preferences
    lastLogin: timestamp("last_login"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Composite unique index: one email per agent. Using uniqueIndex (not
    // unique constraint) because drizzle-kit 0.31.x has a known introspection
    // quirk that re-proposes anonymous/composite unique constraints on every
    // push; unique indexes are diffed correctly.
    uniqueAgentClient: uniqueIndex("public_users_agent_slug_email_idx").on(table.agentSlug, table.email),
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
  isAiGenerated: boolean("is_ai_generated").default(false), // True if post was generated by AI
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
  heygenAvatarId: text("heygen_avatar_id").notNull().unique(),
  avatarType: text("avatar_type").notNull(), // 'public', 'talking_photo', 'photo_avatar_group'
  gender: text("gender"),
  previewImageUrl: text("preview_image_url"),
  previewVideoUrl: text("preview_video_url"),
  isPublic: boolean("is_public").default(false),
  supportsGestures: boolean("supports_gestures").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// CUSTOM VOICES TABLE (User Recorded Voices)
// =====================================================
export const customVoices = pgTable("custom_voices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  audioUrl: text("audio_url").notNull(),
  fileSize: integer("file_size"),
  heygenAudioAssetId: text("heygen_audio_asset_id"),
  status: text("status").notNull().default("pending"),
  heygenVoiceId: text("heygen_voice_id"),
  language: text("language"),
  gender: text("gender"),
  sampleAudioUrl: text("sample_audio_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// PHOTO AVATAR GROUPS TABLE (HeyGen Integration)
// =====================================================
export const photoAvatarGroups = pgTable("photo_avatar_groups", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  groupName: text("group_name").notNull(),
  heygenGroupId: text("heygen_group_id").notNull().unique(),
  trainingStatus: text("training_status").notNull().default("pending"),
  imageHash: text("image_hash"),
  heygenImageKey: text("heygen_image_key"),
  s3ImageUrl: text("s3_image_url"),
  // HeyGen Photo Avatar API generation that created the group. Existing rows
  // were all created against the legacy v2 endpoints, so we default to "v2".
  // New groups created through the v3 service should set this to "v3".
  apiVersion: text("api_version").notNull().default("v2"),
  // Tracks the HeyGen v3 consent lifecycle for the group's source likeness.
  // Null on legacy rows. Allowed values: "pending" | "approved" | "revoked".
  consentStatus: text("consent_status"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// PHOTO AVATAR GROUP VOICES TABLE
// =====================================================
export const photoAvatarGroupVoices = pgTable("photo_avatar_group_voices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  groupId: text("group_id").notNull(), // HeyGen avatar group ID
  audioUrl: text("audio_url").notNull(), // S3 URL to the audio file
  heygenAudioAssetId: text("heygen_audio_asset_id"), // HeyGen audio asset ID for voice cloning
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// PHOTO AVATARS TABLE (Individual Avatars)
// =====================================================
export const photoAvatars = pgTable("photo_avatars", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull(),
  photoUrl: text("photo_url").notNull(),
  heygenPhotoId: text("heygen_photo_id"),
  poseType: text("pose_type").notNull(),
  processingStatus: text("processing_status").default("pending"),
  // HeyGen v3 "look_id" — identifies the trained look variant used to render
  // this image. Null for legacy v2 records and for raw uploaded source photos.
  lookId: text("look_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// HEYGEN WEBHOOK EVENTS TABLE
// Persists every webhook callback HeyGen delivers so we can audit, replay
// and de-dupe. Keep the row count bounded by retention/cleanup elsewhere.
// =====================================================
export const heygenWebhookEvents = pgTable("heygen_webhook_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // HeyGen event type (e.g. "avatar_video.success", "photo_avatar.train.completed").
  eventType: text("event_type").notNull(),
  // Optional resource id extracted from payload for fast lookup.
  resourceId: text("resource_id"),
  // Raw payload as delivered, useful for debugging and replay.
  payload: jsonb("payload").notNull(),
  // The signature header HeyGen sent (so we can re-verify after the fact).
  signature: text("signature"),
  // True when HMAC verification succeeded.
  verified: boolean("verified").notNull().default(false),
  receivedAt: timestamp("received_at").defaultNow(),
});

export const insertHeygenWebhookEventSchema = createInsertSchema(heygenWebhookEvents).omit({
  id: true,
  receivedAt: true,
});
export type InsertHeygenWebhookEvent = z.infer<typeof insertHeygenWebhookEventSchema>;
export type HeygenWebhookEvent = typeof heygenWebhookEvents.$inferSelect;

// =====================================================
// HEYGEN SHAPE-DRIFT INCIDENTS TABLE
// One row per `heygen_shape_drift` envelope emitted from the v3 routes.
// Lets operators spot HeyGen API regressions from the dashboard / a quick
// SQL query instead of waiting for users to file support tickets.
// =====================================================
export const heygenShapeDriftIncidents = pgTable(
  "heygen_shape_drift_incidents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // The HeyGen route that returned the unexpected shape, e.g. `/v3/voices`
    // or `/v3/photo_avatars/:groupId/looks`.
    endpoint: text("endpoint").notNull(),
    // First few `path.join('.')` strings from the Zod issue list, capped to
    // mirror the transport-shape used by `heygenShapeDriftErrorPayload`.
    issuePaths: text("issue_paths").array().notNull(),
    // The truncated `HeygenResponseValidationError` message — the same
    // copy-pastable string the dashboard surfaces to users so operators can
    // join the dots between an incident row and a support report.
    message: text("message").notNull(),
    // Authenticated user id when known. Webhook callbacks have no user
    // context so this is nullable.
    userId: text("user_id"),
    // Optional HeyGen group id parsed from the endpoint (when applicable).
    groupId: text("group_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_heygen_shape_drift_endpoint").on(table.endpoint),
    index("idx_heygen_shape_drift_created_at").on(table.createdAt),
  ],
);

export const insertHeygenShapeDriftIncidentSchema = createInsertSchema(
  heygenShapeDriftIncidents,
).omit({
  id: true,
  createdAt: true,
});
export type InsertHeygenShapeDriftIncident = z.infer<
  typeof insertHeygenShapeDriftIncidentSchema
>;
export type HeygenShapeDriftIncident =
  typeof heygenShapeDriftIncidents.$inferSelect;

// =====================================================
// HEYGEN SHAPE-DRIFT RETENTION RUNS TABLE
// One row per execution of the daily background sweep that prunes old
// `heygen_shape_drift_incidents` rows. Lets operators confirm the cron
// is firing on time and see how many rows it removed without grepping
// production logs.
// =====================================================
export const heygenShapeDriftRetentionRuns = pgTable(
  "heygen_shape_drift_retention_runs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // Number of `heygen_shape_drift_incidents` rows the sweep removed.
    // 0 is a valid value — operators still want to know the job ran.
    deletedCount: integer("deleted_count").notNull(),
    // Retention window (in days) the sweep used. Captured per-row so a
    // later config change is obvious from the audit log.
    retentionDays: integer("retention_days").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_heygen_shape_drift_retention_runs_created_at").on(
      table.createdAt,
    ),
  ],
);

export const insertHeygenShapeDriftRetentionRunSchema = createInsertSchema(
  heygenShapeDriftRetentionRuns,
).omit({
  id: true,
  createdAt: true,
});
export type InsertHeygenShapeDriftRetentionRun = z.infer<
  typeof insertHeygenShapeDriftRetentionRunSchema
>;
export type HeygenShapeDriftRetentionRun =
  typeof heygenShapeDriftRetentionRuns.$inferSelect;

// =====================================================
// LOOK GENERATION JOBS TABLE (Track pending look generations)
// =====================================================
export const lookGenerationJobs = pgTable("look_generation_jobs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  groupId: text("group_id").notNull(), // HeyGen avatar group ID
  heygenGenerationId: text("heygen_generation_id").notNull(), // HeyGen generation ID for status polling
  lookLabel: text("look_label").notNull(), // e.g., "professional-executive"
  lookName: text("look_name").notNull(), // e.g., "Executive"
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  resultAvatarId: text("result_avatar_id"), // HeyGen avatar ID when completed
  resultImageUrl: text("result_image_url"), // Image URL when completed
  errorMessage: text("error_message"),
  baselineAvatarIds: text("baseline_avatar_ids"), // JSON array of avatar IDs that existed when job was created
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// =====================================================
// VIDEO AVATARS TABLE (Enterprise HeyGen Feature)
// =====================================================
export const videoAvatars = pgTable("video_avatars", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  avatarName: text("avatar_name").notNull(),
  heygenAvatarId: text("heygen_avatar_id").notNull().unique(),
  trainingVideoUrl: text("training_video_url").notNull(), // S3 URL to training footage
  consentVideoUrl: text("consent_video_url").notNull(), // S3 URL to consent video
  voiceId: text("voice_id"), // Optional voice ID for the avatar
  audioAssetId: text("audio_asset_id"), // HeyGen audio asset ID for voice (extracted from training video)
  status: text("status").notNull().default("in_progress"), // in_progress, complete, failed
  errorMessage: text("error_message"), // Error details if status is failed
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// =====================================================
// MEDIA ASSETS TABLE (Unified Media Library)
// =====================================================
export const mediaAssets = pgTable("media_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // 'photo', 'video', 'avatar'
  source: text("source").notNull(), // 'upload', 'heygen', 'library'
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"), // For videos
  avatarId: varchar("avatar_id"), // Link to avatars table if type is 'avatar'
  title: text("title"),
  description: text("description"),
  mimeType: text("mime_type"), // e.g., 'video/mp4', 'image/jpeg'
  fileSize: integer("file_size"), // File size in bytes
  width: integer("width"), // Image/video width in pixels
  height: integer("height"), // Image/video height in pixels
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// POST MEDIA JUNCTION TABLE (Many-to-many for post attachments)
// =====================================================
export const postMedia = pgTable("post_media", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(), // References scheduledPosts or direct posts
  mediaId: varchar("media_id").notNull(), // References mediaAssets
  orderIndex: integer("order_index").default(0), // Display order
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
  platform: text("platform"), // 'youtube', 'reels', 'story'
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
  heygenVideoId: text("heygen_video_id"),
  heygenAvatarId: text("heygen_avatar_id"),
  heygenVoiceId: text("heygen_voice_id"),
  heygenTemplateId: text("heygen_template_id"),
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
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  isConnected: boolean("is_connected").default(false),
  accountUsername: text("account_username"),
  metadata: jsonb("metadata"),
  lastSynced: timestamp("last_synced"),
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
  searchVolume: integer("search_volume"),
  difficulty: integer("difficulty"),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow(),
  currentRank: integer("current_rank"),
  previousRank: integer("previous_rank"),
  neighborhood: text("neighborhood"),
});

// =====================================================
// 8. MARKET DATA TABLE (Real Estate Market)
// =====================================================
export const marketData = pgTable("market_data", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Make market data user-specific
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
  metricType: text("metric_type").notNull(),
  metricValue: numeric("metric_value"),
  dimension: text("dimension"),
  timestamp: timestamp("timestamp").defaultNow(),
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

// =====================================================
// AI CHAT HISTORY TABLE
// =====================================================
export const aiChatSessions = pgTable("ai_chat_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").default("New Chat"),
  messages: jsonb("messages").$type<Array<{ role: string; content: string }>>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiChatSessionSchema = createInsertSchema(aiChatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiChatSession = z.infer<typeof insertAiChatSessionSchema>;
export type AiChatSession = typeof aiChatSessions.$inferSelect;

export const savedPrompts = pgTable("saved_prompts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSavedPromptSchema = createInsertSchema(savedPrompts).omit({
  id: true,
  createdAt: true,
});
export type InsertSavedPrompt = z.infer<typeof insertSavedPromptSchema>;
export type SavedPrompt = typeof savedPrompts.$inferSelect;

// Legacy AI Content and Social Posts (keeping for compatibility)
export const aiContent = pgTable("ai_content", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  contentType: varchar("content_type").notNull(), // 'social_post', 'blog_article', 'property_description', 'email_campaign'
  title: varchar("title"),
  content: text("content").notNull(),
  keywords: jsonb("keywords").$type<string[]>(),
  propertyId: varchar("property_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialPosts = pgTable("social_posts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  platforms: jsonb("platforms").$type<string[]>(),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  status: varchar("status").notNull().default("draft"), // 'draft', 'scheduled', 'published', 'failed'
  engagement: jsonb("engagement"),
  aiContentId: varchar("ai_content_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User activity log (keeping for compatibility)
export const userActivity = pgTable("user_activity", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: varchar("action").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// File uploads table (keeping for compatibility)
export const fileUploads = pgTable("file_uploads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  size: integer("size").notNull(),
  path: varchar("path").notNull(),
  url: varchar("url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// SOCIAL MEDIA API KEYS TABLE
// =====================================================
export const socialApiKeys = pgTable("social_api_keys", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  facebookAppId: text("facebook_app_id"),
  facebookAppSecret: text("facebook_app_secret"),
  instagramBusinessAccountId: text("instagram_business_account_id"),
  instagramToken: text("instagram_token"),
  twitterApiKey: text("twitter_api_key"),
  twitterApiSecret: text("twitter_api_secret"),
  twitterAccessToken: text("twitter_access_token"),
  twitterAccessTokenSecret: text("twitter_access_token_secret"),
  linkedinClientId: text("linkedin_client_id"),
  linkedinClientSecret: text("linkedin_client_secret"),
  linkedinAccessToken: text("linkedin_access_token"),
  youtubeApiKey: text("youtube_api_key"),
  youtubeChannelId: text("youtube_channel_id"),
  tiktokAccessToken: text("tiktok_access_token"),
  keysConfigured: boolean("keys_configured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const insertSEOKeywordSchema = createInsertSchema(seoKeywords).omit({
  id: true,
  createdAt: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  lastUpdated: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
  timestamp: true,
});

export const insertScheduledPostSchema = createInsertSchema(scheduledPosts)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    scheduledFor: z.coerce.date(), // Coerce ISO strings to Date objects
  });

// Update schema for PATCH operations - only mutable fields
export const updateScheduledPostSchema = z
  .object({
    status: z.enum(["pending", "approved", "posted", "cancelled"]).optional(),
    content: z.string().min(1).optional(),
    scheduledFor: z.coerce.date().optional(),
    hashtags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();
export type UpdateScheduledPostInput = z.infer<
  typeof updateScheduledPostSchema
>;

export const insertPublicUserSchema = createInsertSchema(publicUsers).omit({
  id: true,
  createdAt: true,
});

export const insertAvatarSchema = createInsertSchema(avatars).omit({
  id: true,
  createdAt: true,
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({
  id: true,
  createdAt: true,
});

export const insertPostMediaSchema = createInsertSchema(postMedia).omit({
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

// Legacy insert schemas (keeping for compatibility)
export const insertAIContentSchema = createInsertSchema(aiContent).omit({
  id: true,
  createdAt: true,
});

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  createdAt: true,
});

export const insertUserActivitySchema = createInsertSchema(userActivity).omit({
  id: true,
  createdAt: true,
});

export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({
  id: true,
  createdAt: true,
});

export const insertSocialApiKeysSchema = createInsertSchema(socialApiKeys).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  }
);

export const insertCustomVoiceSchema = createInsertSchema(customVoices).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PublicUser = typeof publicUsers.$inferSelect;
export type InsertPublicUser = typeof publicUsers.$inferInsert;

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

export type ContentPiece = typeof contentPieces.$inferSelect;
export type InsertContentPiece = z.infer<typeof insertContentPieceSchema>;

export type SocialMediaAccount = typeof socialMediaAccounts.$inferSelect;
export type InsertSocialMediaAccount = z.infer<
  typeof insertSocialMediaAccountSchema
>;

export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type InsertSeoKeyword = z.infer<typeof insertSEOKeywordSchema>;

export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;

export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;

export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;

export type Avatar = typeof avatars.$inferSelect;
export type InsertAvatar = z.infer<typeof insertAvatarSchema>;

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type PostMedia = typeof postMedia.$inferSelect;
export type InsertPostMedia = z.infer<typeof insertPostMediaSchema>;
export type VideoContent = typeof videoContent.$inferSelect;
export type InsertVideoContent = z.infer<typeof insertVideoContentSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type CustomVoice = typeof customVoices.$inferSelect;
export type InsertCustomVoice = z.infer<typeof insertCustomVoiceSchema>;

export type PhotoAvatarGroup = typeof photoAvatarGroups.$inferSelect;
export type InsertPhotoAvatarGroup = typeof photoAvatarGroups.$inferInsert;

export type PhotoAvatarGroupVoice = typeof photoAvatarGroupVoices.$inferSelect;
export type InsertPhotoAvatarGroupVoice =
  typeof photoAvatarGroupVoices.$inferInsert;

export type PhotoAvatar = typeof photoAvatars.$inferSelect;
export type InsertPhotoAvatar = typeof photoAvatars.$inferInsert;

export type VideoAvatar = typeof videoAvatars.$inferSelect;
export type InsertVideoAvatar = typeof videoAvatars.$inferInsert;

export const insertPhotoAvatarSchema = createInsertSchema(photoAvatars).omit({
  id: true,
  createdAt: true,
});

export type LookGenerationJob = typeof lookGenerationJobs.$inferSelect;
export type InsertLookGenerationJob = typeof lookGenerationJobs.$inferInsert;

// =====================================================
// TUTORIAL VIDEOS TABLE
// =====================================================
export const tutorialVideos = pgTable("tutorial_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // e.g., "RealtyFlow Tutorials"
  subcategory: text("subcategory").notNull(), // e.g., "Add Social Keys"
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(), // S3 URL
  thumbnailUrl: text("thumbnail_url"), // Optional thumbnail
  duration: integer("duration"), // Duration in seconds
  order: integer("order").default(0), // Display order within subcategory
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTutorialVideoSchema = createInsertSchema(
  tutorialVideos
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TutorialVideo = typeof tutorialVideos.$inferSelect;
export type InsertTutorialVideo = z.infer<typeof insertTutorialVideoSchema>;

// =====================================================
// COMPANY PROFILE TABLE (Agent/Company Information)
// =====================================================
export const companyProfiles = pgTable("company_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  companyName: text("company_name"),
  businessName: text("business_name"),
  agentName: text("agent_name"),
  agentTitle: text("agent_title"),
  logoUrl: text("logo_url"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  officeAddress: text("office_address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  licenseNumber: text("license_number"),
  brokerageName: text("brokerage_name"),
  tagline: text("tagline"),
  bio: text("bio"),
  socialLinks: jsonb("social_links"),
  businessType: text("business_type").default("real_estate"),
  businessSubtype: text("business_subtype"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanyProfileSchema = createInsertSchema(
  companyProfiles
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;

// =====================================================
// BRAND SETTINGS TABLE (Branding & Visual Identity)
// =====================================================
export const brandSettings = pgTable("brand_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  assets: jsonb("assets"),
  colors: jsonb("colors"),
  fonts: jsonb("fonts"),
  description: text("description"),
  socialConnections: jsonb("social_connections"),
  logoInfo: jsonb("logo_info"),
  aiProvider: text("ai_provider").default("openai"),
  aiApiKeyEncrypted: text("ai_api_key_encrypted"),
  aiApiKeyLastFour: text("ai_api_key_last_four"),
  klingApiKeyEncrypted: text("kling_api_key_encrypted"),
  klingApiKeyLastFour: text("kling_api_key_last_four"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBrandSettingsSchema = createInsertSchema(brandSettings).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  }
);

export type BrandSettings = typeof brandSettings.$inferSelect;
export type InsertBrandSettings = z.infer<typeof insertBrandSettingsSchema>;

// Legacy types (keeping for compatibility)
export type UpsertUser = typeof users.$inferInsert;
export type InsertAIContent = z.infer<typeof insertAIContentSchema>;
export type AIContent = typeof aiContent.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSEOKeyword = z.infer<typeof insertSEOKeywordSchema>;
export type SEOKeyword = typeof seoKeywords.$inferSelect;
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivity.$inferSelect;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;
export type FileUpload = typeof fileUploads.$inferSelect;
export type InsertSocialApiKeys = z.infer<typeof insertSocialApiKeysSchema>;
export type SocialApiKeys = typeof socialApiKeys.$inferSelect;

// =====================================================
// PLATFORM INTELLIGENCE TAXONOMY
// =====================================================

export const contentTypeValues = [
  "listing",
  "market_update",
  "buyer_tips",
  "seller_tips",
  "neighborhood",
  "investment",
  "testimonial",
  "general",
] as const;

export const audiencePersonaValues = [
  "first_time_buyer",
  "luxury_buyer",
  "seller",
  "investor",
  "relocating",
  "general",
] as const;

export const contentIntentValues = [
  "educate",
  "convert",
  "engage",
  "inform",
  "inspire",
] as const;

export const propertyClassValues = [
  "luxury",
  "mid_market",
  "starter",
  "investment",
  "general",
] as const;

export const marketHeatValues = ["hot", "balanced", "cold"] as const;
export const priceMomentumValues = ["rising", "stable", "falling"] as const;
export const daysOnMarketTrendValues = ["fast", "normal", "slow"] as const;

export const platformFitValues = [
  "excellent",
  "very-good",
  "good",
  "fair",
] as const;

export const contentTypeSchema = z.enum(contentTypeValues);
export const audiencePersonaSchema = z.enum(audiencePersonaValues);
export const contentIntentSchema = z.enum(contentIntentValues);
export const propertyClassSchema = z.enum(propertyClassValues);
export const marketHeatSchema = z.enum(marketHeatValues);
export const priceMomentumSchema = z.enum(priceMomentumValues);
export const daysOnMarketTrendSchema = z.enum(daysOnMarketTrendValues);
export const platformFitSchema = z.enum(platformFitValues);

export type ContentType = z.infer<typeof contentTypeSchema>;
export type AudiencePersona = z.infer<typeof audiencePersonaSchema>;
export type ContentIntent = z.infer<typeof contentIntentSchema>;
export type PropertyClass = z.infer<typeof propertyClassSchema>;
export type MarketHeat = z.infer<typeof marketHeatSchema>;
export type PriceMomentum = z.infer<typeof priceMomentumSchema>;
export type DaysOnMarketTrend = z.infer<typeof daysOnMarketTrendSchema>;
export type PlatformFit = z.infer<typeof platformFitSchema>;

export const marketSignalsSchema = z.object({
  inventoryHeat: marketHeatSchema,
  priceMomentum: priceMomentumSchema,
  daysOnMarketTrend: daysOnMarketTrendSchema,
});

export const contentProfileSchema = z.object({
  contentType: contentTypeSchema,
  audiencePersona: audiencePersonaSchema,
  intent: contentIntentSchema,
  propertyClass: propertyClassSchema.optional(),
  hasEmojis: z.boolean(),
  hasHashtags: z.boolean(),
  hasNumbers: z.boolean(),
  hasQuestions: z.boolean(),
  hasCallToAction: z.boolean(),
  wordCount: z.number(),
  sentimentScore: z.number().optional(),
});

export const platformScoreSchema = z.object({
  platform: z.string(),
  score: z.number(),
  fit: platformFitSchema,
  reasons: z.array(z.string()),
  optimization: z.string(),
  confidence: z.number().optional(),
});

export type MarketSignals = z.infer<typeof marketSignalsSchema>;
export type ContentProfile = z.infer<typeof contentProfileSchema>;
export type PlatformScore = z.infer<typeof platformScoreSchema>;

// =====================================================
// ENGAGEMENT TRACKING TABLES
// =====================================================

// User Sessions - Track anonymous user browsing sessions
export const userSessions = pgTable(
  "user_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: text("session_id").notNull(),
    publicUserId: integer("public_user_id").references(() => publicUsers.id),
    agentSlug: text("agent_slug").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    deviceType: text("device_type"),
    browserName: text("browser_name"),
    operatingSystem: text("operating_system"),
    country: text("country"),
    city: text("city"),
    firstPageVisited: text("first_page_visited"),
    lastPageVisited: text("last_page_visited"),
    totalTimeSpentSeconds: integer("total_time_spent_seconds").default(0),
    totalPageViews: integer("total_page_views").default(0),
    totalPropertiesViewed: integer("total_properties_viewed").default(0),
    totalPropertiesLiked: integer("total_properties_liked").default(0),
    conversionType: text("conversion_type"),
    conversionValue: text("conversion_value"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    sessionIdKey: unique("user_sessions_session_id_key").on(table.sessionId),
  })
);

// Property Interactions - Track individual user interactions
export const propertyInteractions = pgTable("property_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicUserId: integer("public_user_id").references(() => publicUsers.id),
  propertyId: text("property_id"),
  agentSlug: text("agent_slug").notNull(),
  interactionType: text("interaction_type").notNull(),
  interactionValue: text("interaction_value"),
  timeSpentSeconds: integer("time_spent_seconds").default(0),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  referrerUrl: text("referrer_url"),
  currentUrl: text("current_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Property Likes - Track property favorites
export const propertyLikes = pgTable("property_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicUserId: integer("public_user_id").references(() => publicUsers.id),
  propertyId: text("property_id").notNull(),
  agentSlug: text("agent_slug").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Engagement Leads - Auto-generated leads from high engagement
export const engagementLeads = pgTable("engagement_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicUserId: integer("public_user_id").references(() => publicUsers.id),
  sessionId: text("session_id").references(() => userSessions.sessionId),
  agentId: varchar("agent_id").references(() => users.id),
  agentSlug: text("agent_slug").notNull(),
  engagementScore: integer("engagement_score").default(0),
  engagementReason: text("engagement_reason").notNull(),
  engagementDetails: jsonb("engagement_details"),
  mostViewedPropertyId: text("most_viewed_property_id"),
  mostTimeSpentPropertyId: text("most_time_spent_property_id"),
  likedPropertyIds: jsonb("liked_property_ids"),
  detectedEmail: text("detected_email"),
  detectedPhone: text("detected_phone"),
  detectedName: text("detected_name"),
  leadQuality: text("lead_quality").default("warm"),
  leadStatus: text("lead_status").default("auto_generated"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  convertedToContactAt: timestamp("converted_to_contact_at"),
  contactedAt: timestamp("contacted_at"),
});

// Content Opportunities - AI-generated content suggestions
export const contentOpportunities = pgTable("content_opportunities", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  opportunityType: text("opportunity_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: integer("priority").default(5),
  status: text("status").default("pending"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPropertyInteractionSchema = createInsertSchema(
  propertyInteractions
).omit({
  id: true,
  createdAt: true,
});

export const insertPropertyLikeSchema = createInsertSchema(propertyLikes).omit({
  id: true,
  createdAt: true,
});

export const insertEngagementLeadSchema = createInsertSchema(
  engagementLeads
).omit({
  id: true,
  createdAt: true,
});

export const insertContentOpportunitySchema = createInsertSchema(
  contentOpportunities
).omit({
  id: true,
  createdAt: true,
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type PropertyInteraction = typeof propertyInteractions.$inferSelect;
export type InsertPropertyInteraction = z.infer<
  typeof insertPropertyInteractionSchema
>;
export type PropertyLike = typeof propertyLikes.$inferSelect;
export type InsertPropertyLike = z.infer<typeof insertPropertyLikeSchema>;
export type EngagementLead = typeof engagementLeads.$inferSelect;
export type InsertEngagementLead = z.infer<typeof insertEngagementLeadSchema>;
export type ContentOpportunity = typeof contentOpportunities.$inferSelect;
export type InsertContentOpportunity = z.infer<
  typeof insertContentOpportunitySchema
>;

// =====================================================
// EVENT SOURCES TABLE (Calendar and Event Feed Sources)
// =====================================================
export const eventSources = pgTable("event_sources", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  businessType: text("business_type").notNull().default("real_estate"),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'google_calendar_public', 'google_calendar_private', 'ical', 'aggregator'
  config: jsonb("config").$type<{
    calendarId?: string;
    icalUrl?: string;
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    query?: string;
    location?: string;
  }>(),
  status: text("status").notNull().default("active"), // 'active', 'paused', 'error'
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status"), // 'success', 'failed', 'partial'
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// EVENTS TABLE (Events from Various Sources)
// =====================================================
export const events = pgTable("events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  businessType: text("business_type").notNull().default("real_estate"),
  sourceId: varchar("source_id").notNull(), // References eventSources.id
  externalId: text("external_id").notNull(), // ID from the external source (for dedup)
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  timezone: text("timezone").default("America/Chicago"),
  location: text("location"),
  locationAddress: text("location_address"),
  eventUrl: text("event_url"),
  imageUrl: text("image_url"),
  isAllDay: boolean("is_all_day").default(false),
  visibility: text("visibility").default("public"), // 'public', 'private'
  category: text("category"), // 'real_estate', 'community', 'market', 'networking', etc.
  tags: text("tags").array(),
  rawData: jsonb("raw_data"), // Store original event data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate events
  uniqueUserSourceEvent: unique().on(table.userId, table.sourceId, table.externalId),
}));

// =====================================================
// EVENT POST SUGGESTIONS TABLE (AI-Generated Post Ideas)
// =====================================================
export const eventPostSuggestions = pgTable("event_post_suggestions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  eventId: varchar("event_id").notNull(), // References events.id
  platform: text("platform").notNull(), // 'facebook', 'instagram', 'linkedin', 'x'
  content: text("content").notNull(),
  hashtags: text("hashtags").array(),
  suggestedPostTime: timestamp("suggested_post_time"), // When to post (e.g., 24h before event)
  status: text("status").notNull().default("suggested"), // 'suggested', 'accepted', 'rejected', 'scheduled'
  scheduledPostId: varchar("scheduled_post_id"), // References scheduledPosts.id if accepted
  aiMetadata: jsonb("ai_metadata"), // Store AI generation details
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas and types for event tables
export const insertEventSourceSchema = createInsertSchema(eventSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventPostSuggestionSchema = createInsertSchema(eventPostSuggestions).omit({
  id: true,
  createdAt: true,
});

export type EventSource = typeof eventSources.$inferSelect;
export type InsertEventSource = z.infer<typeof insertEventSourceSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventPostSuggestion = typeof eventPostSuggestions.$inferSelect;
export type InsertEventPostSuggestion = z.infer<typeof insertEventPostSuggestionSchema>;

// =====================================================
// PKCE CODE STORAGE (for OAuth 2.0 flows)
// =====================================================
export const pkceStore = pgTable("pkce_store", {
  state: varchar("state").primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPKCESchema = createInsertSchema(pkceStore).omit({
  createdAt: true,
});

export type PKCEStore = typeof pkceStore.$inferSelect;
export type InsertPKCE = z.infer<typeof insertPKCESchema>;

// =====================================================
// COMPLIANCE SETTINGS TABLE (Brokerage Compliance)
// =====================================================
export const complianceSettings = pgTable("compliance_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  brokerageName: text("brokerage_name").notNull().default("BHHS Ambassador Real Estate"),
  brokerageShortName: text("brokerage_short_name").default("BHHS Ambassador"),
  agentName: text("agent_name"),
  teamName: text("team_name"),
  licenseType: text("license_type").default("agent"), // 'agent', 'broker', 'associate_broker'
  requireBrokerageInFirstLine: boolean("require_brokerage_in_first_line").default(true),
  requireBrokerageOnMedia: boolean("require_brokerage_on_media").default(true),
  requireBrokerageInVideo: boolean("require_brokerage_in_video").default(true),
  autoAddBrokerage: boolean("auto_add_brokerage").default(true),
  complianceRules: jsonb("compliance_rules").$type<{
    prohibitedTerms?: string[];
    requiredDisclosures?: string[];
    platformSpecificRules?: Record<string, any>;
  }>(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertComplianceSettingsSchema = createInsertSchema(complianceSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComplianceSettings = typeof complianceSettings.$inferSelect;
export type InsertComplianceSettings = z.infer<typeof insertComplianceSettingsSchema>;

// =====================================================
// MOBILE UPLOAD SESSION (for QR code-based mobile uploads)
// =====================================================
export interface MobileUploadSession {
  id: string;
  userId: string;
  type: "training" | "consent";
  createdAt: Date;
  expiresAt: Date;
  uploadedUrl: string | null;
}

// =====================================================
// VIDEO TEMPLATES TABLE (Template-based video generation)
// =====================================================
export const videoTemplates = pgTable("video_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  defaultAvatarId: text("default_avatar_id"),
  defaultVoiceId: text("default_voice_id"),
  scriptTemplate: text("script_template").notNull(),
  renderSettings: jsonb("render_settings").$type<{
    width?: number;
    height?: number;
    caption?: boolean;
    aspectRatio?: string;
  }>(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// TEMPLATE VARIABLES TABLE (Variables for each template)
// =====================================================
export const templateVariables = pgTable("template_variables", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(),
  placeholder: text("placeholder"),
  helperText: text("helper_text"),
  required: boolean("required").default(true),
  options: jsonb("options").$type<string[]>(),
  defaultValue: text("default_value"),
  orderIndex: integer("order_index").default(0),
});

// =====================================================
// GENERATED VIDEOS TABLE (Videos created from templates)
// =====================================================
export const generatedVideos = pgTable("generated_videos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  templateId: varchar("template_id"),
  templateName: text("template_name"),
  avatarId: text("avatar_id"),
  voiceId: text("voice_id"),
  title: text("title"),
  generatedScript: text("generated_script"),
  variables: jsonb("variables").$type<Record<string, string>>(),
  status: text("status").notNull().default("draft"),
  heygenVideoId: text("heygen_video_id"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: real("duration"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Insert schemas and types for video templates
export const insertVideoTemplateSchema = createInsertSchema(videoTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateVariableSchema = createInsertSchema(templateVariables).omit({
  id: true,
});

export const insertGeneratedVideoSchema = createInsertSchema(generatedVideos).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type VideoTemplate = typeof videoTemplates.$inferSelect;
export type InsertVideoTemplate = z.infer<typeof insertVideoTemplateSchema>;
export type TemplateVariable = typeof templateVariables.$inferSelect;
export type InsertTemplateVariable = z.infer<typeof insertTemplateVariableSchema>;
export type GeneratedVideo = typeof generatedVideos.$inferSelect;
export type InsertGeneratedVideo = z.infer<typeof insertGeneratedVideoSchema>;

// =====================================================
// VIDEO GENERATION JOBS TABLE (Background Processing)
// =====================================================
export const videoGenerationJobs = pgTable("video_generation_jobs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  source: text("source").notNull(), // 'avatar_iv', 'video_studio', 'template'
  heygenVideoId: text("heygen_video_id"),
  title: text("title"),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").default(0),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").$type<{
    avatarId?: string;
    voiceId?: string;
    script?: string;
    templateId?: string;
  }>(),
  notificationSent: boolean("notification_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertVideoGenerationJobSchema = createInsertSchema(videoGenerationJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type VideoGenerationJob = typeof videoGenerationJobs.$inferSelect;
export type InsertVideoGenerationJob = z.infer<typeof insertVideoGenerationJobSchema>;

// =====================================================
// TWILIO SETTINGS TABLE (Per-subscriber phone configuration)
// =====================================================
export const twilioSettings = pgTable("twilio_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  phoneNumber: text("phone_number"), // Twilio phone number assigned to this subscriber
  twilioAccountSid: text("twilio_account_sid"), // Optional: subscriber's own Twilio account
  twilioAuthToken: text("twilio_auth_token"), // Encrypted auth token
  isEnabled: boolean("is_enabled").default(false),
  // AI Chatbot Settings
  aiGreeting: text("ai_greeting").default("Hello! Thank you for reaching out. I'm an AI assistant for a local real estate agent. How can I help you today?"),
  aiPersonality: text("ai_personality").default("friendly"), // 'friendly', 'professional', 'casual'
  businessHoursStart: text("business_hours_start").default("09:00"),
  businessHoursEnd: text("business_hours_end").default("17:00"),
  afterHoursMessage: text("after_hours_message").default("Thanks for reaching out! Our office is currently closed. We'll get back to you during business hours."),
  // Lead capture settings
  captureLeadOnFirstMessage: boolean("capture_lead_on_first_message").default(true),
  askForName: boolean("ask_for_name").default(true),
  askForEmail: boolean("ask_for_email").default(true),
  // Business info for AI context
  agentName: text("agent_name"),
  brokerageName: text("brokerage_name"),
  serviceAreas: text("service_areas").array(), // Neighborhoods/areas served
  specialties: text("specialties").array(), // 'luxury', 'first-time buyers', etc.
  // Voice settings
  voiceGreeting: text("voice_greeting").default("Hello! Thank you for calling. I'm an AI assistant. How can I help you today?"),
  voiceEnabled: boolean("voice_enabled").default(false),
  transferNumber: text("transfer_number"), // Number to transfer calls to for live agent
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// TWILIO CONVERSATIONS TABLE (SMS/Voice chat history)
// =====================================================
export const twilioConversations = pgTable("twilio_conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // The agent/subscriber who owns this conversation
  fromNumber: text("from_number").notNull(), // The caller/texter's phone number
  toNumber: text("to_number").notNull(), // The Twilio number that received it
  conversationType: text("conversation_type").notNull().default("sms"), // 'sms' or 'voice'
  status: text("status").notNull().default("active"), // 'active', 'closed', 'converted'
  // Lead info captured during conversation
  leadName: text("lead_name"),
  leadEmail: text("lead_email"),
  leadInterest: text("lead_interest"), // 'buying', 'selling', 'both', 'general'
  leadQuality: text("lead_quality").default("warm"), // 'hot', 'warm', 'cold'
  leadNotes: text("lead_notes"), // AI-generated summary of conversation
  // Timestamps
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  convertedToLeadAt: timestamp("converted_to_lead_at"),
});

// =====================================================
// TWILIO MESSAGES TABLE (Individual messages in conversations)
// =====================================================
export const twilioMessages = pgTable("twilio_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  twilioMessageSid: text("twilio_message_sid"), // Twilio's message ID
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  messageType: text("message_type").notNull().default("sms"), // 'sms', 'mms', 'voice_transcript'
  body: text("body").notNull(),
  mediaUrls: text("media_urls").array(), // For MMS attachments
  status: text("status").default("delivered"), // 'queued', 'sent', 'delivered', 'failed'
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiModel: text("ai_model"), // 'gpt-4o', etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// PLATFORM SETTINGS TABLE (Admin-level integrations)
// =====================================================
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({
  id: true,
  updatedAt: true,
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;

// Twilio insert schemas and types
export const insertTwilioSettingsSchema = createInsertSchema(twilioSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTwilioConversationSchema = createInsertSchema(twilioConversations).omit({
  id: true,
  createdAt: true,
});

export const insertTwilioMessageSchema = createInsertSchema(twilioMessages).omit({
  id: true,
  createdAt: true,
});

export type TwilioSettings = typeof twilioSettings.$inferSelect;
export type InsertTwilioSettings = z.infer<typeof insertTwilioSettingsSchema>;
export type TwilioConversation = typeof twilioConversations.$inferSelect;
export type InsertTwilioConversation = z.infer<typeof insertTwilioConversationSchema>;
export type TwilioMessage = typeof twilioMessages.$inferSelect;
export type InsertTwilioMessage = z.infer<typeof insertTwilioMessageSchema>;

// =====================================================
// AI ASSISTANT MESSAGES TABLE
// =====================================================
export const aiAssistantMessages = pgTable("ai_assistant_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  attachments: jsonb("attachments"), // Array of { url: string, type: string, name: string }
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiAssistantMessageSchema = createInsertSchema(aiAssistantMessages).omit({
  id: true,
  createdAt: true,
});

export type AiAssistantMessage = typeof aiAssistantMessages.$inferSelect;
export type InsertAiAssistantMessage = z.infer<typeof insertAiAssistantMessageSchema>;

// =====================================================
// WHATSAPP SETTINGS TABLE (Per-user WhatsApp Business configuration)
// =====================================================
export const whatsappSettings = pgTable("whatsapp_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  phoneNumberId: text("phone_number_id"), // WhatsApp Cloud API phone number ID
  wabaId: text("waba_id"), // WhatsApp Business Account ID
  displayPhoneNumber: text("display_phone_number"), // formatted phone number for display
  accessToken: text("access_token"), // permanent token from Meta
  webhookVerifyToken: text("webhook_verify_token"), // random token for webhook verification
  isEnabled: boolean("is_enabled").default(false),
  // AI Chatbot Settings
  aiGreeting: text("ai_greeting").default("Hello! Thanks for reaching out. I'm an AI assistant for a local real estate agent. How can I help you today?"),
  aiPersonality: text("ai_personality").default("friendly"), // 'friendly', 'professional', 'casual'
  businessHoursStart: text("business_hours_start").default("09:00"),
  businessHoursEnd: text("business_hours_end").default("17:00"),
  afterHoursMessage: text("after_hours_message").default("Thanks for reaching out! Our office is currently closed. We'll get back to you during business hours."),
  // Lead capture settings
  captureLeadOnFirstMessage: boolean("capture_lead_on_first_message").default(true),
  askForName: boolean("ask_for_name").default(true),
  askForEmail: boolean("ask_for_email").default(true),
  // Business info for AI context
  agentName: text("agent_name"),
  brokerageName: text("brokerage_name"),
  serviceAreas: text("service_areas").array(), // Neighborhoods/areas served
  specialties: text("specialties").array(), // 'luxury', 'first-time buyers', etc.
  accounts: jsonb("accounts").default([]), // [{label, phoneNumberId, wabaId, displayPhoneNumber}]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// WHATSAPP CONVERSATIONS TABLE (Chat threads)
// =====================================================
export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  waId: text("wa_id").notNull(), // the contact's WhatsApp ID (phone number)
  contactName: text("contact_name"),
  status: text("status").notNull().default("active"), // 'active', 'closed', 'converted'
  // Lead info captured during conversation
  leadName: text("lead_name"),
  leadEmail: text("lead_email"),
  leadInterest: text("lead_interest"), // 'buying', 'selling', 'both', 'general'
  leadQuality: text("lead_quality").default("warm"), // 'hot', 'warm', 'cold'
  leadNotes: text("lead_notes"), // AI-generated summary of conversation
  // Timestamps
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  convertedToLeadAt: timestamp("converted_to_lead_at"),
});

// =====================================================
// WHATSAPP MESSAGES TABLE (Individual messages in conversations)
// =====================================================
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  whatsappMessageId: text("whatsapp_message_id"), // Meta's message ID
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  messageType: text("message_type").notNull().default("text"), // 'text', 'image', 'template'
  body: text("body").notNull(),
  mediaUrl: text("media_url"),
  status: text("status").default("delivered"), // 'queued', 'sent', 'delivered', 'failed'
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiModel: text("ai_model"), // 'gpt-4o', etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// WhatsApp insert schemas and types
export const insertWhatsappSettingsSchema = createInsertSchema(whatsappSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
});

export type WhatsappSettings = typeof whatsappSettings.$inferSelect;
export type InsertWhatsappSettings = z.infer<typeof insertWhatsappSettingsSchema>;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

// =====================================================
// MENU ITEMS / CATALOG TABLE (Multi-vertical items)
// Used for: restaurant menu items, services, products, listings
// =====================================================
export const menuItems = pgTable("menu_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  businessType: text("business_type").notNull().default("restaurant"),
  name: text("name").notNull(),
  category: text("category"),
  price: numeric("price", { precision: 10, scale: 2 }),
  description: text("description"),
  ingredients: text("ingredients").array(),
  dietaryTags: text("dietary_tags").array(),
  allergens: text("allergens").array(),
  imageUrls: text("image_urls").array(),
  availability: text("availability").default("always"),
  isSpecial: boolean("is_special").default(false),
  specialPrice: numeric("special_price", { precision: 10, scale: 2 }),
  status: text("status").default("active"),
  tags: text("tags").array(),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;

// =====================================================
// BUSINESS LOCATIONS TABLE (Restaurants, offices, etc.)
// =====================================================
export const businessLocations = pgTable("business_locations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  phoneNumber: text("phone_number"),
  email: text("email"),
  website: text("website"),
  operatingHours: jsonb("operating_hours"),
  cuisineTypes: text("cuisine_types").array(),
  diningOptions: text("dining_options").array(),
  acceptsReservations: boolean("accepts_reservations").default(false),
  deliveryRadius: integer("delivery_radius"),
  status: text("status").default("open"),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBusinessLocationSchema = createInsertSchema(businessLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BusinessLocation = typeof businessLocations.$inferSelect;
export type InsertBusinessLocation = z.infer<typeof insertBusinessLocationSchema>;

// =====================================================
// WHATSAPP BULK SEND QUEUES
// Auto-queue remaining contacts for next-day delivery
// =====================================================
export const whatsappBulkQueues = pgTable("whatsapp_bulk_queues", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("active"),
  templateName: text("template_name"),
  messageText: text("message_text"),
  totalNumbers: integer("total_numbers").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  remainingNumbers: text("remaining_numbers").array().notNull(),
  sentNumbers: text("sent_numbers").array().notNull().default(sql`'{}'::text[]`),
  failedNumbers: text("failed_numbers").array().notNull().default(sql`'{}'::text[]`),
  dailyLimit: integer("daily_limit").notNull().default(2000),
  lastBatchSentAt: timestamp("last_batch_sent_at"),
  nextBatchAt: timestamp("next_batch_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWhatsappBulkQueueSchema = createInsertSchema(whatsappBulkQueues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsappBulkQueue = typeof whatsappBulkQueues.$inferSelect;
export type InsertWhatsappBulkQueue = z.infer<typeof insertWhatsappBulkQueueSchema>;

export const whatsappBulkSendResults = pgTable("whatsapp_bulk_send_results", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sent: integer("sent").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  total: integer("total").notNull().default(0),
  queued: integer("queued").notNull().default(0),
  percent: integer("percent").notNull().default(0),
  elapsed: integer("elapsed").notNull().default(0),
  estimatedCost: text("estimated_cost"),
  errorBreakdown: text("error_breakdown"),
  complete: boolean("complete").notNull().default(false),
  message: text("message"),
  bulkQueueId: varchar("bulk_queue_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type WhatsappBulkSendResult = typeof whatsappBulkSendResults.$inferSelect;

// =====================================================
// BOARDS — Luma-style generation workspace
// =====================================================
export const boards = pgTable("boards", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull().default("Untitled board"),
  isShared: boolean("is_shared").notNull().default(false),
  // Per-board cap on persisted chat messages. When a new message pushes the
  // total over this number, the oldest rows are auto-trimmed. Defaults to
  // the historical 200 so existing boards keep their current behavior.
  chatHistoryCap: integer("chat_history_cap").notNull().default(200),
  // Per-board owner preference: when false, the server skips the
  // board_shared / board_unshared / board_left transactional emails for
  // this board. In-app notifications still fire so the bell remains useful.
  // Defaults to true so existing boards keep their current behavior.
  notifyOnCollaboratorChange: boolean("notify_on_collaborator_change")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_boards_user").on(table.userId),
]);

export const insertBoardSchema = createInsertSchema(boards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;

export const boardAssets = pgTable("board_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  batchId: varchar("batch_id").notNull(),
  batchLabel: text("batch_label"),
  kind: varchar("kind", { length: 16 }).notNull(), // 'image' | 'video' | 'audio'
  assetUrl: text("asset_url"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: real("duration_seconds"),
  provider: varchar("provider", { length: 32 }).notNull(),
  modelLabel: text("model_label"),
  positionX: real("position_x").notNull().default(0),
  positionY: real("position_y").notNull().default(0),
  width: real("width").notNull().default(320),
  height: real("height").notNull().default(180),
  status: varchar("status", { length: 16 }).notNull().default("queued"), // queued | generating | ready | failed | rejected
  rejectionReason: text("rejection_reason"),
  // Free-text body for tool-created assets that don't have a media URL
  // (sticky notes, text labels, frame titles, drawing SVG markup, etc.).
  // Null for generated/upload assets where the URL is the source of truth.
  content: text("content"),
  evalHistory: jsonb("eval_history").$type<BoardAssetEvalHistoryEntry[]>().default([]),
  // When this asset was produced by editing/remixing another asset on the
  // board (image edit flow), this points to the source asset id so the UI can
  // surface a before/after view. Nullable for non-edit batches.
  sourceAssetId: varchar("source_asset_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_board_assets_board").on(table.boardId),
  index("IDX_board_assets_batch").on(table.batchId),
]);

export type BoardAssetEvalHistoryEntry = {
  at: string; // ISO timestamp
  source: "auto" | "manual";
  outcome: "winner" | "rejected" | "promoted" | "demoted";
  reason?: string;
  modelUsed?: string;
  modelHint?: string;
  extraCriteria?: string;
  actorUserId?: string;
  prevStatus?: string;
};

export const insertBoardAssetSchema = createInsertSchema(boardAssets).omit({
  id: true,
  createdAt: true,
});
export type InsertBoardAsset = z.infer<typeof insertBoardAssetSchema>;
export type BoardAsset = typeof boardAssets.$inferSelect;

// =====================================================
// Drawing asset content schema
// =====================================================
// `boardAssets.content` for kind === "drawing" stores a JSON DrawingPayload
// rather than raw SVG markup. Storing structured strokes (instead of arbitrary
// SVG) means the canvas can render them by emitting controlled <path> elements
// — it never has to inject untrusted HTML/SVG via dangerouslySetInnerHTML.
//
// We still validate the JSON shape on the server before persisting so a
// malicious or buggy client can't smuggle unexpected fields, oversized
// arrays, or non-finite numbers into the database (and on through to every
// collaborator's browser).
// Product-friendly drawing caps. The previous values (500 strokes / 5000
// points / 100KB content) were generous enough to discourage casual abuse
// but still let a determined client flood a shared board with very dense
// drawings that hurt page performance for everyone. The tighter caps below
// match what the drawing tool actually needs for normal use, and the
// `DRAWING_SOFT_STROKE_WARN` threshold lets the UI nudge users *before*
// they hit the hard ceiling.
export const DRAWING_MAX_STROKES = 200;
export const DRAWING_MAX_POINTS_PER_STROKE = 2000;
export const DRAWING_MAX_DIMENSION = 8192;
export const DRAWING_MAX_CONTENT_BYTES = 60_000;
export const DRAWING_SOFT_STROKE_WARN = 150;

// Hex color (#rgb / #rrggbb / #rrggbbaa). Drawing tool only emits hex today;
// rejecting other forms blocks accidental injection of url(...) refs, CSS
// expressions, etc.
const drawingColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

const drawingPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const drawingStrokeSchema = z.object({
  color: drawingColorSchema,
  width: z.number().finite().min(0.1).max(64),
  points: z.array(drawingPointSchema).min(1).max(DRAWING_MAX_POINTS_PER_STROKE),
});

export const drawingPayloadSchema = z.object({
  v: z.literal(1),
  width: z.number().finite().positive().max(DRAWING_MAX_DIMENSION),
  height: z.number().finite().positive().max(DRAWING_MAX_DIMENSION),
  strokes: z.array(drawingStrokeSchema).max(DRAWING_MAX_STROKES),
});

export type DrawingPayloadParsed = z.infer<typeof drawingPayloadSchema>;

// Parse + validate a drawing content blob (a JSON-encoded DrawingPayload).
// Returns the parsed payload re-serialized to a canonical JSON string when
// valid, or null when the input is missing/invalid. Used by the boards API
// to sanitize drawing assets before persisting.
export function sanitizeDrawingContent(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = drawingPayloadSchema.safeParse(parsed);
  if (!result.success) return null;
  return JSON.stringify(result.data);
}

// Persisted board chat conversation. One row per user/assistant message in
// the board chat panel, in chronological order. Pending/streaming bubbles
// are NOT persisted — only completed turns. Cascades on board delete.
export type BoardMessageCta = {
  label: string;
  href: string;
  testId?: string;
};

export const boardMessages = pgTable("board_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  boardId: varchar("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  // Which user authored this turn. Always set for new rows; nullable so the
  // backfill is non-breaking for messages persisted before collaborator chat
  // landed (those rows are owner-authored by definition — the only writer the
  // /messages routes accepted at the time). The GET handler treats NULL as
  // "the board owner" so the UI label is still correct for legacy rows.
  // Assistant turns also carry the userId of the human whose request
  // produced them, which is enough for the owner-readable audit ("who asked
  // the question that produced this reply") without inventing a separate
  // "assistant author" concept.
  authorUserId: varchar("author_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  role: varchar("role", { length: 16 }).notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  // Friendly fallback notice ("Claude was unavailable, used Gemini instead.")
  // surfaced as an italic prefix in the UI. Null for user messages and for
  // assistant replies that didn't cascade.
  notice: text("notice"),
  // Optional CTA bubble payload (e.g. "Open Photo Avatars"). Null for the
  // common case.
  cta: jsonb("cta").$type<BoardMessageCta | null>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_board_messages_board_created").on(table.boardId, table.createdAt),
]);

export const insertBoardMessageSchema = createInsertSchema(boardMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertBoardMessage = z.infer<typeof insertBoardMessageSchema>;
export type BoardMessage = typeof boardMessages.$inferSelect;

// Tracks which users a board owner has shared a board with. The owner stays
// the row in `boards.userId`; recipients get read access via this junction
// table. (boardId, sharedWithUserId) is unique so re-sharing is idempotent.
export const boardShares = pgTable("board_shares", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  sharedWithUserId: varchar("shared_with_user_id").notNull(),
  sharedByUserId: varchar("shared_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_board_shares_user").on(table.sharedWithUserId),
  index("IDX_board_shares_board").on(table.boardId),
  unique("UQ_board_shares_board_user").on(table.boardId, table.sharedWithUserId),
]);

export const insertBoardShareSchema = createInsertSchema(boardShares).omit({
  id: true,
  createdAt: true,
});
export type InsertBoardShare = z.infer<typeof insertBoardShareSchema>;
export type BoardShare = typeof boardShares.$inferSelect;

// In-app notifications. Currently only used for "board shared with you" but
// kept generic (type + jsonb data) so future notification kinds can reuse the
// same table without another migration.
export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_notifications_user").on(table.userId),
  index("IDX_notifications_user_unread").on(table.userId, table.isRead),
]);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
