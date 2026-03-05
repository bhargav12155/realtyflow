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
- **AI Content Generator Wizard**: Integrates OpenAI GPT-5 for generating diverse marketing content.
- **Video Studio**: Supports avatar generation with gestures and voice extraction (using `ffmpeg` and HeyGen), and advanced video generation capabilities through SJinn AI (supporting `auto`, `veo3`, and `sora2` models) and Kling AI for motion videos.
- **Social Media Management**: Features an automatic post scheduler for Twitter/X, Facebook, Instagram, LinkedIn, TikTok, YouTube, and WhatsApp, along with comprehensive dashboards for tracking post activity.
- **WhatsApp Bulk Queue System**: Manages high-volume messaging by queuing overflow messages, processing them in staggered batches, and implementing retry logic and error handling to comply with Meta's API limits.
- **Multi-Vertical Business Type System**: The platform supports six business types (Real Estate, Restaurant, Home Services, Retail, Professional Services, General Business), dynamically adapting terminology, feature sets, and UI elements based on the selected business type. This includes adaptive AI prompts, content labels, and feature visibility.
- **Property Tour Studio**: A four-step wizard allows agents to create detailed property tour videos, integrating photos, floor plans, and camera positioning to generate engaging visual content.

### System Design Choices
- **Database**: PostgreSQL with Drizzle ORM is used for data persistence, supporting multi-tenancy.
- **Storage Architecture**: A dual-storage approach utilizes HeyGen API for specific media processing and AWS S3 for general media storage.
- **Real-time Communication**: WebSockets facilitate live updates and interactive features throughout the platform.
- **Photo Avatar Privacy**: Photo avatar data is strictly user-scoped to ensure privacy and data security.

## External Dependencies
- **Database**: PostgreSQL (Neon)
- **AI Services**: OpenAI GPT-5, Kling AI, ElevenLabs, Gemini VEO 3.1
- **Authentication**: Replit OpenID Connect
- **Social Media APIs**: Twitter/X OAuth 2.0, YouTube OAuth, Meta Graph API (for Facebook, Instagram, WhatsApp)
- **UI Components**: Radix UI, Tailwind CSS
- **Video Generation**: HeyGen API (via external proxy service)
- **File Storage**: AWS S3
- **SMS/Voice**: Twilio API