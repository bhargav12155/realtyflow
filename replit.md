# iMakePage - AI-Powered Real Estate Marketing Platform

## Overview
iMakePage (imakepage.com) is an AI-powered real estate marketing platform for Omaha-area agents, built by My Golden Brick (mygoldenbrick.com). It provides AI content generation, multi-platform social media management, video studio with talking avatars, property tour videos, and SEO analytics to enhance agents' market reach and engagement. The platform unifies content creation, social media posting, property management, and performance analytics into a single dashboard. Also known internally as "AI-SEO" or "RealtyFlow".

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, and Vite, utilizing shadcn/ui components, Radix primitives, and Tailwind CSS for a neutral, accessible design. Wouter handles routing, and TanStack Query manages state and API caching. Real-time updates are enabled via WebSockets.

### Technical Implementations
The backend uses Express.js with TypeScript (ESM) and Replit's OpenID Connect for authentication with session storage. It features a RESTful API with middleware for user context and authorization, and WebSocket support for real-time communication. Secure auto-login within iframes is implemented using PostMessage API and URL parameters. An OAuth 2.0 system with PKCE (S256) supports social media integrations, with database-backed PKCE storage.

### Feature Specifications
- **AI Content Generator Wizard**: A 4-step wizard for AI-powered content creation (social posts, blog articles, property features, market updates) with state management and progress indication.
- **AI Integration**: Leverages OpenAI's GPT-5 for localized real estate marketing content.
- **Avatar Support & Gestures**: Supports various avatar types for video generation (public, talking photo, custom photo avatars with gestures), including a training workflow and streaming avatars.
- **Video Avatar Voice Extraction**: Automatically extracts audio from training footage using ffmpeg for use with HeyGen, allowing avatars to speak in the user's own voice.
- **Engagement Tracking & Analytics**: Monitors anonymous user behavior on agent websites to track interactions and generate leads based on engagement scores using a client-side JavaScript library.
- **Video Studio**: A 3-step video creation flow consolidating HeyGen services, allowing users to create talking photo avatars, generate AI scripts, and produce videos with multi-mode voice input (TTS, browser recording, audio upload).
- **QR Code Mobile Upload**: Simplifies video avatar creation by allowing users to upload training and consent videos from mobile devices via QR code scanning.
- **Event Calendar**: Tracks local events from multiple sources (iCal, Google Calendar), generating AI-powered, scheduled social media posts.
- **Auto-Fill Monthly Content Calendar**: One-click AI generation of a full month of social media posts. Users select platforms (Facebook, Instagram, LinkedIn, X, TikTok, YouTube), posts-per-week frequency, and content categories. AI generates unique varied content for each post slot. Calendar shows all posts with platform icons and status badges. Click any post to review/edit, approve individually or bulk "Approve All". Approved posts auto-publish at scheduled times via the post scheduler.
- **BHHS Compliance System**: Integrates compliance checks for all social media and video content to meet brokerage requirements, including automatic detection of ad content, branding enforcement, prohibited term detection, and one-click auto-fix.
- **User-Configurable AI Engine Preferences**: Allows users to select their preferred AI provider (OpenAI, Anthropic, Google) and optionally provide their own API keys, which are encrypted server-side.
- **Kling AI Motion Video Generation**: Transforms static avatar images into dynamic motion videos using Kling AI's image-to-video API, offering HeyGen-style motion templates, configurable duration, and real-time progress tracking.
- **Dual Voice Provider System**: Supports ElevenLabs and Kling for voice generation, with a toggle for selection. ElevenLabs uses high-quality Rachel voice; Kling provides built-in text-to-video with lip-sync.
- **Hover-to-Play Motion Preview**: Displays a "Motion" badge and auto-plays motion videos on hover for motion-enabled avatars in the avatar grid.
- **Save Motion Button**: Allows downloading motion videos before voice generation to prevent work loss.
- **Multi-Mode Voice Input System for Motion Avatars**: Provides TTS (ElevenLabs/Kling), browser recording, and audio file upload options for adding voice to motion avatars, bypassing Kling TTS issues and offering flexibility.
- **Background Video Generation**: Allows users to start video generation and navigate away. A background worker polls HeyGen for status updates, and WebSocket notifications alert users when videos are complete. Users can toggle between foreground (wait for video) and background (continue working) modes.
- **LinkedIn Image Upload**: Full LinkedIn media support with 3-step image upload process (register → upload → post), enabling property photos to attach correctly to LinkedIn posts.
- **Twilio AI SMS/Voice Chatbot**: Multi-tenant AI-powered chatbot for lead capture and qualification via SMS and voice. Each subscriber gets their own Twilio phone number. Features include: AI-powered responses using OpenAI, configurable AI personality (friendly/professional/casual), business hours with after-hours messaging, lead capture (name, email, interest), voice IVR with speech recognition, conversation history tracking, and optional live agent transfer. Webhooks validate Twilio signatures for security.
- **TikTok Video Workflow**: TikTok posts require video content (no text-only posts). The social media manager and scheduled posts editor enforce video presence at multiple levels: schedule button requires video URL, edit dialog blocks saving without video, and backend scheduler validates video at publish time. Video can be uploaded via file upload or URL paste. Video URL is stored in both `metadata.videoUrl` and `metadata.imageUrl` for TikTok posts. Upload endpoint: `POST /api/scheduled-posts/upload-media`.
- **HeyGen Avatar Generation Flow (External Service Proxy)**: All avatar style/look generation is handled by an external service (imakevideo studio, AWS Elastic Beanstalk at `gb-video-studio-env-2.eba-h2pwbutp.us-east-2.elasticbeanstalk.com`), proxied through our backend. This avoids calling HeyGen APIs directly (which return 503 "Backend action does not exist" errors). The external service wraps all HeyGen calls reliably.
  - **External Service API Endpoints** (base URL: `/api/heygen`):
    - `POST /api/heygen/assets` - Upload photo/audio file (multipart: `file`, `kind` = "photo"|"audio"). Returns `{image_key}` or `{audio_key}`.
    - `POST /api/heygen/avatars/create-group` - Create avatar group from uploaded image (JSON: `{image_key}`). Returns `{group_id}`.
    - `POST /api/heygen/avatars/{groupId}/train` - Start avatar training for a group. Returns training status.
    - `GET /api/heygen/avatars/train/status/{groupId}` - Check training status. Returns `{status, trained}`. Status values: pending/processing/ready/failed/completed/error. Poll every 10s until `trained=true`.
    - `POST /api/heygen/avatars/{groupId}/generate-look` - Generate a new look/style for a TRAINED group (JSON: `{prompt, orientation, pose, style}`). Orientation: square/horizontal/vertical. Pose: half_body/close_up/full_body. Style: Realistic/Cinematic/Pixar/Vintage.
    - `POST /api/heygen/avatars/generate-ai` - Generate AI avatar.
    - `GET /api/heygen/avatars/generation/{id}` - Check AI generation status.
    - `GET /api/heygen/voices` - List available TTS voices.
    - `POST /api/heygen/scripts/auto` - Auto-generate script (JSON: `{prompt, tone, duration, maxWords}`).
    - `POST /api/heygen/videos` - Create talking avatar video.
    - `GET /api/avatars/library` - Get avatar library.
    - `POST /api/avatars/{id}/motion` - Add motion to avatar.
    - `GET /api/videos/history` - Video generation history.
  - **Our Proxy Endpoints** (iMakePage backend → external service):
    - `POST /api/photo-avatars/create-with-looks` - Upload photo, auto-creates group, trains, generates 4 looks in background. Multipart form: `image` file, optional `name`, `prompt`, `orientation`, `pose`, `style`. Returns `{group_id, status: "processing"}` immediately. Background flow: upload → create-group → wait 30s → train → poll training → generate 4 looks. Total time: ~6-8 minutes.
    - `POST /api/photo-avatars/generate-video-from-image` - Upload photo + script, auto-creates group, trains, generates video in background. Multipart form: `image` file, `script`, optional `name`, `voice_id`. Returns `{group_id, status: "processing"}`. Total time: ~8-13 minutes.
    - `GET /api/photo-avatars/status/:groupId` - Proxies to external service training status. Returns `{status, trained, workflow_status: {percent_complete}}`.
    - `GET /api/photo-avatars/video-status/:videoId` - Returns `{status, is_complete, video_url, thumbnail_url, duration, percent_complete}`.
    - `POST /api/photo-avatars/groups/:groupId/proxy-generate-look` - Proxies single look generation to external service. JSON body: `{prompt, orientation, pose, style}`. Used by "Change Style/Outfit" UI actions.
    - `GET /api/photo-avatars/proxy/generation-status/:generationId` - Proxies look generation status check.
    - `POST /api/photo-avatars/groups/:groupId/generate-looks` - Internal endpoint using HeyGenPhotoAvatarService (direct HeyGen API, may 503). Prefer `proxy-generate-look` instead.
  - **UI Entry Points**: (1) "Generate AI Enhanced Look" gold banner on Photo Avatars page opens a dialog with upload/existing avatar toggle, prompt, orientation/pose/style options → calls `create-with-looks`. (2) "Change Style/Outfit" menu on individual photos → calls `proxy-generate-look` through external service. (3) All look generation goes through external service proxy to avoid HeyGen 503 errors.
  - **Common Voice IDs**: `92c93dc0dff2428ab0bea258ba68f173` (Professional Male - Confident), `f577da968446491289b53bceb77e5092` (Professional Male - Warm), `73c0b6a2e29d4d38aca41454bf58c955` (Professional Female - Clear), `1c7c897eeb2d4b5fb17d3c6c70250b24` (Professional Female - Friendly, default), `119caed25533477ba63822d5d1552d25` (Neutral - Balanced).
  - **Config**: External service URL via `PHOTO_AVATAR_SERVICE_URL` env var (defaults to `http://gb-video-studio-env-2.eba-h2pwbutp.us-east-2.elasticbeanstalk.com`). No auth required on external service. File size limit: 50MB. Supported formats: JPEG, PNG, WebP, GIF.
- **Property Tour Studio**: 4-step wizard for creating professional property tour videos. Features: up to 6 photos per room organized on a visual floor plan, camera position markers showing where each photo was taken, room connection/door markers defining how spaces connect (e.g., hallway→kitchen), VEO 3.1 generates two 8-second clips per room combined into smooth 16-second segments with spatial camera motion based on positions. Per-room video generation allows sharing individual room clips on social media. Users can select specific rooms and combine them into a custom full house tour with crossfade transitions. Photo reordering uses button controls (up/down arrows) instead of drag-and-drop to avoid scroll conflicts. Room connections feed transition hints into VEO prompts for smoother room-to-room camera movement.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM, supporting main users (agents) and public users (clients) with multi-tenancy.
- **Storage Architecture**: Dual-storage strategy combining HeyGen API storage with AWS S3 for backup and archival of voice recordings, avatar images, and generated videos.
- **Real-time Communication**: WebSockets provide live updates for content generation status, social media posting, lead notifications, and activity feeds.
- **Photo Avatar Privacy**: Photo avatar groups are scoped to individual users via `userId` column. All photo avatar endpoints use database-first filtering to ensure users only see their own avatar groups. The `avatars` table stores individual avatar looks with user ownership, while `photoAvatars` table stores training photos linked to groups.

## External Dependencies

- **Database**: PostgreSQL (Neon serverless hosting)
- **AI Services**: OpenAI GPT-5 API, Kling AI, ElevenLabs, Gemini VEO 3.1
- **Authentication**: Replit OpenID Connect
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth (with placeholders for Facebook, Instagram, LinkedIn, TikTok)
- **UI Components**: Radix UI, Tailwind CSS
- **Real-time Features**: Native WebSocket
- **SEO Tools**: Google PageSpeed Insights API
- **Development Tools**: Vite, TypeScript, Drizzle Kit
- **Video Generation**: HeyGen API
- **File Storage**: AWS S3
- **SMS/Voice**: Twilio API