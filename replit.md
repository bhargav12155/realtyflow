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
- **Voice Cloning (HeyGen)**: Enables cloning user voices for reusable HeyGen avatars.
- **WhatsApp Analytics Dashboard**: Provides real-time metrics from Meta Graph API, including messaging, conversation, pricing, and template analytics, along with phone quality rating.
- **Boards**: A collaborative canvas with chat functionality for generating content and managing assets, supporting various video generation providers with validation logic.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM for data persistence and multi-tenancy.
- **Storage Architecture**: AWS S3 as primary storage with automatic fallback to Replit Object Storage via `UnifiedUploadService`.
- **Real-time Communication**: WebSockets ensure live updates.
- **Photo Avatar Privacy**: Photo avatar data is strictly user-scoped.
- **Auto Image Processing**: `autoProcessImageMiddleware` automatically resizes and compresses image uploads.

## External Dependencies
- **Database**: PostgreSQL (Neon)
- **AI Services**: Gemini 2.5 Flash, Anthropic Claude Sonnet 4.5, Google Imagen 3, Kling AI, ElevenLabs, Gemini VEO 3.1, Sora 2 (OpenAI via sora2api.ai), Luma Ray 2 (Dream Machine API), Runway Gen-4, Seedance (BytePlus ModelArk).
- **Authentication**: Replit OpenID Connect.
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth, Meta Graph API (Facebook, Instagram, WhatsApp).
- **UI Components**: Radix UI, Tailwind CSS.
- **Video Generation**: HeyGen API.
- **File Storage**: AWS S3, Replit Object Storage.
- **SMS/Voice**: Twilio API.