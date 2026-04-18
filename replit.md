# iMakePage - AI-Powered Real Estate Marketing Platform

## Overview
iMakePage is an AI-powered real estate marketing platform designed to centralize and streamline marketing activities for Omaha-area real estate agents. Developed by My Golden Brick, its core purpose is to empower real estate professionals with advanced AI capabilities for content generation, multi-platform social media management, and sophisticated video production. Key features include an AI content generation wizard, a video studio with talking avatars and property tour video creation, and comprehensive SEO analytics. The platform integrates content creation, social media scheduling, property listing management, and performance analytics into a unified dashboard, enhancing efficiency and market reach for agents.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, and Vite, leveraging `shadcn/ui`, Radix primitives, and Tailwind CSS for a modern, responsive design. Wouter manages routing, and `TanStack Query` handles state and API caching. WebSockets are integrated for real-time updates.

### Technical Implementations
The backend is built with Express.js and TypeScript (ESM), utilizing Replit OpenID Connect for authentication. It employs a RESTful API architecture with middleware and WebSocket support. OAuth 2.0 with PKCE (S256) secures social media integrations.

Key features include:
- **AI Content Generator Wizard**: Integrates Gemini 2.5 Flash for diverse marketing content generation.
- **AI Assistant**: Supports multiple providers (GPT-4o, Gemini 2.5 Flash, Claude Sonnet 4.5) with a "General Mode" for generic AI interaction and vision capabilities for image attachments.
- **AI Image Generation**: Detects image generation requests within the AI chat and uses Gemini 2.5 Flash Image, storing results in object storage.
- **Video Studio**: Facilitates avatar generation with gestures and voice extraction (HeyGen) and advanced video generation through Sora 2, Luma Ray 2, and Kling AI.
- **Luma Ray 2 Integration**: Provides AI video generation (text-to-video, image-to-video) with options for aspect ratio, duration, and seamless loops.
- **Runway Gen-4 Integration**: Offers Text-to-Video, Image-to-Video, and Video-to-Video generation modes with extended duration capabilities and automatic stitching of segments.
- **Video Edit/Stitch**: Allows combining multiple user-generated videos with crossfade transitions.
- **Social Media Management**: Features an automatic post scheduler for major platforms (Twitter/X, Facebook, Instagram, LinkedIn, TikTok, YouTube, WhatsApp) and activity dashboards.
- **Multi-Account WhatsApp**: Supports multiple WhatsApp phone numbers per user with account switching and management.
- **WhatsApp Bulk Queue System**: Manages bulk message sending, handling Meta quota limits, re-queuing ecosystem-blocked contacts, and detecting template pauses. Includes a detailed history and reporting.
- **Multi-Vertical Business Type System**: Dynamically adapts platform terminology, features, and AI prompts based on six supported business types (Real Estate, Restaurant, Home Services, Retail, Professional Services, General Business).
- **Property Tour Studio**: A wizard for creating detailed property tour videos using photos, floor plans, and camera positioning.
- **WhatsApp Analytics Dashboard**: Fetches real-time metrics from Meta Graph API, including messaging, conversation, pricing, and template analytics, along with phone quality ratings and messaging limits.
- **Boards (Generation Workspace)**: Manages creative asset generation with a schema for boards and assets, CRUD routes, and a unified chat handler for brainstorming and asset creation across various AI video generation services. Includes an auto-evaluation system for generated assets.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM for data persistence and multi-tenancy.
- **Storage Architecture**: `UnifiedUploadService` uses AWS S3 as primary storage with automatic fallback to Replit Object Storage.
- **Real-time Communication**: WebSockets ensure live updates and interactive features.
- **Photo Avatar Privacy**: Photo avatar data is strictly user-scoped.
- **Auto Image Processing**: `autoProcessImageMiddleware` automatically resizes and compresses image uploads, supporting various formats and preserving alpha channels.

## External Dependencies
- **Database**: PostgreSQL (Neon)
- **AI Services**: Gemini 2.5 Flash (text, image), Anthropic Claude Sonnet 4.5, Google Imagen 3, Kling AI, ElevenLabs, Gemini VEO 3.1, Sora 2 (OpenAI via sora2api.ai), Luma Ray 2 (Dream Machine API), Runway Gen-4
- **Authentication**: Replit OpenID Connect
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth, Meta Graph API (Facebook, Instagram, WhatsApp)
- **UI Components**: Radix UI, Tailwind CSS
- **Video Generation**: HeyGen API
- **File Storage**: AWS S3, Replit Object Storage
- **SMS/Voice**: Twilio API