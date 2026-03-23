# iMakePage - AI-Powered Real Estate Marketing Platform

## Overview
iMakePage (imakepage.com) is an AI-powered real estate marketing platform designed for Omaha-area real estate agents. Developed by My Golden Brick (mygoldenbrick.com), this platform aims to centralize and streamline various marketing activities. Its core purpose is to empower real estate professionals with advanced AI capabilities for content generation, multi-platform social media management, and sophisticated video production. Key offerings include an AI content generation wizard, a video studio with talking avatars and property tour video creation, and comprehensive SEO analytics. The platform integrates content creation, social media scheduling, property listing management, and performance analytics into a unified dashboard, enhancing efficiency and market reach for agents.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built using React, TypeScript, and Vite. It leverages `shadcn/ui` components, Radix primitives, and Tailwind CSS for a modern and responsive user experience. Routing is managed by Wouter, and `TanStack Query` handles state management and API caching. WebSockets are integrated for real-time updates across the platform.

### Technical Implementations
The backend is developed with Express.js and TypeScript (ESM). Authentication is handled via Replit OpenID Connect. The system utilizes a RESTful API architecture with robust middleware and WebSocket support for dynamic interactions. OAuth 2.0 with PKCE (S256) is implemented for secure social media integrations.

Key features include:
- **AI Content Generator Wizard**: Integrates Gemini 2.5 Flash for generating diverse marketing content.
- **AI Image Generation**: The AI chat assistant detects image generation requests and generates images using Gemini 2.5 Flash Image (`gemini-2.5-flash-image`) via `@google/genai` SDK with `responseModalities: ["TEXT", "IMAGE"]`. Images are stored in object storage with base64 data URI fallback. Detection uses regex pattern matching on user messages. Images display inline in chat with download and open-in-new-tab links.
- **Video Studio**: Supports avatar generation with gestures and voice extraction (using `ffmpeg` and HeyGen), and advanced video generation capabilities through Sora 2 (OpenAI via sora2api.ai) and Kling AI for motion videos.
- **Social Media Management**: Features an automatic post scheduler for Twitter/X, Facebook, Instagram, LinkedIn, TikTok, YouTube, and WhatsApp, along with comprehensive dashboards for tracking post activity.
- **Multi-Account WhatsApp**: Supports multiple WhatsApp phone numbers per user via `accounts` jsonb column in `whatsapp_settings`. API endpoints: GET/POST `/api/whatsapp/accounts`, DELETE `/api/whatsapp/accounts/:phoneNumberId`, POST `/api/whatsapp/accounts/switch`. The active account's `phoneNumberId` is stored in the main settings row. Account switcher dropdown appears in the WhatsApp Message section and Analytics section of Social Media Manager. Full account management (add/switch/delete) available in WhatsApp Settings page. Saving settings auto-syncs the current phone number into the accounts array. **All WhatsApp credentials are strictly user-scoped** — no cross-user fallback, no shared environment variable tokens. Token backfill only propagates between accounts on the same WABA within the same user.
- **WhatsApp Bulk Queue System**: Sends until Meta quota limit is reached (130429/131048 errors) rather than pre-slicing to a daily limit. Tracks every sent, failed, and remaining phone number in the `whatsapp_bulk_queues` table (`sentNumbers`, `failedNumbers`, `remainingNumbers` arrays). Ecosystem-blocked (131049/131056) contacts are re-queued. Safety valve: if ecosystem-block ratio exceeds 50% after 50+ attempts, batch stops. Quota detection: if 50%+ of a batch returns quota errors or 10 consecutive quota errors, sending stops and remaining numbers are queued. Template-paused detection (132015/132016/132001): auto-pauses queue when template is paused by Meta. Excel downloads via GET `/api/whatsapp/bulk-queues/:id/download?type=all|sent|remaining|failed` (exceljs). "Send Next Batch Now" button (POST `/api/whatsapp/bulk-queues/:id/send-now`) triggers immediate processing. **Bulk Send History**: Collapsible section showing all past/current queues with date, status, sent/failed/remaining counts, progress bars, and download buttons (Full Report/Sent/Failed/Remaining). Always-visible action bar with Send Next Batch Now, Pause/Resume Queue, and Dismiss buttons.
- **Multi-Vertical Business Type System**: The platform supports six business types (Real Estate, Restaurant, Home Services, Retail, Professional Services, General Business), dynamically adapting terminology, feature sets, and UI elements based on the selected business type. This includes adaptive AI prompts, content labels, and feature visibility. Industry-specific content preloading is defined in `shared/industryContent.ts` with curated hashtag sets (15 per industry), content idea starters (per post type), and suggested topics. The Post Composer shows clickable hashtag chips, the Social Media Manager shows "Quick Start" template starters under each post type, and the AI Content Generator pre-selects content style and topic based on the active business type.
- **Property Tour Studio**: A four-step wizard allows agents to create detailed property tour videos, integrating photos, floor plans, and camera positioning to generate engaging visual content.
- **WhatsApp Analytics Dashboard**: `WhatsAppAnalyticsSection` component fetches real-time metrics from Meta Graph API v25.0 via `GET /api/whatsapp/analytics?days=7|14|30`. Uses official Meta Analytics endpoints per docs: `analytics` (messaging sent/delivered), `conversation_analytics` (conversations by category: MARKETING/UTILITY/SERVICE/AUTH with cost), `pricing_analytics` (pricing breakdown by category with volume tiers), `template_analytics` (per-template sent/delivered/read/clicked/cost). Also fetches phone quality rating (GREEN/YELLOW/RED), messaging limit tier. Template insights auto-enabled via `POST /<WABA_ID>?is_enabled_for_insights=true`. Backend methods in `server/services/whatsapp.ts`: `getTemplateAnalytics`, `getMessagingAnalytics`, `getConversationAnalytics`, `getPricingAnalytics`, `getPhoneNumberAnalytics`, `getAccountInfo`, `enableTemplateInsights`. Error handling uses comprehensive Meta error codes (131049/131056=ecosystem, 131050=user opted out, 130429=rate limit, 131057/131016/133004=retry, 368/130497/131031=permanent block). Bulk send results persisted to `whatsapp_bulk_send_results` DB table, survives server restarts, with dismiss endpoint `POST /api/whatsapp/bulk-send-status/dismiss`.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM is used for data persistence, supporting multi-tenancy.
- **Storage Architecture**: `UnifiedUploadService` (`server/services/unifiedUpload.ts`) wraps S3 and Replit Object Storage with automatic fallback. When AWS S3 credentials are valid, S3 is used as primary storage. If S3 credentials are missing or invalid (e.g., expired keys), uploads automatically fall back to Replit Object Storage via the `/public-objects/` proxy route. HeyGen API is used for specific media processing.
- **Real-time Communication**: WebSockets facilitate live updates and interactive features throughout the platform.
- **Photo Avatar Privacy**: Photo avatar data is strictly user-scoped to ensure privacy and data security.

## External Dependencies
- **Database**: PostgreSQL (Neon)
- **AI Services**: Gemini 2.5 Flash (text), Google Imagen 3 (images), Kling AI, ElevenLabs, Gemini VEO 3.1, Sora 2 (OpenAI via sora2api.ai)
- **Authentication**: Replit OpenID Connect
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth, Meta Graph API (for Facebook, Instagram, WhatsApp)
- **UI Components**: Radix UI, Tailwind CSS
- **Video Generation**: HeyGen API (via external proxy service)
- **File Storage**: AWS S3 (primary) with Replit Object Storage (automatic fallback)
- **SMS/Voice**: Twilio API