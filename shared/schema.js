"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateScheduledPostSchema = exports.insertScheduledPostSchema = exports.insertAnalyticsSchema = exports.insertMarketDataSchema = exports.insertSEOKeywordSchema = exports.insertSocialMediaAccountSchema = exports.insertContentPieceSchema = exports.insertUserSchema = exports.socialApiKeys = exports.fileUploads = exports.userActivity = exports.socialPosts = exports.aiContent = exports.insertSavedPromptSchema = exports.savedPrompts = exports.insertAiChatSessionSchema = exports.aiChatSessions = exports.properties = exports.analytics = exports.marketData = exports.seoKeywords = exports.socialMediaAccounts = exports.videoContent = exports.postMedia = exports.mediaAssets = exports.videoAvatars = exports.lookGenerationJobs = exports.insertHeygenShapeDriftRetentionRunSchema = exports.heygenShapeDriftRetentionRuns = exports.insertHeygenShapeDriftIncidentSchema = exports.heygenShapeDriftIncidents = exports.insertHeygenWebhookEventSchema = exports.heygenWebhookEvents = exports.photoAvatars = exports.photoAvatarGroupVoices = exports.photoAvatarGroups = exports.customVoices = exports.avatars = exports.scheduledPosts = exports.contentPieces = exports.publicUsers = exports.userPreferences = exports.insertAiUsageEventSchema = exports.aiUsageEvents = exports.insertWalletLedgerSchema = exports.walletLedger = exports.insertWalletAccountSchema = exports.walletAccounts = exports.users = exports.sessions = void 0;
exports.eventSources = exports.insertContentOpportunitySchema = exports.insertEngagementLeadSchema = exports.insertPropertyLikeSchema = exports.insertPropertyInteractionSchema = exports.insertUserSessionSchema = exports.contentOpportunities = exports.engagementLeads = exports.propertyLikes = exports.propertyInteractions = exports.userSessions = exports.platformScoreSchema = exports.contentProfileSchema = exports.marketSignalsSchema = exports.platformFitSchema = exports.daysOnMarketTrendSchema = exports.priceMomentumSchema = exports.marketHeatSchema = exports.propertyClassSchema = exports.contentIntentSchema = exports.audiencePersonaSchema = exports.contentTypeSchema = exports.platformFitValues = exports.daysOnMarketTrendValues = exports.priceMomentumValues = exports.marketHeatValues = exports.propertyClassValues = exports.contentIntentValues = exports.audiencePersonaValues = exports.contentTypeValues = exports.insertBrandSettingsSchema = exports.brandSettings = exports.insertCompanyProfileSchema = exports.companyProfiles = exports.insertTutorialVideoSchema = exports.tutorialVideos = exports.insertPhotoAvatarSchema = exports.insertUserPreferencesSchema = exports.insertCustomVoiceSchema = exports.insertSocialApiKeysSchema = exports.insertFileUploadSchema = exports.insertUserActivitySchema = exports.insertSocialPostSchema = exports.insertAIContentSchema = exports.insertPropertySchema = exports.insertVideoContentSchema = exports.insertPostMediaSchema = exports.insertMediaAssetSchema = exports.insertAvatarSchema = exports.insertPublicUserSchema = void 0;
exports.drawingPayloadSchema = exports.DRAWING_SOFT_STROKE_WARN = exports.DRAWING_MAX_CONTENT_BYTES = exports.DRAWING_MAX_DIMENSION = exports.DRAWING_MAX_POINTS_PER_STROKE = exports.DRAWING_MAX_STROKES = exports.insertBoardAssetSchema = exports.boardAssets = exports.insertBoardSchema = exports.boards = exports.whatsappBulkSendResults = exports.insertWhatsappBulkQueueSchema = exports.whatsappBulkQueues = exports.insertBusinessLocationSchema = exports.businessLocations = exports.insertMenuItemSchema = exports.menuItems = exports.insertWhatsappMessageSchema = exports.insertWhatsappConversationSchema = exports.insertWhatsappSettingsSchema = exports.whatsappMessages = exports.whatsappConversations = exports.whatsappSettings = exports.insertAiAssistantMessageSchema = exports.aiAssistantMessages = exports.insertTwilioMessageSchema = exports.insertTwilioConversationSchema = exports.insertTwilioSettingsSchema = exports.insertPlatformSettingSchema = exports.platformSettings = exports.twilioMessages = exports.twilioConversations = exports.twilioSettings = exports.insertVideoGenerationJobSchema = exports.videoGenerationJobs = exports.insertGeneratedVideoSchema = exports.insertTemplateVariableSchema = exports.insertVideoTemplateSchema = exports.generatedVideos = exports.templateVariables = exports.videoTemplates = exports.insertComplianceSettingsSchema = exports.complianceSettings = exports.insertPKCESchema = exports.pkceStore = exports.insertEventPostSuggestionSchema = exports.insertEventSchema = exports.insertEventSourceSchema = exports.eventPostSuggestions = exports.events = void 0;
exports.insertNotificationSchema = exports.notifications = exports.insertBoardShareSchema = exports.boardShares = exports.insertBoardMessageSchema = exports.boardMessages = void 0;
exports.sanitizeDrawingContent = sanitizeDrawingContent;
var drizzle_orm_1 = require("drizzle-orm");
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_zod_1 = require("drizzle-zod");
var zod_1 = require("zod");
// Session storage table (required for Replit Auth)
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    sid: (0, pg_core_1.varchar)("sid").primaryKey(),
    sess: (0, pg_core_1.jsonb)("sess").notNull(),
    expire: (0, pg_core_1.timestamp)("expire").notNull(),
}, function (table) { return [(0, pg_core_1.index)("IDX_session_expire").on(table.expire)]; });
// =====================================================
// 1. USERS TABLE
// =====================================================
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    role: (0, pg_core_1.text)("role").notNull().default("agent"),
    isDemo: (0, pg_core_1.boolean)("is_demo").default(false),
    // Opt-out switch for transactional emails such as the "board shared with
    // you" notification. Defaults to true so existing recipients keep getting
    // emails until they explicitly turn them off.
    emailNotifications: (0, pg_core_1.boolean)("email_notifications").default(true),
    // Per-admin "snooze admin alert notifications until" timestamp. Stored on
    // the user row so the snooze survives server restarts and redeploys.
    // Null/past values mean no active snooze. Only meaningful for admin users.
    adminAlertSnoozedUntil: (0, pg_core_1.timestamp)("admin_alert_snoozed_until"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// USER WALLET ACCOUNTS (Credit balance)
// =====================================================
exports.walletAccounts = (0, pg_core_1.pgTable)("wallet_accounts", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique(),
    balanceCredits: (0, pg_core_1.integer)("balance_credits").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
}, function (table) { return [(0, pg_core_1.index)("IDX_wallet_accounts_user").on(table.userId)]; });
exports.insertWalletAccountSchema = (0, drizzle_zod_1.createInsertSchema)(exports.walletAccounts).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// =====================================================
// WALLET LEDGER (immutable credit deltas)
// =====================================================
exports.walletLedger = (0, pg_core_1.pgTable)("wallet_ledger", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    deltaCredits: (0, pg_core_1.integer)("delta_credits").notNull(),
    balanceAfter: (0, pg_core_1.integer)("balance_after").notNull(),
    reason: (0, pg_core_1.text)("reason").notNull(),
    requestId: (0, pg_core_1.text)("request_id"),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (table) { return [
    (0, pg_core_1.index)("IDX_wallet_ledger_user_created").on(table.userId, table.createdAt),
    (0, pg_core_1.index)("IDX_wallet_ledger_request").on(table.requestId),
]; });
exports.insertWalletLedgerSchema = (0, drizzle_zod_1.createInsertSchema)(exports.walletLedger).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// AI USAGE EVENTS (cost/accounting telemetry)
// =====================================================
exports.aiUsageEvents = (0, pg_core_1.pgTable)("ai_usage_events", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    provider: (0, pg_core_1.text)("provider").notNull(),
    feature: (0, pg_core_1.text)("feature").notNull(),
    status: (0, pg_core_1.text)("status").notNull(), // charged | refunded | blocked
    estimatedCredits: (0, pg_core_1.integer)("estimated_credits"),
    actualCredits: (0, pg_core_1.integer)("actual_credits"),
    requestId: (0, pg_core_1.text)("request_id"),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (table) { return [
    (0, pg_core_1.index)("IDX_ai_usage_events_user_created").on(table.userId, table.createdAt),
    (0, pg_core_1.index)("IDX_ai_usage_events_provider").on(table.provider),
    (0, pg_core_1.index)("IDX_ai_usage_events_request").on(table.requestId),
]; });
exports.insertAiUsageEventSchema = (0, drizzle_zod_1.createInsertSchema)(exports.aiUsageEvents).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// USER PREFERENCES TABLE (AI Settings & Location)
// =====================================================
exports.userPreferences = (0, pg_core_1.pgTable)("user_preferences", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique(),
    aiProvider: (0, pg_core_1.text)("ai_provider").default("auto"), // "auto" | "openai" | "gemini"
    serviceArea: (0, pg_core_1.text)("service_area"), // Main city/area (e.g., "Omaha, NE")
    communities: (0, pg_core_1.text)("communities").array(), // List of neighborhoods/communities
    agentPhotoUrl: (0, pg_core_1.text)("agent_photo_url"), // URL to agent's profile photo/avatar
    onboardingCompleted: (0, pg_core_1.boolean)("onboarding_completed").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// =====================================================
// PUBLIC USERS TABLE (for multi-user support)
// =====================================================
exports.publicUsers = (0, pg_core_1.pgTable)("public_users", {
    id: (0, pg_core_1.integer)("id").primaryKey().generatedByDefaultAsIdentity(),
    email: (0, pg_core_1.text)("email").notNull(),
    name: (0, pg_core_1.text)("name"),
    agentSlug: (0, pg_core_1.text)("agent_slug").notNull(),
    role: (0, pg_core_1.text)("role").default("user"),
    preferences: (0, pg_core_1.jsonb)("preferences"), // Store user preferences
    lastLogin: (0, pg_core_1.timestamp)("last_login"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (table) { return ({
    // Composite unique index: one email per agent. Using uniqueIndex (not
    // unique constraint) because drizzle-kit 0.31.x has a known introspection
    // quirk that re-proposes anonymous/composite unique constraints on every
    // push; unique indexes are diffed correctly.
    uniqueAgentClient: (0, pg_core_1.uniqueIndex)("public_users_agent_slug_email_idx").on(table.agentSlug, table.email),
}); });
// =====================================================
// 2. CONTENT PIECES TABLE (AI Generated Content)
// =====================================================
exports.contentPieces = (0, pg_core_1.pgTable)("content_pieces", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // 'blog', 'social', 'property_feature'
    title: (0, pg_core_1.text)("title").notNull(),
    content: (0, pg_core_1.text)("content").notNull(),
    keywords: (0, pg_core_1.text)("keywords").array(),
    neighborhood: (0, pg_core_1.text)("neighborhood"),
    seoOptimized: (0, pg_core_1.boolean)("seo_optimized").default(false),
    status: (0, pg_core_1.text)("status").notNull().default("draft"), // 'draft', 'published', 'scheduled'
    publishedAt: (0, pg_core_1.timestamp)("published_at"),
    scheduledFor: (0, pg_core_1.timestamp)("scheduled_for"),
    socialPlatforms: (0, pg_core_1.text)("social_platforms").array(),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// 3. SCHEDULED POSTS TABLE (Social Media)
// =====================================================
exports.scheduledPosts = (0, pg_core_1.pgTable)("scheduled_posts", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    platform: (0, pg_core_1.text)("platform").notNull(), // 'facebook', 'instagram', 'linkedin', 'x'
    postType: (0, pg_core_1.text)("post_type"), // 'open_houses', 'just_listed', 'just_sold', etc.
    content: (0, pg_core_1.text)("content").notNull(),
    hashtags: (0, pg_core_1.text)("hashtags").array(),
    scheduledFor: (0, pg_core_1.timestamp)("scheduled_for").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // 'pending', 'approved', 'posted', 'cancelled'
    isEdited: (0, pg_core_1.boolean)("is_edited").default(false),
    originalContent: (0, pg_core_1.text)("original_content"),
    neighborhood: (0, pg_core_1.text)("neighborhood"),
    seoScore: (0, pg_core_1.integer)("seo_score").default(0), // SEO score from 0-100
    isAiGenerated: (0, pg_core_1.boolean)("is_ai_generated").default(false), // True if post was generated by AI
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// =====================================================
// 4. AVATARS TABLE (HeyGen Integration)
// =====================================================
exports.avatars = (0, pg_core_1.pgTable)("avatars", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    heygenAvatarId: (0, pg_core_1.text)("heygen_avatar_id").notNull().unique(),
    avatarType: (0, pg_core_1.text)("avatar_type").notNull(), // 'public', 'talking_photo', 'photo_avatar_group'
    gender: (0, pg_core_1.text)("gender"),
    previewImageUrl: (0, pg_core_1.text)("preview_image_url"),
    previewVideoUrl: (0, pg_core_1.text)("preview_video_url"),
    isPublic: (0, pg_core_1.boolean)("is_public").default(false),
    supportsGestures: (0, pg_core_1.boolean)("supports_gestures").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// CUSTOM VOICES TABLE (User Recorded Voices)
// =====================================================
exports.customVoices = (0, pg_core_1.pgTable)("custom_voices", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    audioUrl: (0, pg_core_1.text)("audio_url").notNull(),
    fileSize: (0, pg_core_1.integer)("file_size"),
    heygenAudioAssetId: (0, pg_core_1.text)("heygen_audio_asset_id"),
    status: (0, pg_core_1.text)("status").notNull().default("pending"),
    heygenVoiceId: (0, pg_core_1.text)("heygen_voice_id"),
    language: (0, pg_core_1.text)("language"),
    gender: (0, pg_core_1.text)("gender"),
    sampleAudioUrl: (0, pg_core_1.text)("sample_audio_url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// PHOTO AVATAR GROUPS TABLE (HeyGen Integration)
// =====================================================
exports.photoAvatarGroups = (0, pg_core_1.pgTable)("photo_avatar_groups", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    groupName: (0, pg_core_1.text)("group_name").notNull(),
    heygenGroupId: (0, pg_core_1.text)("heygen_group_id").notNull().unique(),
    trainingStatus: (0, pg_core_1.text)("training_status").notNull().default("pending"),
    imageHash: (0, pg_core_1.text)("image_hash"),
    heygenImageKey: (0, pg_core_1.text)("heygen_image_key"),
    s3ImageUrl: (0, pg_core_1.text)("s3_image_url"),
    // HeyGen Photo Avatar API generation that created the group. Existing rows
    // were all created against the legacy v2 endpoints, so we default to "v2".
    // New groups created through the v3 service should set this to "v3".
    apiVersion: (0, pg_core_1.text)("api_version").notNull().default("v2"),
    // Tracks the HeyGen v3 consent lifecycle for the group's source likeness.
    // Null on legacy rows. Allowed values: "pending" | "approved" | "revoked".
    consentStatus: (0, pg_core_1.text)("consent_status"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// PHOTO AVATAR GROUP VOICES TABLE
// =====================================================
exports.photoAvatarGroupVoices = (0, pg_core_1.pgTable)("photo_avatar_group_voices", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    groupId: (0, pg_core_1.text)("group_id").notNull(), // HeyGen avatar group ID
    audioUrl: (0, pg_core_1.text)("audio_url").notNull(), // S3 URL to the audio file
    heygenAudioAssetId: (0, pg_core_1.text)("heygen_audio_asset_id"), // HeyGen audio asset ID for voice cloning
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// PHOTO AVATARS TABLE (Individual Avatars)
// =====================================================
exports.photoAvatars = (0, pg_core_1.pgTable)("photo_avatars", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    groupId: (0, pg_core_1.varchar)("group_id").notNull(),
    photoUrl: (0, pg_core_1.text)("photo_url").notNull(),
    heygenPhotoId: (0, pg_core_1.text)("heygen_photo_id"),
    poseType: (0, pg_core_1.text)("pose_type").notNull(),
    processingStatus: (0, pg_core_1.text)("processing_status").default("pending"),
    // HeyGen v3 "look_id" — identifies the trained look variant used to render
    // this image. Null for legacy v2 records and for raw uploaded source photos.
    lookId: (0, pg_core_1.text)("look_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// HEYGEN WEBHOOK EVENTS TABLE
// Persists every webhook callback HeyGen delivers so we can audit, replay
// and de-dupe. Keep the row count bounded by retention/cleanup elsewhere.
// =====================================================
exports.heygenWebhookEvents = (0, pg_core_1.pgTable)("heygen_webhook_events", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    // HeyGen event type (e.g. "avatar_video.success", "photo_avatar.train.completed").
    eventType: (0, pg_core_1.text)("event_type").notNull(),
    // Optional resource id extracted from payload for fast lookup.
    resourceId: (0, pg_core_1.text)("resource_id"),
    // Raw payload as delivered, useful for debugging and replay.
    payload: (0, pg_core_1.jsonb)("payload").notNull(),
    // The signature header HeyGen sent (so we can re-verify after the fact).
    signature: (0, pg_core_1.text)("signature"),
    // True when HMAC verification succeeded.
    verified: (0, pg_core_1.boolean)("verified").notNull().default(false),
    receivedAt: (0, pg_core_1.timestamp)("received_at").defaultNow(),
});
exports.insertHeygenWebhookEventSchema = (0, drizzle_zod_1.createInsertSchema)(exports.heygenWebhookEvents).omit({
    id: true,
    receivedAt: true,
});
// =====================================================
// HEYGEN SHAPE-DRIFT INCIDENTS TABLE
// One row per `heygen_shape_drift` envelope emitted from the v3 routes.
// Lets operators spot HeyGen API regressions from the dashboard / a quick
// SQL query instead of waiting for users to file support tickets.
// =====================================================
exports.heygenShapeDriftIncidents = (0, pg_core_1.pgTable)("heygen_shape_drift_incidents", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    // The HeyGen route that returned the unexpected shape, e.g. `/v3/voices`
    // or `/v3/photo_avatars/:groupId/looks`.
    endpoint: (0, pg_core_1.text)("endpoint").notNull(),
    // First few `path.join('.')` strings from the Zod issue list, capped to
    // mirror the transport-shape used by `heygenShapeDriftErrorPayload`.
    issuePaths: (0, pg_core_1.text)("issue_paths").array().notNull(),
    // The truncated `HeygenResponseValidationError` message — the same
    // copy-pastable string the dashboard surfaces to users so operators can
    // join the dots between an incident row and a support report.
    message: (0, pg_core_1.text)("message").notNull(),
    // Authenticated user id when known. Webhook callbacks have no user
    // context so this is nullable.
    userId: (0, pg_core_1.text)("user_id"),
    // Optional HeyGen group id parsed from the endpoint (when applicable).
    groupId: (0, pg_core_1.text)("group_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)("idx_heygen_shape_drift_endpoint").on(table.endpoint),
    (0, pg_core_1.index)("idx_heygen_shape_drift_created_at").on(table.createdAt),
]; });
exports.insertHeygenShapeDriftIncidentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.heygenShapeDriftIncidents).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// HEYGEN SHAPE-DRIFT RETENTION RUNS TABLE
// One row per execution of the daily background sweep that prunes old
// `heygen_shape_drift_incidents` rows. Lets operators confirm the cron
// is firing on time and see how many rows it removed without grepping
// production logs.
// =====================================================
exports.heygenShapeDriftRetentionRuns = (0, pg_core_1.pgTable)("heygen_shape_drift_retention_runs", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    // Number of `heygen_shape_drift_incidents` rows the sweep removed.
    // 0 is a valid value — operators still want to know the job ran.
    deletedCount: (0, pg_core_1.integer)("deleted_count").notNull(),
    // Retention window (in days) the sweep used. Captured per-row so a
    // later config change is obvious from the audit log.
    retentionDays: (0, pg_core_1.integer)("retention_days").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)("idx_heygen_shape_drift_retention_runs_created_at").on(table.createdAt),
]; });
exports.insertHeygenShapeDriftRetentionRunSchema = (0, drizzle_zod_1.createInsertSchema)(exports.heygenShapeDriftRetentionRuns).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// LOOK GENERATION JOBS TABLE (Track pending look generations)
// =====================================================
exports.lookGenerationJobs = (0, pg_core_1.pgTable)("look_generation_jobs", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    groupId: (0, pg_core_1.text)("group_id").notNull(), // HeyGen avatar group ID
    heygenGenerationId: (0, pg_core_1.text)("heygen_generation_id").notNull(), // HeyGen generation ID for status polling
    lookLabel: (0, pg_core_1.text)("look_label").notNull(), // e.g., "professional-executive"
    lookName: (0, pg_core_1.text)("look_name").notNull(), // e.g., "Executive"
    prompt: (0, pg_core_1.text)("prompt").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, processing, completed, failed
    resultAvatarId: (0, pg_core_1.text)("result_avatar_id"), // HeyGen avatar ID when completed
    resultImageUrl: (0, pg_core_1.text)("result_image_url"), // Image URL when completed
    errorMessage: (0, pg_core_1.text)("error_message"),
    baselineAvatarIds: (0, pg_core_1.text)("baseline_avatar_ids"), // JSON array of avatar IDs that existed when job was created
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
});
// =====================================================
// VIDEO AVATARS TABLE (Enterprise HeyGen Feature)
// =====================================================
exports.videoAvatars = (0, pg_core_1.pgTable)("video_avatars", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    avatarName: (0, pg_core_1.text)("avatar_name").notNull(),
    heygenAvatarId: (0, pg_core_1.text)("heygen_avatar_id").notNull().unique(),
    trainingVideoUrl: (0, pg_core_1.text)("training_video_url").notNull(), // S3 URL to training footage
    consentVideoUrl: (0, pg_core_1.text)("consent_video_url").notNull(), // S3 URL to consent video
    voiceId: (0, pg_core_1.text)("voice_id"), // Optional voice ID for the avatar
    audioAssetId: (0, pg_core_1.text)("audio_asset_id"), // HeyGen audio asset ID for voice (extracted from training video)
    status: (0, pg_core_1.text)("status").notNull().default("in_progress"), // in_progress, complete, failed
    errorMessage: (0, pg_core_1.text)("error_message"), // Error details if status is failed
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
});
// =====================================================
// MEDIA ASSETS TABLE (Unified Media Library)
// =====================================================
exports.mediaAssets = (0, pg_core_1.pgTable)("media_assets", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_18 || (templateObject_18 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // 'photo', 'video', 'avatar'
    source: (0, pg_core_1.text)("source").notNull(), // 'upload', 'heygen', 'library'
    url: (0, pg_core_1.text)("url").notNull(),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    durationSeconds: (0, pg_core_1.integer)("duration_seconds"), // For videos
    avatarId: (0, pg_core_1.varchar)("avatar_id"), // Link to avatars table if type is 'avatar'
    title: (0, pg_core_1.text)("title"),
    description: (0, pg_core_1.text)("description"),
    mimeType: (0, pg_core_1.text)("mime_type"), // e.g., 'video/mp4', 'image/jpeg'
    fileSize: (0, pg_core_1.integer)("file_size"), // File size in bytes
    width: (0, pg_core_1.integer)("width"), // Image/video width in pixels
    height: (0, pg_core_1.integer)("height"), // Image/video height in pixels
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// POST MEDIA JUNCTION TABLE (Many-to-many for post attachments)
// =====================================================
exports.postMedia = (0, pg_core_1.pgTable)("post_media", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_19 || (templateObject_19 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    postId: (0, pg_core_1.varchar)("post_id").notNull(), // References scheduledPosts or direct posts
    mediaId: (0, pg_core_1.varchar)("media_id").notNull(), // References mediaAssets
    orderIndex: (0, pg_core_1.integer)("order_index").default(0), // Display order
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// 5. VIDEO CONTENT TABLE (YouTube & Video)
// =====================================================
exports.videoContent = (0, pg_core_1.pgTable)("video_content", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_20 || (templateObject_20 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    avatarId: (0, pg_core_1.varchar)("avatar_id"),
    title: (0, pg_core_1.text)("title").notNull(),
    script: (0, pg_core_1.text)("script").notNull(),
    topic: (0, pg_core_1.text)("topic"), // Generated topic or custom topic
    neighborhood: (0, pg_core_1.text)("neighborhood"),
    videoType: (0, pg_core_1.text)("video_type"), // 'market_update', 'neighborhood_tour', 'buyer_tips', etc.
    platform: (0, pg_core_1.text)("platform"), // 'youtube', 'reels', 'story'
    duration: (0, pg_core_1.integer)("duration"), // in seconds
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    videoUrl: (0, pg_core_1.text)("video_url"), // Generated video URL
    youtubeUrl: (0, pg_core_1.text)("youtube_url"), // YouTube video URL after upload
    youtubeVideoId: (0, pg_core_1.text)("youtube_video_id"),
    status: (0, pg_core_1.text)("status").notNull().default("draft"), // 'draft', 'generating', 'ready', 'uploaded', 'failed'
    tags: (0, pg_core_1.text)("tags").array(),
    seoOptimized: (0, pg_core_1.boolean)("seo_optimized").default(false),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    heygenVideoId: (0, pg_core_1.text)("heygen_video_id"),
    heygenAvatarId: (0, pg_core_1.text)("heygen_avatar_id"),
    heygenVoiceId: (0, pg_core_1.text)("heygen_voice_id"),
    heygenTemplateId: (0, pg_core_1.text)("heygen_template_id"),
});
// =====================================================
// 6. SOCIAL MEDIA ACCOUNTS TABLE (Platform Connections)
// =====================================================
exports.socialMediaAccounts = (0, pg_core_1.pgTable)("social_media_accounts", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_21 || (templateObject_21 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    platform: (0, pg_core_1.text)("platform").notNull(), // 'facebook', 'instagram', 'linkedin', 'x'
    accessToken: (0, pg_core_1.text)("access_token"),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    tokenExpiresAt: (0, pg_core_1.timestamp)("token_expires_at"),
    isConnected: (0, pg_core_1.boolean)("is_connected").default(false),
    accountUsername: (0, pg_core_1.text)("account_username"),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    lastSynced: (0, pg_core_1.timestamp)("last_synced"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// 7. SEO KEYWORDS TABLE (Keyword Tracking)
// =====================================================
exports.seoKeywords = (0, pg_core_1.pgTable)("seo_keywords", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_22 || (templateObject_22 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    keyword: (0, pg_core_1.text)("keyword").notNull(),
    searchVolume: (0, pg_core_1.integer)("search_volume"),
    difficulty: (0, pg_core_1.integer)("difficulty"),
    lastChecked: (0, pg_core_1.timestamp)("last_checked"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    currentRank: (0, pg_core_1.integer)("current_rank"),
    previousRank: (0, pg_core_1.integer)("previous_rank"),
    neighborhood: (0, pg_core_1.text)("neighborhood"),
});
// =====================================================
// 8. MARKET DATA TABLE (Real Estate Market)
// =====================================================
exports.marketData = (0, pg_core_1.pgTable)("market_data", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_23 || (templateObject_23 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(), // Make market data user-specific
    neighborhood: (0, pg_core_1.text)("neighborhood").notNull(),
    avgPrice: (0, pg_core_1.integer)("avg_price"),
    daysOnMarket: (0, pg_core_1.integer)("days_on_market"),
    inventory: (0, pg_core_1.text)("inventory"),
    priceGrowth: (0, pg_core_1.text)("price_growth"),
    trend: (0, pg_core_1.text)("trend"), // 'hot', 'rising', 'steady', 'cooling'
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
});
// =====================================================
// 9. ANALYTICS TABLE (Performance Tracking)
// =====================================================
exports.analytics = (0, pg_core_1.pgTable)("analytics", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_24 || (templateObject_24 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    metricType: (0, pg_core_1.text)("metric_type").notNull(),
    metricValue: (0, pg_core_1.numeric)("metric_value"),
    dimension: (0, pg_core_1.text)("dimension"),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(),
    metadata: (0, pg_core_1.jsonb)("metadata"),
});
// =====================================================
// 10. PROPERTIES TABLE (MLS/Property Listings)
// =====================================================
exports.properties = (0, pg_core_1.pgTable)("properties", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_25 || (templateObject_25 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    mlsId: (0, pg_core_1.text)("mls_id").notNull(),
    listPrice: (0, pg_core_1.integer)("list_price").notNull(),
    address: (0, pg_core_1.text)("address").notNull(),
    city: (0, pg_core_1.text)("city").notNull(),
    state: (0, pg_core_1.text)("state").notNull(),
    zipCode: (0, pg_core_1.text)("zip_code").notNull(),
    bedrooms: (0, pg_core_1.integer)("bedrooms"),
    bathrooms: (0, pg_core_1.real)("bathrooms"),
    squareFootage: (0, pg_core_1.integer)("square_footage"),
    lotSize: (0, pg_core_1.real)("lot_size"),
    yearBuilt: (0, pg_core_1.integer)("year_built"),
    propertyType: (0, pg_core_1.text)("property_type").notNull(),
    listingStatus: (0, pg_core_1.text)("listing_status").notNull(),
    listingDate: (0, pg_core_1.timestamp)("listing_date").notNull(),
    description: (0, pg_core_1.text)("description"),
    features: (0, pg_core_1.text)("features").array(),
    photoUrls: (0, pg_core_1.text)("photo_urls").array(),
    virtualTourUrl: (0, pg_core_1.text)("virtual_tour_url"),
    latitude: (0, pg_core_1.real)("latitude"),
    longitude: (0, pg_core_1.real)("longitude"),
    neighborhood: (0, pg_core_1.text)("neighborhood"),
    schoolDistrict: (0, pg_core_1.text)("school_district"),
    agentId: (0, pg_core_1.text)("agent_id"),
    agentName: (0, pg_core_1.text)("agent_name"),
    officeId: (0, pg_core_1.text)("office_id"),
    officeName: (0, pg_core_1.text)("office_name"),
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// =====================================================
// AI CHAT HISTORY TABLE
// =====================================================
exports.aiChatSessions = (0, pg_core_1.pgTable)("ai_chat_sessions", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_26 || (templateObject_26 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    title: (0, pg_core_1.text)("title").default("New Chat"),
    messages: (0, pg_core_1.jsonb)("messages").$type().default([]),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertAiChatSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.aiChatSessions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.savedPrompts = (0, pg_core_1.pgTable)("saved_prompts", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_27 || (templateObject_27 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    prompt: (0, pg_core_1.text)("prompt").notNull(),
    category: (0, pg_core_1.varchar)("category", { length: 50 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.insertSavedPromptSchema = (0, drizzle_zod_1.createInsertSchema)(exports.savedPrompts).omit({
    id: true,
    createdAt: true,
});
// Legacy AI Content and Social Posts (keeping for compatibility)
exports.aiContent = (0, pg_core_1.pgTable)("ai_content", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_28 || (templateObject_28 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    contentType: (0, pg_core_1.varchar)("content_type").notNull(), // 'social_post', 'blog_article', 'property_description', 'email_campaign'
    title: (0, pg_core_1.varchar)("title"),
    content: (0, pg_core_1.text)("content").notNull(),
    keywords: (0, pg_core_1.jsonb)("keywords").$type(),
    propertyId: (0, pg_core_1.varchar)("property_id"),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.socialPosts = (0, pg_core_1.pgTable)("social_posts", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_29 || (templateObject_29 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    content: (0, pg_core_1.text)("content").notNull(),
    platforms: (0, pg_core_1.jsonb)("platforms").$type(),
    scheduledAt: (0, pg_core_1.timestamp)("scheduled_at"),
    publishedAt: (0, pg_core_1.timestamp)("published_at"),
    status: (0, pg_core_1.varchar)("status").notNull().default("draft"), // 'draft', 'scheduled', 'published', 'failed'
    engagement: (0, pg_core_1.jsonb)("engagement"),
    aiContentId: (0, pg_core_1.varchar)("ai_content_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// User activity log (keeping for compatibility)
exports.userActivity = (0, pg_core_1.pgTable)("user_activity", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_30 || (templateObject_30 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    action: (0, pg_core_1.varchar)("action").notNull(),
    description: (0, pg_core_1.text)("description"),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// File uploads table (keeping for compatibility)
exports.fileUploads = (0, pg_core_1.pgTable)("file_uploads", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_31 || (templateObject_31 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    filename: (0, pg_core_1.varchar)("filename").notNull(),
    originalName: (0, pg_core_1.varchar)("original_name").notNull(),
    mimeType: (0, pg_core_1.varchar)("mime_type").notNull(),
    size: (0, pg_core_1.integer)("size").notNull(),
    path: (0, pg_core_1.varchar)("path").notNull(),
    url: (0, pg_core_1.varchar)("url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// SOCIAL MEDIA API KEYS TABLE
// =====================================================
exports.socialApiKeys = (0, pg_core_1.pgTable)("social_api_keys", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_32 || (templateObject_32 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    facebookAppId: (0, pg_core_1.text)("facebook_app_id"),
    facebookAppSecret: (0, pg_core_1.text)("facebook_app_secret"),
    instagramBusinessAccountId: (0, pg_core_1.text)("instagram_business_account_id"),
    instagramToken: (0, pg_core_1.text)("instagram_token"),
    twitterApiKey: (0, pg_core_1.text)("twitter_api_key"),
    twitterApiSecret: (0, pg_core_1.text)("twitter_api_secret"),
    twitterAccessToken: (0, pg_core_1.text)("twitter_access_token"),
    twitterAccessTokenSecret: (0, pg_core_1.text)("twitter_access_token_secret"),
    linkedinClientId: (0, pg_core_1.text)("linkedin_client_id"),
    linkedinClientSecret: (0, pg_core_1.text)("linkedin_client_secret"),
    linkedinAccessToken: (0, pg_core_1.text)("linkedin_access_token"),
    youtubeApiKey: (0, pg_core_1.text)("youtube_api_key"),
    youtubeChannelId: (0, pg_core_1.text)("youtube_channel_id"),
    tiktokAccessToken: (0, pg_core_1.text)("tiktok_access_token"),
    keysConfigured: (0, pg_core_1.boolean)("keys_configured").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Insert schemas
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({
    id: true,
    createdAt: true,
});
exports.insertContentPieceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.contentPieces).omit({
    id: true,
    createdAt: true,
});
exports.insertSocialMediaAccountSchema = (0, drizzle_zod_1.createInsertSchema)(exports.socialMediaAccounts).omit({
    id: true,
    createdAt: true,
});
exports.insertSEOKeywordSchema = (0, drizzle_zod_1.createInsertSchema)(exports.seoKeywords).omit({
    id: true,
    createdAt: true,
});
exports.insertMarketDataSchema = (0, drizzle_zod_1.createInsertSchema)(exports.marketData).omit({
    id: true,
    lastUpdated: true,
});
exports.insertAnalyticsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.analytics).omit({
    id: true,
    timestamp: true,
});
exports.insertScheduledPostSchema = (0, drizzle_zod_1.createInsertSchema)(exports.scheduledPosts)
    .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
})
    .extend({
    scheduledFor: zod_1.z.coerce.date(), // Coerce ISO strings to Date objects
});
// Update schema for PATCH operations - only mutable fields
exports.updateScheduledPostSchema = zod_1.z
    .object({
    status: zod_1.z.enum(["pending", "approved", "posted", "cancelled"]).optional(),
    content: zod_1.z.string().min(1).optional(),
    scheduledFor: zod_1.z.coerce.date().optional(),
    hashtags: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
})
    .strict();
exports.insertPublicUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.publicUsers).omit({
    id: true,
    createdAt: true,
});
exports.insertAvatarSchema = (0, drizzle_zod_1.createInsertSchema)(exports.avatars).omit({
    id: true,
    createdAt: true,
});
exports.insertMediaAssetSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mediaAssets).omit({
    id: true,
    createdAt: true,
});
exports.insertPostMediaSchema = (0, drizzle_zod_1.createInsertSchema)(exports.postMedia).omit({
    id: true,
    createdAt: true,
});
exports.insertVideoContentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.videoContent).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertPropertySchema = (0, drizzle_zod_1.createInsertSchema)(exports.properties).omit({
    id: true,
    createdAt: true,
    lastUpdated: true,
});
// Legacy insert schemas (keeping for compatibility)
exports.insertAIContentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.aiContent).omit({
    id: true,
    createdAt: true,
});
exports.insertSocialPostSchema = (0, drizzle_zod_1.createInsertSchema)(exports.socialPosts).omit({
    id: true,
    createdAt: true,
});
exports.insertUserActivitySchema = (0, drizzle_zod_1.createInsertSchema)(exports.userActivity).omit({
    id: true,
    createdAt: true,
});
exports.insertFileUploadSchema = (0, drizzle_zod_1.createInsertSchema)(exports.fileUploads).omit({
    id: true,
    createdAt: true,
});
exports.insertSocialApiKeysSchema = (0, drizzle_zod_1.createInsertSchema)(exports.socialApiKeys).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertCustomVoiceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.customVoices).omit({
    id: true,
    createdAt: true,
});
exports.insertUserPreferencesSchema = (0, drizzle_zod_1.createInsertSchema)(exports.userPreferences).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertPhotoAvatarSchema = (0, drizzle_zod_1.createInsertSchema)(exports.photoAvatars).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// TUTORIAL VIDEOS TABLE
// =====================================================
exports.tutorialVideos = (0, pg_core_1.pgTable)("tutorial_videos", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql)(templateObject_33 || (templateObject_33 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    category: (0, pg_core_1.text)("category").notNull(), // e.g., "RealtyFlow Tutorials"
    subcategory: (0, pg_core_1.text)("subcategory").notNull(), // e.g., "Add Social Keys"
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    videoUrl: (0, pg_core_1.text)("video_url").notNull(), // S3 URL
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"), // Optional thumbnail
    duration: (0, pg_core_1.integer)("duration"), // Duration in seconds
    order: (0, pg_core_1.integer)("order").default(0), // Display order within subcategory
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertTutorialVideoSchema = (0, drizzle_zod_1.createInsertSchema)(exports.tutorialVideos).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// =====================================================
// COMPANY PROFILE TABLE (Agent/Company Information)
// =====================================================
exports.companyProfiles = (0, pg_core_1.pgTable)("company_profiles", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_34 || (templateObject_34 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique(),
    companyName: (0, pg_core_1.text)("company_name"),
    businessName: (0, pg_core_1.text)("business_name"),
    agentName: (0, pg_core_1.text)("agent_name"),
    agentTitle: (0, pg_core_1.text)("agent_title"),
    logoUrl: (0, pg_core_1.text)("logo_url"),
    website: (0, pg_core_1.text)("website"),
    phone: (0, pg_core_1.text)("phone"),
    email: (0, pg_core_1.text)("email"),
    address: (0, pg_core_1.text)("address"),
    officeAddress: (0, pg_core_1.text)("office_address"),
    city: (0, pg_core_1.text)("city"),
    state: (0, pg_core_1.text)("state"),
    zipCode: (0, pg_core_1.text)("zip_code"),
    licenseNumber: (0, pg_core_1.text)("license_number"),
    brokerageName: (0, pg_core_1.text)("brokerage_name"),
    tagline: (0, pg_core_1.text)("tagline"),
    bio: (0, pg_core_1.text)("bio"),
    socialLinks: (0, pg_core_1.jsonb)("social_links"),
    businessType: (0, pg_core_1.text)("business_type").default("real_estate"),
    businessSubtype: (0, pg_core_1.text)("business_subtype"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertCompanyProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.companyProfiles).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// =====================================================
// BRAND SETTINGS TABLE (Branding & Visual Identity)
// =====================================================
exports.brandSettings = (0, pg_core_1.pgTable)("brand_settings", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_35 || (templateObject_35 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique(),
    assets: (0, pg_core_1.jsonb)("assets"),
    colors: (0, pg_core_1.jsonb)("colors"),
    fonts: (0, pg_core_1.jsonb)("fonts"),
    description: (0, pg_core_1.text)("description"),
    socialConnections: (0, pg_core_1.jsonb)("social_connections"),
    logoInfo: (0, pg_core_1.jsonb)("logo_info"),
    aiProvider: (0, pg_core_1.text)("ai_provider").default("openai"),
    aiApiKeyEncrypted: (0, pg_core_1.text)("ai_api_key_encrypted"),
    aiApiKeyLastFour: (0, pg_core_1.text)("ai_api_key_last_four"),
    klingApiKeyEncrypted: (0, pg_core_1.text)("kling_api_key_encrypted"),
    klingApiKeyLastFour: (0, pg_core_1.text)("kling_api_key_last_four"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertBrandSettingsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.brandSettings).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// =====================================================
// PLATFORM INTELLIGENCE TAXONOMY
// =====================================================
exports.contentTypeValues = [
    "listing",
    "market_update",
    "buyer_tips",
    "seller_tips",
    "neighborhood",
    "investment",
    "testimonial",
    "general",
];
exports.audiencePersonaValues = [
    "first_time_buyer",
    "luxury_buyer",
    "seller",
    "investor",
    "relocating",
    "general",
];
exports.contentIntentValues = [
    "educate",
    "convert",
    "engage",
    "inform",
    "inspire",
];
exports.propertyClassValues = [
    "luxury",
    "mid_market",
    "starter",
    "investment",
    "general",
];
exports.marketHeatValues = ["hot", "balanced", "cold"];
exports.priceMomentumValues = ["rising", "stable", "falling"];
exports.daysOnMarketTrendValues = ["fast", "normal", "slow"];
exports.platformFitValues = [
    "excellent",
    "very-good",
    "good",
    "fair",
];
exports.contentTypeSchema = zod_1.z.enum(exports.contentTypeValues);
exports.audiencePersonaSchema = zod_1.z.enum(exports.audiencePersonaValues);
exports.contentIntentSchema = zod_1.z.enum(exports.contentIntentValues);
exports.propertyClassSchema = zod_1.z.enum(exports.propertyClassValues);
exports.marketHeatSchema = zod_1.z.enum(exports.marketHeatValues);
exports.priceMomentumSchema = zod_1.z.enum(exports.priceMomentumValues);
exports.daysOnMarketTrendSchema = zod_1.z.enum(exports.daysOnMarketTrendValues);
exports.platformFitSchema = zod_1.z.enum(exports.platformFitValues);
exports.marketSignalsSchema = zod_1.z.object({
    inventoryHeat: exports.marketHeatSchema,
    priceMomentum: exports.priceMomentumSchema,
    daysOnMarketTrend: exports.daysOnMarketTrendSchema,
});
exports.contentProfileSchema = zod_1.z.object({
    contentType: exports.contentTypeSchema,
    audiencePersona: exports.audiencePersonaSchema,
    intent: exports.contentIntentSchema,
    propertyClass: exports.propertyClassSchema.optional(),
    hasEmojis: zod_1.z.boolean(),
    hasHashtags: zod_1.z.boolean(),
    hasNumbers: zod_1.z.boolean(),
    hasQuestions: zod_1.z.boolean(),
    hasCallToAction: zod_1.z.boolean(),
    wordCount: zod_1.z.number(),
    sentimentScore: zod_1.z.number().optional(),
});
exports.platformScoreSchema = zod_1.z.object({
    platform: zod_1.z.string(),
    score: zod_1.z.number(),
    fit: exports.platformFitSchema,
    reasons: zod_1.z.array(zod_1.z.string()),
    optimization: zod_1.z.string(),
    confidence: zod_1.z.number().optional(),
});
// =====================================================
// ENGAGEMENT TRACKING TABLES
// =====================================================
// User Sessions - Track anonymous user browsing sessions
exports.userSessions = (0, pg_core_1.pgTable)("user_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql)(templateObject_36 || (templateObject_36 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    sessionId: (0, pg_core_1.text)("session_id").notNull(),
    publicUserId: (0, pg_core_1.integer)("public_user_id").references(function () { return exports.publicUsers.id; }),
    agentSlug: (0, pg_core_1.text)("agent_slug").notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    deviceType: (0, pg_core_1.text)("device_type"),
    browserName: (0, pg_core_1.text)("browser_name"),
    operatingSystem: (0, pg_core_1.text)("operating_system"),
    country: (0, pg_core_1.text)("country"),
    city: (0, pg_core_1.text)("city"),
    firstPageVisited: (0, pg_core_1.text)("first_page_visited"),
    lastPageVisited: (0, pg_core_1.text)("last_page_visited"),
    totalTimeSpentSeconds: (0, pg_core_1.integer)("total_time_spent_seconds").default(0),
    totalPageViews: (0, pg_core_1.integer)("total_page_views").default(0),
    totalPropertiesViewed: (0, pg_core_1.integer)("total_properties_viewed").default(0),
    totalPropertiesLiked: (0, pg_core_1.integer)("total_properties_liked").default(0),
    conversionType: (0, pg_core_1.text)("conversion_type"),
    conversionValue: (0, pg_core_1.text)("conversion_value"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
}, function (table) { return ({
    sessionIdKey: (0, pg_core_1.unique)("user_sessions_session_id_key").on(table.sessionId),
}); });
// Property Interactions - Track individual user interactions
exports.propertyInteractions = (0, pg_core_1.pgTable)("property_interactions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql)(templateObject_37 || (templateObject_37 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    publicUserId: (0, pg_core_1.integer)("public_user_id").references(function () { return exports.publicUsers.id; }),
    propertyId: (0, pg_core_1.text)("property_id"),
    agentSlug: (0, pg_core_1.text)("agent_slug").notNull(),
    interactionType: (0, pg_core_1.text)("interaction_type").notNull(),
    interactionValue: (0, pg_core_1.text)("interaction_value"),
    timeSpentSeconds: (0, pg_core_1.integer)("time_spent_seconds").default(0),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    sessionId: (0, pg_core_1.text)("session_id"),
    referrerUrl: (0, pg_core_1.text)("referrer_url"),
    currentUrl: (0, pg_core_1.text)("current_url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Property Likes - Track property favorites
exports.propertyLikes = (0, pg_core_1.pgTable)("property_likes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql)(templateObject_38 || (templateObject_38 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    publicUserId: (0, pg_core_1.integer)("public_user_id").references(function () { return exports.publicUsers.id; }),
    propertyId: (0, pg_core_1.text)("property_id").notNull(),
    agentSlug: (0, pg_core_1.text)("agent_slug").notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    sessionId: (0, pg_core_1.text)("session_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Engagement Leads - Auto-generated leads from high engagement
exports.engagementLeads = (0, pg_core_1.pgTable)("engagement_leads", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql)(templateObject_39 || (templateObject_39 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    publicUserId: (0, pg_core_1.integer)("public_user_id").references(function () { return exports.publicUsers.id; }),
    sessionId: (0, pg_core_1.text)("session_id").references(function () { return exports.userSessions.sessionId; }),
    agentId: (0, pg_core_1.varchar)("agent_id").references(function () { return exports.users.id; }),
    agentSlug: (0, pg_core_1.text)("agent_slug").notNull(),
    engagementScore: (0, pg_core_1.integer)("engagement_score").default(0),
    engagementReason: (0, pg_core_1.text)("engagement_reason").notNull(),
    engagementDetails: (0, pg_core_1.jsonb)("engagement_details"),
    mostViewedPropertyId: (0, pg_core_1.text)("most_viewed_property_id"),
    mostTimeSpentPropertyId: (0, pg_core_1.text)("most_time_spent_property_id"),
    likedPropertyIds: (0, pg_core_1.jsonb)("liked_property_ids"),
    detectedEmail: (0, pg_core_1.text)("detected_email"),
    detectedPhone: (0, pg_core_1.text)("detected_phone"),
    detectedName: (0, pg_core_1.text)("detected_name"),
    leadQuality: (0, pg_core_1.text)("lead_quality").default("warm"),
    leadStatus: (0, pg_core_1.text)("lead_status").default("auto_generated"),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    convertedToContactAt: (0, pg_core_1.timestamp)("converted_to_contact_at"),
    contactedAt: (0, pg_core_1.timestamp)("contacted_at"),
});
// Content Opportunities - AI-generated content suggestions
exports.contentOpportunities = (0, pg_core_1.pgTable)("content_opportunities", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_40 || (templateObject_40 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    opportunityType: (0, pg_core_1.text)("opportunity_type").notNull(),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    priority: (0, pg_core_1.integer)("priority").default(5),
    status: (0, pg_core_1.text)("status").default("pending"),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.insertUserSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.userSessions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertPropertyInteractionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.propertyInteractions).omit({
    id: true,
    createdAt: true,
});
exports.insertPropertyLikeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.propertyLikes).omit({
    id: true,
    createdAt: true,
});
exports.insertEngagementLeadSchema = (0, drizzle_zod_1.createInsertSchema)(exports.engagementLeads).omit({
    id: true,
    createdAt: true,
});
exports.insertContentOpportunitySchema = (0, drizzle_zod_1.createInsertSchema)(exports.contentOpportunities).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// EVENT SOURCES TABLE (Calendar and Event Feed Sources)
// =====================================================
exports.eventSources = (0, pg_core_1.pgTable)("event_sources", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_41 || (templateObject_41 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    businessType: (0, pg_core_1.text)("business_type").notNull().default("real_estate"),
    name: (0, pg_core_1.text)("name").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // 'google_calendar_public', 'google_calendar_private', 'ical', 'aggregator'
    config: (0, pg_core_1.jsonb)("config").$type(),
    status: (0, pg_core_1.text)("status").notNull().default("active"), // 'active', 'paused', 'error'
    lastSyncAt: (0, pg_core_1.timestamp)("last_sync_at"),
    lastSyncStatus: (0, pg_core_1.text)("last_sync_status"), // 'success', 'failed', 'partial'
    syncError: (0, pg_core_1.text)("sync_error"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// =====================================================
// EVENTS TABLE (Events from Various Sources)
// =====================================================
exports.events = (0, pg_core_1.pgTable)("events", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_42 || (templateObject_42 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    businessType: (0, pg_core_1.text)("business_type").notNull().default("real_estate"),
    sourceId: (0, pg_core_1.varchar)("source_id").notNull(), // References eventSources.id
    externalId: (0, pg_core_1.text)("external_id").notNull(), // ID from the external source (for dedup)
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    startTime: (0, pg_core_1.timestamp)("start_time").notNull(),
    endTime: (0, pg_core_1.timestamp)("end_time"),
    timezone: (0, pg_core_1.text)("timezone").default("America/Chicago"),
    location: (0, pg_core_1.text)("location"),
    locationAddress: (0, pg_core_1.text)("location_address"),
    eventUrl: (0, pg_core_1.text)("event_url"),
    imageUrl: (0, pg_core_1.text)("image_url"),
    isAllDay: (0, pg_core_1.boolean)("is_all_day").default(false),
    visibility: (0, pg_core_1.text)("visibility").default("public"), // 'public', 'private'
    category: (0, pg_core_1.text)("category"), // 'real_estate', 'community', 'market', 'networking', etc.
    tags: (0, pg_core_1.text)("tags").array(),
    rawData: (0, pg_core_1.jsonb)("raw_data"), // Store original event data
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
}, function (table) { return ({
    // Unique constraint to prevent duplicate events
    uniqueUserSourceEvent: (0, pg_core_1.unique)().on(table.userId, table.sourceId, table.externalId),
}); });
// =====================================================
// EVENT POST SUGGESTIONS TABLE (AI-Generated Post Ideas)
// =====================================================
exports.eventPostSuggestions = (0, pg_core_1.pgTable)("event_post_suggestions", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_43 || (templateObject_43 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    eventId: (0, pg_core_1.varchar)("event_id").notNull(), // References events.id
    platform: (0, pg_core_1.text)("platform").notNull(), // 'facebook', 'instagram', 'linkedin', 'x'
    content: (0, pg_core_1.text)("content").notNull(),
    hashtags: (0, pg_core_1.text)("hashtags").array(),
    suggestedPostTime: (0, pg_core_1.timestamp)("suggested_post_time"), // When to post (e.g., 24h before event)
    status: (0, pg_core_1.text)("status").notNull().default("suggested"), // 'suggested', 'accepted', 'rejected', 'scheduled'
    scheduledPostId: (0, pg_core_1.varchar)("scheduled_post_id"), // References scheduledPosts.id if accepted
    aiMetadata: (0, pg_core_1.jsonb)("ai_metadata"), // Store AI generation details
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Insert schemas and types for event tables
exports.insertEventSourceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.eventSources).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertEventSchema = (0, drizzle_zod_1.createInsertSchema)(exports.events).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertEventPostSuggestionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.eventPostSuggestions).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// PKCE CODE STORAGE (for OAuth 2.0 flows)
// =====================================================
exports.pkceStore = (0, pg_core_1.pgTable)("pkce_store", {
    state: (0, pg_core_1.varchar)("state").primaryKey(),
    codeVerifier: (0, pg_core_1.text)("code_verifier").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.insertPKCESchema = (0, drizzle_zod_1.createInsertSchema)(exports.pkceStore).omit({
    createdAt: true,
});
// =====================================================
// COMPLIANCE SETTINGS TABLE (Brokerage Compliance)
// =====================================================
exports.complianceSettings = (0, pg_core_1.pgTable)("compliance_settings", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_44 || (templateObject_44 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique(),
    brokerageName: (0, pg_core_1.text)("brokerage_name").notNull().default("BHHS Ambassador Real Estate"),
    brokerageShortName: (0, pg_core_1.text)("brokerage_short_name").default("BHHS Ambassador"),
    agentName: (0, pg_core_1.text)("agent_name"),
    teamName: (0, pg_core_1.text)("team_name"),
    licenseType: (0, pg_core_1.text)("license_type").default("agent"), // 'agent', 'broker', 'associate_broker'
    requireBrokerageInFirstLine: (0, pg_core_1.boolean)("require_brokerage_in_first_line").default(true),
    requireBrokerageOnMedia: (0, pg_core_1.boolean)("require_brokerage_on_media").default(true),
    requireBrokerageInVideo: (0, pg_core_1.boolean)("require_brokerage_in_video").default(true),
    autoAddBrokerage: (0, pg_core_1.boolean)("auto_add_brokerage").default(true),
    complianceRules: (0, pg_core_1.jsonb)("compliance_rules").$type(),
    isEnabled: (0, pg_core_1.boolean)("is_enabled").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertComplianceSettingsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.complianceSettings).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// =====================================================
// VIDEO TEMPLATES TABLE (Template-based video generation)
// =====================================================
exports.videoTemplates = (0, pg_core_1.pgTable)("video_templates", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_45 || (templateObject_45 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    slug: (0, pg_core_1.text)("slug").notNull().unique(),
    name: (0, pg_core_1.text)("name").notNull(),
    category: (0, pg_core_1.text)("category").notNull(),
    description: (0, pg_core_1.text)("description"),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    defaultAvatarId: (0, pg_core_1.text)("default_avatar_id"),
    defaultVoiceId: (0, pg_core_1.text)("default_voice_id"),
    scriptTemplate: (0, pg_core_1.text)("script_template").notNull(),
    renderSettings: (0, pg_core_1.jsonb)("render_settings").$type(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// =====================================================
// TEMPLATE VARIABLES TABLE (Variables for each template)
// =====================================================
exports.templateVariables = (0, pg_core_1.pgTable)("template_variables", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_46 || (templateObject_46 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    templateId: (0, pg_core_1.varchar)("template_id").notNull(),
    key: (0, pg_core_1.text)("key").notNull(),
    label: (0, pg_core_1.text)("label").notNull(),
    fieldType: (0, pg_core_1.text)("field_type").notNull(),
    placeholder: (0, pg_core_1.text)("placeholder"),
    helperText: (0, pg_core_1.text)("helper_text"),
    required: (0, pg_core_1.boolean)("required").default(true),
    options: (0, pg_core_1.jsonb)("options").$type(),
    defaultValue: (0, pg_core_1.text)("default_value"),
    orderIndex: (0, pg_core_1.integer)("order_index").default(0),
});
// =====================================================
// GENERATED VIDEOS TABLE (Videos created from templates)
// =====================================================
exports.generatedVideos = (0, pg_core_1.pgTable)("generated_videos", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_47 || (templateObject_47 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    templateId: (0, pg_core_1.varchar)("template_id"),
    templateName: (0, pg_core_1.text)("template_name"),
    avatarId: (0, pg_core_1.text)("avatar_id"),
    voiceId: (0, pg_core_1.text)("voice_id"),
    title: (0, pg_core_1.text)("title"),
    generatedScript: (0, pg_core_1.text)("generated_script"),
    variables: (0, pg_core_1.jsonb)("variables").$type(),
    status: (0, pg_core_1.text)("status").notNull().default("draft"),
    heygenVideoId: (0, pg_core_1.text)("heygen_video_id"),
    videoUrl: (0, pg_core_1.text)("video_url"),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    duration: (0, pg_core_1.real)("duration"),
    errorMessage: (0, pg_core_1.text)("error_message"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
});
// Insert schemas and types for video templates
exports.insertVideoTemplateSchema = (0, drizzle_zod_1.createInsertSchema)(exports.videoTemplates).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertTemplateVariableSchema = (0, drizzle_zod_1.createInsertSchema)(exports.templateVariables).omit({
    id: true,
});
exports.insertGeneratedVideoSchema = (0, drizzle_zod_1.createInsertSchema)(exports.generatedVideos).omit({
    id: true,
    createdAt: true,
    completedAt: true,
});
// =====================================================
// VIDEO GENERATION JOBS TABLE (Background Processing)
// =====================================================
exports.videoGenerationJobs = (0, pg_core_1.pgTable)("video_generation_jobs", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_48 || (templateObject_48 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    source: (0, pg_core_1.text)("source").notNull(), // 'avatar_iv', 'video_studio', 'template'
    heygenVideoId: (0, pg_core_1.text)("heygen_video_id"),
    title: (0, pg_core_1.text)("title"),
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
    progress: (0, pg_core_1.integer)("progress").default(0),
    videoUrl: (0, pg_core_1.text)("video_url"),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    errorMessage: (0, pg_core_1.text)("error_message"),
    metadata: (0, pg_core_1.jsonb)("metadata").$type(),
    notificationSent: (0, pg_core_1.boolean)("notification_sent").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
});
exports.insertVideoGenerationJobSchema = (0, drizzle_zod_1.createInsertSchema)(exports.videoGenerationJobs).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
});
// =====================================================
// TWILIO SETTINGS TABLE (Per-subscriber phone configuration)
// =====================================================
exports.twilioSettings = (0, pg_core_1.pgTable)("twilio_settings", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_49 || (templateObject_49 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique(),
    phoneNumber: (0, pg_core_1.text)("phone_number"), // Twilio phone number assigned to this subscriber
    twilioAccountSid: (0, pg_core_1.text)("twilio_account_sid"), // Optional: subscriber's own Twilio account
    twilioAuthToken: (0, pg_core_1.text)("twilio_auth_token"), // Encrypted auth token
    isEnabled: (0, pg_core_1.boolean)("is_enabled").default(false),
    // AI Chatbot Settings
    aiGreeting: (0, pg_core_1.text)("ai_greeting").default("Hello! Thank you for reaching out. I'm an AI assistant for a local real estate agent. How can I help you today?"),
    aiPersonality: (0, pg_core_1.text)("ai_personality").default("friendly"), // 'friendly', 'professional', 'casual'
    businessHoursStart: (0, pg_core_1.text)("business_hours_start").default("09:00"),
    businessHoursEnd: (0, pg_core_1.text)("business_hours_end").default("17:00"),
    afterHoursMessage: (0, pg_core_1.text)("after_hours_message").default("Thanks for reaching out! Our office is currently closed. We'll get back to you during business hours."),
    // Lead capture settings
    captureLeadOnFirstMessage: (0, pg_core_1.boolean)("capture_lead_on_first_message").default(true),
    askForName: (0, pg_core_1.boolean)("ask_for_name").default(true),
    askForEmail: (0, pg_core_1.boolean)("ask_for_email").default(true),
    // Business info for AI context
    agentName: (0, pg_core_1.text)("agent_name"),
    brokerageName: (0, pg_core_1.text)("brokerage_name"),
    serviceAreas: (0, pg_core_1.text)("service_areas").array(), // Neighborhoods/areas served
    specialties: (0, pg_core_1.text)("specialties").array(), // 'luxury', 'first-time buyers', etc.
    // Voice settings
    voiceGreeting: (0, pg_core_1.text)("voice_greeting").default("Hello! Thank you for calling. I'm an AI assistant. How can I help you today?"),
    voiceEnabled: (0, pg_core_1.boolean)("voice_enabled").default(false),
    transferNumber: (0, pg_core_1.text)("transfer_number"), // Number to transfer calls to for live agent
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// =====================================================
// TWILIO CONVERSATIONS TABLE (SMS/Voice chat history)
// =====================================================
exports.twilioConversations = (0, pg_core_1.pgTable)("twilio_conversations", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_50 || (templateObject_50 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(), // The agent/subscriber who owns this conversation
    fromNumber: (0, pg_core_1.text)("from_number").notNull(), // The caller/texter's phone number
    toNumber: (0, pg_core_1.text)("to_number").notNull(), // The Twilio number that received it
    conversationType: (0, pg_core_1.text)("conversation_type").notNull().default("sms"), // 'sms' or 'voice'
    status: (0, pg_core_1.text)("status").notNull().default("active"), // 'active', 'closed', 'converted'
    // Lead info captured during conversation
    leadName: (0, pg_core_1.text)("lead_name"),
    leadEmail: (0, pg_core_1.text)("lead_email"),
    leadInterest: (0, pg_core_1.text)("lead_interest"), // 'buying', 'selling', 'both', 'general'
    leadQuality: (0, pg_core_1.text)("lead_quality").default("warm"), // 'hot', 'warm', 'cold'
    leadNotes: (0, pg_core_1.text)("lead_notes"), // AI-generated summary of conversation
    // Timestamps
    lastMessageAt: (0, pg_core_1.timestamp)("last_message_at").defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    convertedToLeadAt: (0, pg_core_1.timestamp)("converted_to_lead_at"),
});
// =====================================================
// TWILIO MESSAGES TABLE (Individual messages in conversations)
// =====================================================
exports.twilioMessages = (0, pg_core_1.pgTable)("twilio_messages", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_51 || (templateObject_51 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    conversationId: (0, pg_core_1.varchar)("conversation_id").notNull(),
    twilioMessageSid: (0, pg_core_1.text)("twilio_message_sid"), // Twilio's message ID
    direction: (0, pg_core_1.text)("direction").notNull(), // 'inbound' or 'outbound'
    messageType: (0, pg_core_1.text)("message_type").notNull().default("sms"), // 'sms', 'mms', 'voice_transcript'
    body: (0, pg_core_1.text)("body").notNull(),
    mediaUrls: (0, pg_core_1.text)("media_urls").array(), // For MMS attachments
    status: (0, pg_core_1.text)("status").default("delivered"), // 'queued', 'sent', 'delivered', 'failed'
    isAiGenerated: (0, pg_core_1.boolean)("is_ai_generated").default(false),
    aiModel: (0, pg_core_1.text)("ai_model"), // 'gpt-4o', etc.
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// =====================================================
// PLATFORM SETTINGS TABLE (Admin-level integrations)
// =====================================================
exports.platformSettings = (0, pg_core_1.pgTable)("platform_settings", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_52 || (templateObject_52 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    key: (0, pg_core_1.text)("key").notNull().unique(),
    value: (0, pg_core_1.jsonb)("value"),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    updatedBy: (0, pg_core_1.varchar)("updated_by"),
});
exports.insertPlatformSettingSchema = (0, drizzle_zod_1.createInsertSchema)(exports.platformSettings).omit({
    id: true,
    updatedAt: true,
});
// Twilio insert schemas and types
exports.insertTwilioSettingsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.twilioSettings).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertTwilioConversationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.twilioConversations).omit({
    id: true,
    createdAt: true,
});
exports.insertTwilioMessageSchema = (0, drizzle_zod_1.createInsertSchema)(exports.twilioMessages).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// AI ASSISTANT MESSAGES TABLE
// =====================================================
exports.aiAssistantMessages = (0, pg_core_1.pgTable)("ai_assistant_messages", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_53 || (templateObject_53 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    role: (0, pg_core_1.text)("role").notNull(), // 'user' or 'assistant'
    content: (0, pg_core_1.text)("content").notNull(),
    attachments: (0, pg_core_1.jsonb)("attachments"), // Array of { url: string, type: string, name: string }
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.insertAiAssistantMessageSchema = (0, drizzle_zod_1.createInsertSchema)(exports.aiAssistantMessages).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// WHATSAPP SETTINGS TABLE (Per-user WhatsApp Business configuration)
// =====================================================
exports.whatsappSettings = (0, pg_core_1.pgTable)("whatsapp_settings", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_54 || (templateObject_54 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique(),
    phoneNumberId: (0, pg_core_1.text)("phone_number_id"), // WhatsApp Cloud API phone number ID
    wabaId: (0, pg_core_1.text)("waba_id"), // WhatsApp Business Account ID
    displayPhoneNumber: (0, pg_core_1.text)("display_phone_number"), // formatted phone number for display
    accessToken: (0, pg_core_1.text)("access_token"), // permanent token from Meta
    webhookVerifyToken: (0, pg_core_1.text)("webhook_verify_token"), // random token for webhook verification
    isEnabled: (0, pg_core_1.boolean)("is_enabled").default(false),
    // AI Chatbot Settings
    aiGreeting: (0, pg_core_1.text)("ai_greeting").default("Hello! Thanks for reaching out. I'm an AI assistant for a local real estate agent. How can I help you today?"),
    aiPersonality: (0, pg_core_1.text)("ai_personality").default("friendly"), // 'friendly', 'professional', 'casual'
    businessHoursStart: (0, pg_core_1.text)("business_hours_start").default("09:00"),
    businessHoursEnd: (0, pg_core_1.text)("business_hours_end").default("17:00"),
    afterHoursMessage: (0, pg_core_1.text)("after_hours_message").default("Thanks for reaching out! Our office is currently closed. We'll get back to you during business hours."),
    // Lead capture settings
    captureLeadOnFirstMessage: (0, pg_core_1.boolean)("capture_lead_on_first_message").default(true),
    askForName: (0, pg_core_1.boolean)("ask_for_name").default(true),
    askForEmail: (0, pg_core_1.boolean)("ask_for_email").default(true),
    // Business info for AI context
    agentName: (0, pg_core_1.text)("agent_name"),
    brokerageName: (0, pg_core_1.text)("brokerage_name"),
    serviceAreas: (0, pg_core_1.text)("service_areas").array(), // Neighborhoods/areas served
    specialties: (0, pg_core_1.text)("specialties").array(), // 'luxury', 'first-time buyers', etc.
    accounts: (0, pg_core_1.jsonb)("accounts").default([]), // [{label, phoneNumberId, wabaId, displayPhoneNumber}]
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// =====================================================
// WHATSAPP CONVERSATIONS TABLE (Chat threads)
// =====================================================
exports.whatsappConversations = (0, pg_core_1.pgTable)("whatsapp_conversations", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_55 || (templateObject_55 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    waId: (0, pg_core_1.text)("wa_id").notNull(), // the contact's WhatsApp ID (phone number)
    contactName: (0, pg_core_1.text)("contact_name"),
    status: (0, pg_core_1.text)("status").notNull().default("active"), // 'active', 'closed', 'converted'
    // Lead info captured during conversation
    leadName: (0, pg_core_1.text)("lead_name"),
    leadEmail: (0, pg_core_1.text)("lead_email"),
    leadInterest: (0, pg_core_1.text)("lead_interest"), // 'buying', 'selling', 'both', 'general'
    leadQuality: (0, pg_core_1.text)("lead_quality").default("warm"), // 'hot', 'warm', 'cold'
    leadNotes: (0, pg_core_1.text)("lead_notes"), // AI-generated summary of conversation
    // Timestamps
    lastMessageAt: (0, pg_core_1.timestamp)("last_message_at").defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    convertedToLeadAt: (0, pg_core_1.timestamp)("converted_to_lead_at"),
});
// =====================================================
// WHATSAPP MESSAGES TABLE (Individual messages in conversations)
// =====================================================
exports.whatsappMessages = (0, pg_core_1.pgTable)("whatsapp_messages", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_56 || (templateObject_56 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    conversationId: (0, pg_core_1.varchar)("conversation_id").notNull(),
    whatsappMessageId: (0, pg_core_1.text)("whatsapp_message_id"), // Meta's message ID
    direction: (0, pg_core_1.text)("direction").notNull(), // 'inbound' or 'outbound'
    messageType: (0, pg_core_1.text)("message_type").notNull().default("text"), // 'text', 'image', 'template'
    body: (0, pg_core_1.text)("body").notNull(),
    mediaUrl: (0, pg_core_1.text)("media_url"),
    status: (0, pg_core_1.text)("status").default("delivered"), // 'queued', 'sent', 'delivered', 'failed'
    isAiGenerated: (0, pg_core_1.boolean)("is_ai_generated").default(false),
    aiModel: (0, pg_core_1.text)("ai_model"), // 'gpt-4o', etc.
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// WhatsApp insert schemas and types
exports.insertWhatsappSettingsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.whatsappSettings).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertWhatsappConversationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.whatsappConversations).omit({
    id: true,
    createdAt: true,
});
exports.insertWhatsappMessageSchema = (0, drizzle_zod_1.createInsertSchema)(exports.whatsappMessages).omit({
    id: true,
    createdAt: true,
});
// =====================================================
// MENU ITEMS / CATALOG TABLE (Multi-vertical items)
// Used for: restaurant menu items, services, products, listings
// =====================================================
exports.menuItems = (0, pg_core_1.pgTable)("menu_items", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_57 || (templateObject_57 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    businessType: (0, pg_core_1.text)("business_type").notNull().default("restaurant"),
    name: (0, pg_core_1.text)("name").notNull(),
    category: (0, pg_core_1.text)("category"),
    price: (0, pg_core_1.numeric)("price", { precision: 10, scale: 2 }),
    description: (0, pg_core_1.text)("description"),
    ingredients: (0, pg_core_1.text)("ingredients").array(),
    dietaryTags: (0, pg_core_1.text)("dietary_tags").array(),
    allergens: (0, pg_core_1.text)("allergens").array(),
    imageUrls: (0, pg_core_1.text)("image_urls").array(),
    availability: (0, pg_core_1.text)("availability").default("always"),
    isSpecial: (0, pg_core_1.boolean)("is_special").default(false),
    specialPrice: (0, pg_core_1.numeric)("special_price", { precision: 10, scale: 2 }),
    status: (0, pg_core_1.text)("status").default("active"),
    tags: (0, pg_core_1.text)("tags").array(),
    notes: (0, pg_core_1.text)("notes"),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertMenuItemSchema = (0, drizzle_zod_1.createInsertSchema)(exports.menuItems).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// =====================================================
// BUSINESS LOCATIONS TABLE (Restaurants, offices, etc.)
// =====================================================
exports.businessLocations = (0, pg_core_1.pgTable)("business_locations", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_58 || (templateObject_58 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    address: (0, pg_core_1.text)("address"),
    city: (0, pg_core_1.text)("city"),
    state: (0, pg_core_1.text)("state"),
    zipCode: (0, pg_core_1.text)("zip_code"),
    phoneNumber: (0, pg_core_1.text)("phone_number"),
    email: (0, pg_core_1.text)("email"),
    website: (0, pg_core_1.text)("website"),
    operatingHours: (0, pg_core_1.jsonb)("operating_hours"),
    cuisineTypes: (0, pg_core_1.text)("cuisine_types").array(),
    diningOptions: (0, pg_core_1.text)("dining_options").array(),
    acceptsReservations: (0, pg_core_1.boolean)("accepts_reservations").default(false),
    deliveryRadius: (0, pg_core_1.integer)("delivery_radius"),
    status: (0, pg_core_1.text)("status").default("open"),
    isPrimary: (0, pg_core_1.boolean)("is_primary").default(false),
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertBusinessLocationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.businessLocations).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// =====================================================
// WHATSAPP BULK SEND QUEUES
// Auto-queue remaining contacts for next-day delivery
// =====================================================
exports.whatsappBulkQueues = (0, pg_core_1.pgTable)("whatsapp_bulk_queues", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_59 || (templateObject_59 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default("active"),
    templateName: (0, pg_core_1.text)("template_name"),
    messageText: (0, pg_core_1.text)("message_text"),
    totalNumbers: (0, pg_core_1.integer)("total_numbers").notNull(),
    sentCount: (0, pg_core_1.integer)("sent_count").notNull().default(0),
    failedCount: (0, pg_core_1.integer)("failed_count").notNull().default(0),
    remainingNumbers: (0, pg_core_1.text)("remaining_numbers").array().notNull(),
    sentNumbers: (0, pg_core_1.text)("sent_numbers").array().notNull().default((0, drizzle_orm_1.sql)(templateObject_60 || (templateObject_60 = __makeTemplateObject(["'{}'::text[]"], ["'{}'::text[]"])))),
    failedNumbers: (0, pg_core_1.text)("failed_numbers").array().notNull().default((0, drizzle_orm_1.sql)(templateObject_61 || (templateObject_61 = __makeTemplateObject(["'{}'::text[]"], ["'{}'::text[]"])))),
    dailyLimit: (0, pg_core_1.integer)("daily_limit").notNull().default(2000),
    lastBatchSentAt: (0, pg_core_1.timestamp)("last_batch_sent_at"),
    nextBatchAt: (0, pg_core_1.timestamp)("next_batch_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertWhatsappBulkQueueSchema = (0, drizzle_zod_1.createInsertSchema)(exports.whatsappBulkQueues).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.whatsappBulkSendResults = (0, pg_core_1.pgTable)("whatsapp_bulk_send_results", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_62 || (templateObject_62 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    sent: (0, pg_core_1.integer)("sent").notNull().default(0),
    failed: (0, pg_core_1.integer)("failed").notNull().default(0),
    total: (0, pg_core_1.integer)("total").notNull().default(0),
    queued: (0, pg_core_1.integer)("queued").notNull().default(0),
    percent: (0, pg_core_1.integer)("percent").notNull().default(0),
    elapsed: (0, pg_core_1.integer)("elapsed").notNull().default(0),
    estimatedCost: (0, pg_core_1.text)("estimated_cost"),
    errorBreakdown: (0, pg_core_1.text)("error_breakdown"),
    complete: (0, pg_core_1.boolean)("complete").notNull().default(false),
    message: (0, pg_core_1.text)("message"),
    bulkQueueId: (0, pg_core_1.varchar)("bulk_queue_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// =====================================================
// BOARDS — Luma-style generation workspace
// =====================================================
exports.boards = (0, pg_core_1.pgTable)("boards", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_63 || (templateObject_63 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    title: (0, pg_core_1.text)("title").notNull().default("Untitled board"),
    isShared: (0, pg_core_1.boolean)("is_shared").notNull().default(false),
    // Per-board cap on persisted chat messages. When a new message pushes the
    // total over this number, the oldest rows are auto-trimmed. Defaults to
    // the historical 200 so existing boards keep their current behavior.
    chatHistoryCap: (0, pg_core_1.integer)("chat_history_cap").notNull().default(200),
    // Per-board owner preference: when false, the server skips the
    // board_shared / board_unshared / board_left transactional emails for
    // this board. In-app notifications still fire so the bell remains useful.
    // Defaults to true so existing boards keep their current behavior.
    notifyOnCollaboratorChange: (0, pg_core_1.boolean)("notify_on_collaborator_change")
        .notNull()
        .default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
}, function (table) { return [
    (0, pg_core_1.index)("IDX_boards_user").on(table.userId),
]; });
exports.insertBoardSchema = (0, drizzle_zod_1.createInsertSchema)(exports.boards).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.boardAssets = (0, pg_core_1.pgTable)("board_assets", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_64 || (templateObject_64 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    boardId: (0, pg_core_1.varchar)("board_id").notNull().references(function () { return exports.boards.id; }, { onDelete: "cascade" }),
    batchId: (0, pg_core_1.varchar)("batch_id").notNull(),
    batchLabel: (0, pg_core_1.text)("batch_label"),
    kind: (0, pg_core_1.varchar)("kind", { length: 16 }).notNull(), // 'image' | 'video' | 'audio'
    assetUrl: (0, pg_core_1.text)("asset_url"),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    durationSeconds: (0, pg_core_1.real)("duration_seconds"),
    provider: (0, pg_core_1.varchar)("provider", { length: 32 }).notNull(),
    modelLabel: (0, pg_core_1.text)("model_label"),
    positionX: (0, pg_core_1.real)("position_x").notNull().default(0),
    positionY: (0, pg_core_1.real)("position_y").notNull().default(0),
    width: (0, pg_core_1.real)("width").notNull().default(320),
    height: (0, pg_core_1.real)("height").notNull().default(180),
    status: (0, pg_core_1.varchar)("status", { length: 16 }).notNull().default("queued"), // queued | generating | ready | failed | rejected
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    // Free-text body for tool-created assets that don't have a media URL
    // (sticky notes, text labels, frame titles, drawing SVG markup, etc.).
    // Null for generated/upload assets where the URL is the source of truth.
    content: (0, pg_core_1.text)("content"),
    evalHistory: (0, pg_core_1.jsonb)("eval_history").$type().default([]),
    // When this asset was produced by editing/remixing another asset on the
    // board (image edit flow), this points to the source asset id so the UI can
    // surface a before/after view. Nullable for non-edit batches.
    sourceAssetId: (0, pg_core_1.varchar)("source_asset_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (table) { return [
    (0, pg_core_1.index)("IDX_board_assets_board").on(table.boardId),
    (0, pg_core_1.index)("IDX_board_assets_batch").on(table.batchId),
]; });
exports.insertBoardAssetSchema = (0, drizzle_zod_1.createInsertSchema)(exports.boardAssets).omit({
    id: true,
    createdAt: true,
});
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
exports.DRAWING_MAX_STROKES = 200;
exports.DRAWING_MAX_POINTS_PER_STROKE = 2000;
exports.DRAWING_MAX_DIMENSION = 8192;
exports.DRAWING_MAX_CONTENT_BYTES = 60000;
exports.DRAWING_SOFT_STROKE_WARN = 150;
// Hex color (#rgb / #rrggbb / #rrggbbaa). Drawing tool only emits hex today;
// rejecting other forms blocks accidental injection of url(...) refs, CSS
// expressions, etc.
var drawingColorSchema = zod_1.z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
var drawingPointSchema = zod_1.z.object({
    x: zod_1.z.number().finite(),
    y: zod_1.z.number().finite(),
});
var drawingStrokeSchema = zod_1.z.object({
    color: drawingColorSchema,
    width: zod_1.z.number().finite().min(0.1).max(64),
    points: zod_1.z.array(drawingPointSchema).min(1).max(exports.DRAWING_MAX_POINTS_PER_STROKE),
});
exports.drawingPayloadSchema = zod_1.z.object({
    v: zod_1.z.literal(1),
    width: zod_1.z.number().finite().positive().max(exports.DRAWING_MAX_DIMENSION),
    height: zod_1.z.number().finite().positive().max(exports.DRAWING_MAX_DIMENSION),
    strokes: zod_1.z.array(drawingStrokeSchema).max(exports.DRAWING_MAX_STROKES),
});
// Parse + validate a drawing content blob (a JSON-encoded DrawingPayload).
// Returns the parsed payload re-serialized to a canonical JSON string when
// valid, or null when the input is missing/invalid. Used by the boards API
// to sanitize drawing assets before persisting.
function sanitizeDrawingContent(raw) {
    if (raw == null)
        return null;
    if (typeof raw !== "string")
        return null;
    var parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (_a) {
        return null;
    }
    var result = exports.drawingPayloadSchema.safeParse(parsed);
    if (!result.success)
        return null;
    return JSON.stringify(result.data);
}
exports.boardMessages = (0, pg_core_1.pgTable)("board_messages", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_65 || (templateObject_65 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    boardId: (0, pg_core_1.varchar)("board_id")
        .notNull()
        .references(function () { return exports.boards.id; }, { onDelete: "cascade" }),
    // Which user authored this turn. Always set for new rows; nullable so the
    // backfill is non-breaking for messages persisted before collaborator chat
    // landed (those rows are owner-authored by definition — the only writer the
    // /messages routes accepted at the time). The GET handler treats NULL as
    // "the board owner" so the UI label is still correct for legacy rows.
    // Assistant turns also carry the userId of the human whose request
    // produced them, which is enough for the owner-readable audit ("who asked
    // the question that produced this reply") without inventing a separate
    // "assistant author" concept.
    authorUserId: (0, pg_core_1.varchar)("author_user_id").references(function () { return exports.users.id; }, {
        onDelete: "set null",
    }),
    role: (0, pg_core_1.varchar)("role", { length: 16 }).notNull(), // 'user' | 'assistant'
    content: (0, pg_core_1.text)("content").notNull(),
    // Friendly fallback notice ("Claude was unavailable, used Gemini instead.")
    // surfaced as an italic prefix in the UI. Null for user messages and for
    // assistant replies that didn't cascade.
    notice: (0, pg_core_1.text)("notice"),
    // Optional CTA bubble payload (e.g. "Open Photo Avatars"). Null for the
    // common case.
    cta: (0, pg_core_1.jsonb)("cta").$type(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (table) { return [
    (0, pg_core_1.index)("IDX_board_messages_board_created").on(table.boardId, table.createdAt),
]; });
exports.insertBoardMessageSchema = (0, drizzle_zod_1.createInsertSchema)(exports.boardMessages).omit({
    id: true,
    createdAt: true,
});
// Tracks which users a board owner has shared a board with. The owner stays
// the row in `boards.userId`; recipients get read access via this junction
// table. (boardId, sharedWithUserId) is unique so re-sharing is idempotent.
exports.boardShares = (0, pg_core_1.pgTable)("board_shares", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_66 || (templateObject_66 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    boardId: (0, pg_core_1.varchar)("board_id").notNull().references(function () { return exports.boards.id; }, { onDelete: "cascade" }),
    sharedWithUserId: (0, pg_core_1.varchar)("shared_with_user_id").notNull(),
    sharedByUserId: (0, pg_core_1.varchar)("shared_by_user_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (table) { return [
    (0, pg_core_1.index)("IDX_board_shares_user").on(table.sharedWithUserId),
    (0, pg_core_1.index)("IDX_board_shares_board").on(table.boardId),
    (0, pg_core_1.unique)("UQ_board_shares_board_user").on(table.boardId, table.sharedWithUserId),
]; });
exports.insertBoardShareSchema = (0, drizzle_zod_1.createInsertSchema)(exports.boardShares).omit({
    id: true,
    createdAt: true,
});
// In-app notifications. Currently only used for "board shared with you" but
// kept generic (type + jsonb data) so future notification kinds can reuse the
// same table without another migration.
exports.notifications = (0, pg_core_1.pgTable)("notifications", {
    id: (0, pg_core_1.varchar)("id")
        .primaryKey()
        .default((0, drizzle_orm_1.sql)(templateObject_67 || (templateObject_67 = __makeTemplateObject(["gen_random_uuid()"], ["gen_random_uuid()"])))),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    type: (0, pg_core_1.varchar)("type").notNull(),
    data: (0, pg_core_1.jsonb)("data").notNull().default((0, drizzle_orm_1.sql)(templateObject_68 || (templateObject_68 = __makeTemplateObject(["'{}'::jsonb"], ["'{}'::jsonb"])))),
    isRead: (0, pg_core_1.boolean)("is_read").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
}, function (table) { return [
    (0, pg_core_1.index)("IDX_notifications_user").on(table.userId),
    (0, pg_core_1.index)("IDX_notifications_user_unread").on(table.userId, table.isRead),
]; });
exports.insertNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.notifications).omit({
    id: true,
    createdAt: true,
    isRead: true,
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29, templateObject_30, templateObject_31, templateObject_32, templateObject_33, templateObject_34, templateObject_35, templateObject_36, templateObject_37, templateObject_38, templateObject_39, templateObject_40, templateObject_41, templateObject_42, templateObject_43, templateObject_44, templateObject_45, templateObject_46, templateObject_47, templateObject_48, templateObject_49, templateObject_50, templateObject_51, templateObject_52, templateObject_53, templateObject_54, templateObject_55, templateObject_56, templateObject_57, templateObject_58, templateObject_59, templateObject_60, templateObject_61, templateObject_62, templateObject_63, templateObject_64, templateObject_65, templateObject_66, templateObject_67, templateObject_68;
