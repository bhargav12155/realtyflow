# iMakePage - AI-Powered Real Estate Marketing Platform

## Overview
iMakePage (imakepage.com) is an AI-powered real estate marketing platform for Omaha-area agents, built by My Golden Brick (mygoldenbrick.com). It provides AI content generation, multi-platform social media management, video studio with talking avatars, property tour videos, and SEO analytics. The platform unifies content creation, social media posting, property management, and performance analytics into a single dashboard.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, and Vite, utilizing shadcn/ui components, Radix primitives, and Tailwind CSS. Wouter handles routing, TanStack Query manages state and API caching. WebSockets enable real-time updates.

### Technical Implementations
The backend uses Express.js with TypeScript (ESM), Replit OpenID Connect for auth, RESTful API with middleware, and WebSocket support. OAuth 2.0 with PKCE (S256) supports social media integrations. Key features: AI Content Generator Wizard, OpenAI GPT-5 integration, avatar support with gestures and voice extraction (ffmpeg + HeyGen), engagement tracking, Video Studio, QR code mobile upload, event calendar, auto-fill monthly content calendar, BHHS Compliance System, user-configurable AI engine preferences, Kling AI motion video, dual voice provider (ElevenLabs/Kling), background video generation with WebSocket notifications, LinkedIn image uploads, Twilio AI SMS/Voice Chatbot, TikTok video workflow enforcement, SJinn AI multi-model video generation (Auto/Kling/Seedance, Veo3, Sora2).

**SJinn AI Integration**: `server/services/sjinn.ts` — two-step API: `createVideoTask(prompt, model)` → `{chatId, projectId}`, then poll `getTaskStatus(chatId)` every 15s. Models: `auto` (no template), `veo3` (template `9b371ec6...`), `sora2` (template `de733710...`). Auth: `SJINN_API_KEY` env secret. Routes: `POST /api/sjinn/create-video`, `GET /api/sjinn/status/:chatId`. UI: "AI Video Platform" dropdown in `avatar-iv-studio.tsx` (Step 2), "AI Video Engine" dropdown in `video-generator.tsx`. HeyGen remains the default; SJinn options route to SJinn API with polling UI. Automatic Post Scheduler (`server/services/post-scheduler.ts`) runs every 60 seconds and publishes due posts to all platforms: Twitter/X, Facebook, Instagram, LinkedIn, TikTok, YouTube, and WhatsApp. Dashboard includes Recent Post Activity widget showing last 10 published/failed posts with platform icons, timestamps, and error details.

**WhatsApp Bulk Queue System**: When bulk sends exceed Meta's daily messaging limit, overflow contacts are auto-queued in `whatsapp_bulk_queues` table. Background scheduler (`server/services/bulk-queue-scheduler.ts`) checks every 60 seconds, processes active queues when `nextBatchAt` is reached (24-hour rolling window), sends in batches of 10 with rate limit handling, and marks complete when all remaining numbers are sent. API endpoints: `GET /api/whatsapp/bulk-queues` (list user's queues), `GET/POST /api/whatsapp/bulk-queues/:id` (get/pause/resume/cancel with ownership checks). Frontend shows queue status dashboard with progress bars, sent/remaining/quota/next-batch stats, and pause/resume/cancel buttons. WebSocket events: `whatsapp_queue_progress`, `whatsapp_queue_batch_start`, `whatsapp_queue_batch_complete`, `whatsapp_queue_complete`.

**Multi-Vertical Business Type System**: Platform supports 6 business types (Real Estate, Restaurant, Home Services, Retail, Professional Services, General Business). Business type switcher dropdown in sidebar saves preference to user's company profile. Business terminology adapts platform-wide (properties/menu items/services/products). Catalog/Menu Items page (`/menu-items`) provides full CRUD for restaurant menu items, services, products depending on active business type. Database tables: `menu_items` (catalog items with pricing, dietary tags, status), `business_locations` (multi-location support). Business context: `client/src/lib/businessContext.tsx`.

**Business-Type Feature Flags (centralized)**: `BusinessTerminology.features` in `businessContext.tsx` defines per-type capabilities: `mlsSearch`, `propertyTours`, `aiContentGenerator`, `complianceCheck`, `neighborhoodFocus`, `dietaryTags`, `ingredients`. Components use `terms.features.X` instead of hardcoded `businessType === "real_estate"`. Dashboard view gating uses `VIEW_FEATURE_GATE` map in `dashboard.tsx` to redirect restricted views. Switching business type forces component remount via `key={businessType}` on the content wrapper, ensuring clean state (no stale form data or wizard steps). Sidebar filters both top-level items and sub-items using `showOnlyFor` arrays.

**Business-Type Adaptations (fully implemented)**: `ai-content-generator.tsx` — content type card "Property Feature" dynamically relabels via `terms.featureLabel` (e.g., "Menu Item Feature", "Service Feature"); topic placeholder uses `terms.topicPlaceholder`; "Select a Property" label uses `terms.item`; "Neighborhood Focus" relabels to "Area / Location" for non-real-estate. `social-media-manager.tsx` — main post textarea placeholder adapts using `terms.topicPlaceholder`. `content-calendar.tsx` — auto-fill AI prompt uses `terms.role` and `terms.dashboardSubtitle`. `scheduled-posts-manager.tsx` — preview subtitle and feature card label use `terms.role` / `terms.featureLabel`. `ai-assistant-dialog.tsx` — Video panel labels adapt per `VIDEO_PANEL_BY_BUSINESS` config.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM, supporting multi-tenancy.
- **Storage Architecture**: Dual-storage using HeyGen API and AWS S3 for media.
- **Real-time Communication**: WebSockets for live updates.
- **Photo Avatar Privacy**: Photo avatar data is user-scoped.

## HeyGen Avatar Generation Flow (External Service Proxy)

All avatar style/look generation is handled by an external service (imakevideo studio, AWS Elastic Beanstalk at `gb-video-studio-env-2.eba-h2pwbutp.us-east-2.elasticbeanstalk.com`), proxied through our backend. This avoids calling HeyGen APIs directly (which return 503 errors). Config: `PHOTO_AVATAR_SERVICE_URL` env var. No auth required on external service. File size limit: 50MB. Supported formats: JPEG, PNG, WebP, GIF.

### Complete Automated Workflow Timeline

- t=0s: Upload photo to HeyGen CDN, Create Avatar Group, Return group_id IMMEDIATELY (~2s)
- t=0-30s: HeyGen processes uploaded image (background, user can navigate away)
- t=30s: Backend starts avatar training via POST /photo_avatar/train
- t=30s-5m: Poll training status every 10s until status="ready"/"completed"
- t=5m: Training complete, generate 4 looks in parallel (4 POST requests)
- t=5-8m: Poll each look generation every 10s until status="success"
- t=8m: All 4 looks saved to database, 100% complete, ready for video generation

### Client Polling
- Frontend polls `GET /api/photo-avatars/status/{groupId}` every 30s
- Polls `GET /api/photo-avatars/active-jobs` every 10s (active) or 30s (idle) for real-time status banners

### External Service API Endpoints (base: PHOTO_AVATAR_SERVICE_URL)
- `POST /api/heygen/assets` - Upload photo/audio (multipart: `file`, `kind`="image"|"audio"). Returns `{image_key}`
- `POST /api/heygen/avatars/create-group` - Create avatar group (JSON: `{image_key}`). Returns `{group_id}`
- `POST /api/heygen/avatars/{groupId}/train` - Start training
- `GET /api/heygen/avatars/train/status/{groupId}` - Check training. Returns `{status, trained}`. Poll every 10s until `trained=true`
- `POST /api/heygen/avatars/{groupId}/generate-look` - Generate look for TRAINED group (JSON: `{prompt, orientation, pose, style}`). Returns `{generation_id}`
- `GET /api/heygen/avatars/generation/{id}` - Check generation status. Returns `{status, image_url, image_url_list}`. "processing" then "success"/"failed"
- `POST /api/heygen/videos` - Create talking avatar video. Payload: `{image_key, script, voice_id, video_orientation}`. Returns `{video_id}`
- `GET /api/heygen/voices` - List available TTS voices
- `POST /api/heygen/scripts/auto` - Auto-generate script (JSON: `{prompt, tone, duration, maxWords}`)
- `GET /api/avatars/library` - Get avatar library (trained + looks combined)
- `POST /api/avatars/{id}/motion` - Add motion to avatar
- `GET /api/videos/history` - Video generation history

### Our Proxy Endpoints (iMakePage backend -> external service)
- `POST /api/photo-avatars/create-with-looks` - Main entry. Upload photo, auto-creates group, trains, generates 4 looks in background. Multipart: `image`, optional `name`, `prompt`, `orientation`, `pose`, `style`. Returns `{group_id, status: "processing"}` immediately. Background: upload, create-group, wait 30s, train, poll (10s, 30min max), generate 4 looks, poll each, save to `look_generation_jobs`. ~6-8 min total.
- `POST /api/photo-avatars/generate-video-from-image` - Upload photo + script, trains, generates video in background. Multipart: `image`, `script`, optional `name`, `voice_id`. Returns `{group_id, status: "processing"}`. ~8-13 min total.
- `GET /api/photo-avatars/status/:groupId` - Training status. Returns `{status, trained, workflow_status: {percent_complete}}`
- `GET /api/photo-avatars/video-status/:videoId` - Video status. Returns `{status, is_complete, video_url, thumbnail_url, duration, percent_complete}`
- `GET /api/photo-avatars/active-jobs` - In-progress look generation jobs for current user. Adaptive polling.
- `POST /api/photo-avatars/groups/:groupId/proxy-generate-look` - Single look generation via external service. JSON: `{prompt, orientation, pose, style}`. Used by "Change Style/Outfit".
- `GET /api/photo-avatars/proxy/generation-status/:generationId` - Look generation status check
- `POST /api/avatar-iv/use-look-image` - Bridge: downloads HeyGen look URL, re-uploads for `image_key`, saves to photo library. Returns `{imageKey, imageUrl}`. Enables "Use This Look for Video" button.

### Video Generation Options
- **Option A - Avatar IV**: `POST /api/avatar-iv/generate` with `{imageKey, script, voiceId}`. Quick one-off videos.
- **Option B - From Generated Look**: "Use This Look for Video" in gallery -> `/api/avatar-iv/use-look-image` -> script step -> Avatar IV video.
- **Option C - Direct Upload**: `POST /api/photo-avatars/generate-video-from-image` with image + script. Full background flow (~8-13 min).

### Database Tables
- `lookGenerationJobs` - Tracks look generation: userId, groupId, heygenGenerationId, lookLabel (executive/friendly-agent/outdoor-guide/modern-professional), lookName, prompt, status, resultImageUrl, errorMessage, completedAt. Each image variation gets its own row.
- `photoAvatars` - Processed photos: groupId, photoUrl, heygenPhotoId (image_key), poseType, processingStatus
- `photoAvatarGroups` - Avatar groups: heygenGroupId, userId, name, trainingStatus, imageHash

### Look Generation Prompts (4 parallel, face-preserving)
- Executive: "Professional executive in a navy business suit, confident and approachable, maintain the exact same face"
- Friendly Agent: "Friendly real estate agent in smart casual blazer, warm and welcoming smile"
- Outdoor Guide: "Outdoor property tour guide in clean casual attire, natural setting"
- Modern Professional: "Modern professional in contemporary business wear, sleek and polished"

### UI Entry Points
1. "Generate AI Enhanced Look" gold banner -> upload/existing avatar, prompt, options -> calls `create-with-looks`
2. "Change Style/Outfit" menu on photos -> calls `proxy-generate-look`
3. Gallery preview: "Use This Look for Video" gold button -> converts look to imageKey -> step 2 (Write Script)
4. Real-time amber banner for in-progress, green for completed jobs

### Common Voice IDs
- `92c93dc0dff2428ab0bea258ba68f173` - Professional Male - Confident
- `f577da968446491289b53bceb77e5092` - Professional Male - Warm
- `73c0b6a2e29d4d38aca41454bf58c955` - Professional Female - Clear
- `1c7c897eeb2d4b5fb17d3c6c70250b24` - Professional Female - Friendly (default)
- `119caed25533477ba63822d5d1552d25` - Neutral - Balanced

### Known Gaps vs Reference App
Features the reference imakevideo studio has that we have not implemented yet:
- `POST /api/heygen/videos/motion` - Motion video with groupId + lookId + motionId. We use Kling AI for motion instead.
- `GET /api/avatars/library` - Unified avatar library combining trained avatars + generated looks. We load looks separately.
- `GET /api/heygen/motions` - List available HeyGen motion styles.
- Richer status: `workflow_status.percent_complete` (0-100%), `motion.enabled`, `ready_for_video`/`ready_for_looks`/`ready_for_motion` flags.
- `gallery_items` table with `upsertGalleryItemBySource()` for deduplication. We use `lookGenerationJobs` with separate inserts.

## Property Tour Studio
4-step wizard for property tour videos: up to 6 photos per room on visual floor plan, camera position markers, room connections, VEO 3.1 generates 16-second segments with spatial camera motion. Per-room video generation for social sharing.

## External Dependencies
- **Database**: PostgreSQL (Neon)
- **AI Services**: OpenAI GPT-5, Kling AI, ElevenLabs, Gemini VEO 3.1
- **Authentication**: Replit OpenID Connect
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth
- **UI Components**: Radix UI, Tailwind CSS
- **Video Generation**: HeyGen API (via external proxy)
- **File Storage**: AWS S3
- **SMS/Voice**: Twilio API
