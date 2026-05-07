# iMakePage - AI-Powered Real Estate Marketing Platform

## Overview
iMakePage is an AI-powered real estate marketing platform that centralizes and streamlines marketing activities for real estate agents. It leverages advanced AI for content generation, multi-platform social media management, and sophisticated video production. The platform integrates content creation, social media scheduling, property listing management, and performance analytics into a unified dashboard, aiming to enhance efficiency and market reach for agents.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with `shadcn/ui`, Radix primitives, and Tailwind CSS for a modern, responsive design. Wouter manages routing, and `TanStack Query` handles state and API caching. WebSockets are integrated for real-time updates.

### Technical Implementations
The backend is built with Express.js and TypeScript (ESM), utilizing Replit OpenID Connect for authentication and a RESTful API with WebSocket support. OAuth 2.0 with PKCE (S256) secures social media integrations.

Key features include:
- **AI Content Generator Wizard**: Integrates Gemini 2.5 Flash for diverse marketing content generation.
- **AI Assistant Providers + General Mode**: Supports chat via GPT-4o, Gemini 2.5 Flash, and Claude Sonnet 4.5. A "General Mode" allows switching between real estate-primed and generic AI assistance. Vision capabilities are supported for all providers, utilizing native vision APIs where available.
- **AI Image Generation**: Detects image generation requests in chat and uses Gemini 2.5 Flash Image.
- **Video Studio**: Facilitates avatar generation (HeyGen) and advanced video generation through Sora 2, Luma Ray 2, Runway Gen-4, and Kling AI.
- **Luma Ray 2 Integration**: Provides text-to-video and image-to-video AI generation with configurable aspect ratios, durations, and seamless looping.
- **Runway Gen-4 Integration**: Offers Text-to-Video, Image-to-Video, and Video-to-Video generation modes with extended duration capabilities via segmenting and stitching.
- **Video Edit/Stitch**: Allows combining multiple user videos with crossfade transitions.
- **Social Media Management**: Features an automatic post scheduler for major social media platforms and activity dashboards.
- **Multi-Account WhatsApp**: Supports multiple WhatsApp phone numbers per user with dedicated settings and an account switcher.
- **WhatsApp Bulk Queue System**: Manages bulk message sending, handling Meta quota limits, re-queuing ecosystem-blocked contacts, and detecting template pauses. Includes a history of bulk sends with detailed reports.
- **Multi-Vertical Business Type System**: Adapts terminology, feature sets, and UI elements for six business types (Real Estate, Restaurant, Home Services, Retail, Professional Services, General Business), including adaptive AI prompts and content suggestions.
- **Property Tour Studio**: A wizard for creating detailed property tour videos.
- **Voice Cloning (HeyGen)**: Records or uploads an audio sample once, persists the row with an explicit `cloning → ready | failed` lifecycle, and reuses the resulting `heygenVoiceId` as TTS narration for any avatar video. My Voices supports inline rename (PATCH `/api/custom-voices/:id`), retry-clone (with 409 duplicate guard), and per-row status badges. Both POST `/api/custom-voices` and POST `/api/custom-voices/:id/retry-clone` respond `202` immediately with the `cloning` row and run the HeyGen upload+clone in the background, broadcasting `voice_clone_complete` / `voice_clone_failed` over WebSocket so the My Voices badges flip live without a manual refresh.
- **WhatsApp Analytics Dashboard**: Provides real-time metrics from Meta Graph API, including messaging, conversation, pricing, and template analytics, along with phone quality rating.
- **Boards**: A collaborative canvas with chat functionality for generating content and managing assets, supporting various video generation providers with validation logic. Each card on the boards home grid has a kebab menu — owners get a red "Delete board" action (DELETE `/api/boards/:id`, owner-scoped, optimistic removal from the `["/api/boards"]` cache with rollback on error) gated behind an AlertDialog confirmation; non-owners get "Leave board" (DELETE `/api/boards/:id/share/me`).
- **Board Chat Resilience (Think → Build)**: The brainstorm cascade in `server/routes/boards-chat.ts` classifies each upstream chat error as `permanent` (401/403/invalid_api_key/unauthorized/not configured) or `transient` (429/503/network). Permanent failures are recorded in an in-process `providerHealth` map for `PROVIDER_DOWN_TTL_MS = 30 min` and skipped on subsequent requests; transient failures are tried again next time. When every provider fails the route returns HTTP 200 with a friendly `reply` ("Our AI assistant is having trouble reaching its providers right now…") and `allFailed: true` instead of leaking raw upstream messages. The response also carries `usedModel`, `requestedModel`, `fallbackUsed`, and a human `notice` ("Claude was unavailable, so I used Gemini instead.") so the UI can show a soft banner without surfacing the underlying API error. `GET /api/boards/chat/health` exposes `{healthy, unhealthy, default}` and the board-detail page uses it to set the initial Think model to the first healthy provider unless the user has already manually picked one. The Build-mode image picker now lists `gemini-image` before `openai-image`, and `dispatchImage` silently falls back to gemini-image when `OPENAI_API_KEY` is missing. Test seam: `__resetChatProviderHealthForTests()` is exported from `server/routes/boards-chat.ts`.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM for data persistence and multi-tenancy.
- **Storage Architecture**: AWS S3 as primary storage with automatic fallback to Replit Object Storage via `UnifiedUploadService`.
- **Real-time Communication**: WebSockets ensure live updates.
- **Photo Avatar Privacy**: Photo avatar data is strictly user-scoped.
- **Auto Image Processing**: `autoProcessImageMiddleware` automatically resizes and compresses image uploads.
- **Post-merge schema sync**: `scripts/post-merge.sh` runs `npm run db:push -- --force` directly and fails loud on any drift. The historical `engagement_leads` column drift was resolved, and the `public_users (agent_slug, email)` composite uniqueness is declared as a `uniqueIndex` (not a `unique` constraint) to avoid a drizzle-kit 0.31.x diff quirk that re-proposed composite unique constraints on every push.
- **HeyGen shape-drift retention**: `recordHeygenShapeDriftIncident` writes through Drizzle into the Postgres `heygen_shape_drift_incidents` table (verified via the `pg` MemStorage method, no in-memory shadow), and a daily background sweep (`startShapeDriftRetentionJob` in `server/routes/heygen-v3.ts`, kicked off from `server/routes.ts`) deletes rows older than `HEYGEN_SHAPE_DRIFT_RETENTION_DAYS` (default 30 days) so the operator-analytics table stays bounded. Operators can also force a sweep on demand via `DELETE /api/v3/admin/heygen-shape-drift-incidents?olderThanDays=N` (admin-only); the response returns `{deleted, olderThanDays}`. The cron is suppressed under `NODE_ENV=test` so tests can call `runShapeDriftRetentionSweep()` directly.

## External Dependencies
- **Database**: PostgreSQL (Neon)
- **AI Services**: Gemini 2.5 Flash, Anthropic Claude Sonnet 4.5, Google Imagen 3, Kling AI, ElevenLabs, Gemini VEO 3.1, Sora 2 (OpenAI via sora2api.ai), Luma Ray 2 (Dream Machine API), Runway Gen-4, Seedance (BytePlus ModelArk).
- **Authentication**: Replit OpenID Connect.
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth, Meta Graph API (Facebook, Instagram, WhatsApp).
- **UI Components**: Radix UI, Tailwind CSS.
- **Video Generation**: HeyGen API.
- **File Storage**: AWS S3, Replit Object Storage.
- **SMS/Voice**: Twilio API.