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
- **HeyGen Avatar Generation Flow (External Service Proxy)**: All avatar style/look generation is handled by an external service (AWS Elastic Beanstalk at `gb-video-studio-env-2.eba-h2pwbutp.us-east-2.elasticbeanstalk.com`), proxied through our backend. This avoids calling HeyGen APIs directly (which can return 503 errors). The flow has two main scenarios:
  - **Scenario 1 - Create Avatar with Looks**: Upload a photo → external service handles training + 4 look generation automatically. Endpoint: `POST /api/photo-avatars/create-with-looks` (multipart form: `image` file, optional `name`, `prompt`, `orientation` [square/horizontal/vertical], `pose` [half_body/close_up/full_body], `style` [Realistic/Cinematic/Pixar/Vintage]). Returns immediately with `{group_id, status: "processing", message, check_status_url}`. Background processing: ~6-8 minutes total (image processing 30s → training 2-5 min → look generation 1-2 min).
  - **Scenario 2 - Generate Video from Image**: Upload a photo + script → external service creates avatar and generates a talking video. Endpoint: `POST /api/photo-avatars/generate-video-from-image` (multipart form: `image` file, `script` text, optional `name`, `voice_id`). Returns immediately with `{group_id, status: "processing"}`. Background processing: ~8-13 minutes total.
  - **Status Polling**: `GET /api/photo-avatars/status/:groupId` returns training status, looks list, motion info, and `workflow_status.percent_complete` (0-100%). Poll every 30 seconds. Status codes: training (`pending`/`processing`/`ready`/`failed`), workflow percent (0-40% training, 40-70% looks, 70-100% motion).
  - **Video Status**: `GET /api/photo-avatars/video-status/:videoId` returns `{status, is_complete, video_url, thumbnail_url, duration, percent_complete}`.
  - **UI Entry Points**: (1) "Generate AI Enhanced Look" gold banner on Photo Avatars page opens a dialog with upload/existing avatar toggle, prompt, orientation/pose/style options. (2) "Change Style" menu on individual photos in the avatar studio sends the photo to `create-with-looks` directly - no manual preparation step needed. (3) "Generate 4 Looks" button on trained avatar groups uses the internal `generate-looks` endpoint.
  - **Common Voice IDs**: `92c93dc0dff2428ab0bea258ba68f173` (Professional Male - Confident), `f577da968446491289b53bceb77e5092` (Professional Male - Warm), `73c0b6a2e29d4d38aca41454bf58c955` (Professional Female - Clear), `1c7c897eeb2d4b5fb17d3c6c70250b24` (Professional Female - Friendly, default), `119caed25533477ba63822d5d1552d25` (Neutral - Balanced).
  - **Config**: External service URL configured via `PHOTO_AVATAR_SERVICE_URL` env var (defaults to Elastic Beanstalk). Auth currently disabled on external service. File size limit: 50MB. Supported formats: JPEG, PNG, WebP, GIF.
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