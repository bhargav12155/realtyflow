# Nebraska Home Hub - Real Estate Marketing Platform

## Overview
Nebraska Home Hub is an AI-powered real estate marketing platform for Omaha-area agents. It provides AI content generation, multi-platform social media management, and SEO analytics to enhance agents' market reach and engagement. The platform unifies content creation, social media posting, property management, and performance analytics into a single dashboard.

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

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM, supporting main users (agents) and public users (clients) with multi-tenancy.
- **Storage Architecture**: Dual-storage strategy combining HeyGen API storage with AWS S3 for backup and archival of voice recordings, avatar images, and generated videos.
- **Real-time Communication**: WebSockets provide live updates for content generation status, social media posting, lead notifications, and activity feeds.
- **Photo Avatar Privacy**: Photo avatar groups are scoped to individual users via `userId` column. All photo avatar endpoints use database-first filtering to ensure users only see their own avatar groups. The `avatars` table stores individual avatar looks with user ownership, while `photoAvatars` table stores training photos linked to groups.

## External Dependencies

- **Database**: PostgreSQL (Neon serverless hosting)
- **AI Services**: OpenAI GPT-5 API, Kling AI, ElevenLabs
- **Authentication**: Replit OpenID Connect
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth (with placeholders for Facebook, Instagram, LinkedIn, TikTok)
- **UI Components**: Radix UI, Tailwind CSS
- **Real-time Features**: Native WebSocket
- **SEO Tools**: Google PageSpeed Insights API
- **Development Tools**: Vite, TypeScript, Drizzle Kit
- **Video Generation**: HeyGen API
- **File Storage**: AWS S3
- **SMS/Voice**: Twilio API