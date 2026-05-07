# iMakePage — Comprehensive Platform Documentation

> **Version**: 1.0 · **Last Updated**: February 21, 2026  
> **Platform URL**: [imakepage.com](https://imakepage.com)  
> **Built By**: My Golden Brick ([mygoldenbrick.com](https://mygoldenbrick.com))

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture](#2-architecture)
3. [Authentication System](#3-authentication-system)
4. [Dashboard](#4-dashboard)
5. [AI Content Generator](#5-ai-content-generator)
6. [Social Media Manager](#6-social-media-manager)
7. [Avatar & Video Studio](#7-avatar--video-studio)
8. [Video Generation (Kling AI & Voice Providers)](#8-video-generation-kling-ai--voice-providers)
9. [Property Tour Studio](#9-property-tour-studio)
10. [Media Library](#10-media-library)
11. [Content Calendar](#11-content-calendar)
12. [SEO Optimizer](#12-seo-optimizer)
13. [BHHS Compliance System](#13-bhhs-compliance-system)
14. [Streaming Avatar](#14-streaming-avatar)
15. [WhatsApp & Twilio Chatbot](#15-whatsapp--twilio-chatbot)
16. [GoHighLevel Integration](#16-gohighlevel-integration)
17. [WebSocket Real-time Updates](#17-websocket-real-time-updates)
18. [API Reference](#18-api-reference)
19. [External Services & Dependencies](#19-external-services--dependencies)
20. [Database Schema](#20-database-schema)
21. [Environment Variables](#21-environment-variables)
22. [Known Limitations & Gaps](#22-known-limitations--gaps)

---

## 1. Platform Overview

### What is iMakePage?

iMakePage is an **AI-powered real estate marketing automation platform** purpose-built for **300+ Omaha-area BHHS (Berkshire Hathaway HomeServices) Ambassador Real Estate agents**. It unifies content creation, multi-platform social media management, AI-generated video production, property tour videos, SEO analytics, and brokerage compliance into a single dashboard.

### Who is it for?

- **Primary Users**: Real estate agents affiliated with BHHS Ambassador Real Estate in the Omaha, Nebraska metropolitan area.
- **Secondary Users**: Team leads and brokerage admins who need oversight and compliance enforcement.
- **End Users**: Public users who interact with agent property pages (engagement tracking, lead capture).

### Business Purpose

The platform solves the core problem of real estate agents needing to maintain a consistent, compliant, multi-platform marketing presence without dedicated marketing staff. Key value propositions:

- **AI Content Generation**: Auto-generate blog posts, social media content, property descriptions, and email campaigns optimized per platform.
- **Multi-Platform Posting**: Post to Facebook, Instagram, LinkedIn, X/Twitter, YouTube, and TikTok from one interface.
- **Video Production**: Create professional talking-head avatar videos and property tour videos without a production team.
- **Compliance Automation**: Ensure all content meets BHHS Ambassador Real Estate brokerage requirements before publishing.
- **Lead Intelligence**: Track website visitor engagement and auto-generate leads from high-engagement sessions.

---

## 2. Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript, Vite bundler |
| **UI Framework** | shadcn/ui + Radix UI primitives + Tailwind CSS |
| **Routing** | Wouter (lightweight React router) |
| **State Management** | TanStack Query v5 (React Query) |
| **Backend** | Express.js with TypeScript (ESM modules) |
| **Database** | PostgreSQL (Neon-backed) via Drizzle ORM |
| **Real-time** | WebSocket (native `ws` library) |
| **File Storage** | AWS S3 + Replit Object Storage |
| **Authentication** | JWT tokens + Replit OpenID Connect |
| **AI** | OpenAI GPT-4o/GPT-5, Google Gemini (VEO 3.1) |

### Monolithic Architecture

The application is a **monolith** with a single Express server serving both the API and the Vite-bundled frontend:

```
┌─────────────────────────────────────────┐
│              Express Server             │
│  ┌──────────┐  ┌─────────────────────┐  │
│  │  Vite    │  │   REST API          │  │
│  │  (SPA)   │  │   200+ endpoints    │  │
│  │  :5000   │  │   /api/*            │  │
│  └──────────┘  └─────────────────────┘  │
│  ┌──────────┐  ┌─────────────────────┐  │
│  │ WebSocket│  │   Background Jobs   │  │
│  │  /ws     │  │   (Video polling,   │  │
│  │          │  │    avatar training)  │  │
│  └──────────┘  └─────────────────────┘  │
└─────────────────────────────────────────┘
         │              │
    ┌────┴────┐   ┌─────┴──────┐
    │PostgreSQL│   │  AWS S3    │
    │ (Neon)  │   │  + Object  │
    │         │   │  Storage   │
    └─────────┘   └────────────┘
```

### File Structure

```
/
├── client/
│   └── src/
│       ├── App.tsx              # Route definitions
│       ├── pages/               # Page components
│       │   ├── dashboard.tsx
│       │   ├── social-media.tsx
│       │   ├── ai-assistant.tsx
│       │   ├── settings.tsx
│       │   ├── profile.tsx
│       │   ├── login.tsx
│       │   ├── integration.tsx
│       │   ├── VoiceLibrary.tsx
│       │   ├── mobile-upload.tsx
│       │   ├── events-calendar.tsx
│       │   ├── unified-calendar.tsx
│       │   └── template-studio.tsx
│       ├── components/
│       │   ├── dashboard/       # Dashboard widgets
│       │   ├── shared/          # Shared components
│       │   └── ui/              # shadcn/ui components
│       ├── hooks/
│       │   └── useAuth.tsx      # Auth context + JWT
│       ├── contexts/
│       │   └── DemoContext.tsx   # Demo mode
│       └── lib/
│           └── queryClient.ts   # TanStack Query config
├── server/
│   ├── routes.ts               # ALL API routes (~20,024 lines)
│   ├── storage.ts              # Database access layer (IStorage)
│   ├── websocket.ts            # WebSocket real-time service
│   ├── middleware/
│   │   └── auth.ts             # JWT middleware
│   ├── objectStorage.ts        # Replit Object Storage
│   └── services/
│       ├── openai.ts           # OpenAI GPT integration
│       ├── gemini.ts           # Google Gemini / VEO 3.1
│       ├── unified-ai.ts       # AI provider abstraction
│       ├── socialMedia.ts      # Social media posting
│       ├── compliance.ts       # BHHS compliance checker
│       ├── heygen.ts           # HeyGen video generation
│       ├── heygen-photo-avatar.ts  # Photo avatar workflows
│       ├── heygen-avatar-iv.ts     # Avatar IV generation
│       ├── heygen-streaming.ts     # Streaming avatar
│       ├── heygen-video-avatar.ts  # Enterprise video avatars
│       ├── heygen-template.ts      # HeyGen templates
│       ├── heygen-templates.ts     # Template management
│       ├── kling.ts            # Kling AI motion video
│       ├── veo-video.ts        # VEO 3.1 property tours
│       ├── elevenlabs.ts       # ElevenLabs TTS
│       ├── twilio.ts           # Twilio SMS/Voice
│       ├── whatsapp.ts         # WhatsApp Business API
│       ├── s3Upload.ts         # AWS S3 uploads
│       ├── searchConsole.ts    # Google Search Console
│       ├── seo.ts              # SEO analysis
│       ├── mls.ts              # MLS property data
│       ├── encryption.ts       # API key encryption
│       ├── event-ingestion.ts  # Event calendar sync
│       ├── post-scheduler.ts   # Auto-scheduling
│       ├── videoJobWorker.ts   # Background video jobs
│       ├── video-studio.ts     # Video studio logic
│       ├── kenburns-video.ts   # Ken Burns effect
│       ├── market-intelligence.ts  # Market data
│       ├── ai-content-calendar.ts  # AI calendar content
│       ├── ai-keyword-generator.ts # Keyword generation
│       ├── ai-market-generator.ts  # Market content
│       ├── mediaAssetUploader.ts   # Media upload
│       └── template-seeder.ts     # Template data seeding
└── shared/
    └── schema.ts               # Drizzle ORM schema (1,647 lines, 40+ tables)
```

### Frontend Routes

| Path | Component | Auth Required | Description |
|------|-----------|:---:|-------------|
| `/` | Dashboard | ✅ | Main dashboard (redirects to /dashboard) |
| `/dashboard` | Dashboard | ✅ | Dashboard with overview cards |
| `/social-media` | SocialMediaPage | ✅ | Social media management |
| `/ai-assistant` | AiAssistantPage | ✅ | AI chat assistant |
| `/settings` | SettingsPage | ✅ | Platform settings |
| `/profile` | ProfilePage | ✅ | User profile |
| `/custom-voices` | VoiceLibrary | ✅ | Voice library management |
| `/events` | EventsCalendarPage | ✅ | Events calendar |
| `/calendar` | UnifiedCalendarPage | ✅ | Unified content calendar |
| `/templates` | TemplateStudioPage | ✅ | Video template studio |
| `/login` | LoginPage | ❌ | Login page |
| `/integration` | IntegrationPage | ❌ | Integration landing page |
| `/mobile-upload/:sessionId` | MobileUploadPage | ❌ | QR-code mobile upload |

### Context Providers

The app wraps all routes in the following provider hierarchy:

```
QueryClientProvider → AuthProvider → DemoProvider → TooltipProvider → ConfirmDialogProvider
```

- **AuthProvider**: Manages JWT token state, login/logout, user context
- **DemoProvider**: Enables demo mode for showcasing features without real accounts
- **TemplateDataImporter**: Auto-imports template data on mount

---

## 3. Authentication System

### Overview

The platform uses a **dual authentication model** supporting two distinct user types:

1. **Agent Users** (`type: "agent"`): Real estate agents with full platform access
2. **Public Users** (`type: "public"`): End-users of agent websites with limited, scoped access

### JWT Token Structure

```typescript
interface JWTPayload {
  id: string | number;         // User ID (UUID for agents, integer for public users)
  username?: string;            // Agent username (agents only)
  email: string;                // User email
  type?: "agent" | "public";   // User type discriminator
  agentSlug?: string;           // Agent identifier (public users only)
  name?: string;                // Display name
  isDemo?: boolean;             // Demo account flag
  iat?: number;                 // Issued at timestamp
  exp?: number;                 // Expiration timestamp
}
```

### Token Extraction

Tokens are extracted from two locations (in order):
1. `Authorization: Bearer <token>` header
2. `authToken` cookie

### Middleware Chain

| Middleware | Function | Used For |
|-----------|----------|----------|
| `extractUserId` / `requireAuth` | Validates JWT, populates `req.userId`, `req.userType`, `req.user` | All authenticated routes |
| `requireAgent` | Calls `extractUserId` + checks `req.userType === "agent"` | Agent-only routes |
| `requirePublicUser` | Calls `extractUserId` + checks `req.userType === "public"` | Public-user-only routes |
| `createRequireAdmin(storage)` | Factory function: validates user + checks `role === "admin"` | Admin routes |

### Login Flow

**Agent Login** (`POST /api/auth/login`):
1. Client sends `{ username, password }`
2. Server validates credentials against `users` table (bcrypt hash)
3. Returns JWT token with `type: "agent"`
4. Client stores token in cookie + localStorage

**Demo Mode**:
- Users can be flagged with `isDemo: true` in the database
- Demo flag is included in JWT payload
- Frontend shows `DemoModeBanner` component for demo accounts

### Multi-Tenancy

- Agent users own all their data via `userId` foreign keys on every table
- Public users are scoped to a specific agent via `agentSlug`
- The `publicUsers` table enforces a unique constraint on `(agentSlug, email)` — one email per agent
- All queries filter by the authenticated user's ID to ensure data isolation

### User Schema

```sql
-- Agent users
users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,        -- bcrypt hashed
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'agent',     -- 'agent' or 'admin'
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMP
)

-- Public users (agent website visitors)
public_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  agent_slug TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  preferences JSONB,
  last_login TIMESTAMP,
  created_at TIMESTAMP,
  UNIQUE(agent_slug, email)
)
```

---

## 4. Dashboard

### Overview

The dashboard (`/dashboard`) is the main landing page after login. It displays summary cards and metrics about the agent's marketing activities.

### API Endpoint

**`GET /api/dashboard/overview`** (requires auth)

Returns aggregated counts and metrics:

```json
{
  "contentPieces": 42,
  "scheduledPosts": 15,
  "socialAccounts": 4,
  "seoKeywords": 28,
  "recentContent": [...],
  "upcomingPosts": [...],
  "platformScores": [...]
}
```

### Data Sources

| Metric | Source Table | Query |
|--------|-------------|-------|
| Content Pieces Count | `content_pieces` | Count WHERE `user_id = ?` |
| Scheduled Posts Count | `scheduled_posts` | Count WHERE `user_id = ?` AND `status = 'pending'` |
| Connected Social Accounts | `social_media_accounts` | Count WHERE `user_id = ?` AND `is_connected = true` |
| SEO Keywords Tracked | `seo_keywords` | Count WHERE `user_id = ?` |
| Recent Content | `content_pieces` | Last 5, ordered by `created_at` DESC |
| Upcoming Posts | `scheduled_posts` | Next 5 pending, ordered by `scheduled_for` ASC |

### Platform Intelligence Scores

**`GET /api/social/platform-scores`** (requires auth)

Returns AI-analyzed platform fit scores for the agent's content, using the Platform Intelligence Taxonomy:

```typescript
interface PlatformScore {
  platform: string;          // 'facebook', 'instagram', etc.
  score: number;             // 0-100
  fit: 'excellent' | 'very-good' | 'good' | 'fair';
  reasons: string[];         // Why this score
  optimization: string;      // Suggestion to improve
  confidence?: number;
}
```

### Content Profile Analysis

The platform automatically profiles each piece of content using:

- **Content Type**: listing, market_update, buyer_tips, seller_tips, neighborhood, investment, testimonial, general
- **Audience Persona**: first_time_buyer, luxury_buyer, seller, investor, relocating, general
- **Content Intent**: educate, convert, engage, inform, inspire
- **Property Class**: luxury, mid_market, starter, investment, general
- **Market Signals**: inventory heat (hot/balanced/cold), price momentum (rising/stable/falling), days on market trend (fast/normal/slow)

---

## 5. AI Content Generator

### Overview

The AI Content Generator is a multi-step wizard that creates marketing content tailored to each social media platform, property type, and audience persona. It supports dual AI providers (OpenAI and Google Gemini) with automatic fallback.

### AI Provider System

**`GET /api/openai/status`**: Returns current AI provider status and availability.

The platform supports three modes via user preferences:

| Mode | Behavior |
|------|----------|
| `auto` | Uses OpenAI as primary, Gemini as fallback |
| `openai` | OpenAI only |
| `gemini` | Gemini only |

Configured per-user in `userPreferences.aiProvider` and stored in `brandSettings.aiProvider`.

### Content Generation Endpoints

#### `POST /api/content/generate`
Generate content (blog post, social post, property description, email campaign).

**Request**:
```json
{
  "contentType": "social_post",
  "topic": "Just Listed: Beautiful 4BR home in Dundee",
  "keywords": ["Dundee", "Omaha real estate", "luxury home"],
  "neighborhood": "Dundee",
  "platform": "instagram",
  "tone": "professional"
}
```

**Response**:
```json
{
  "id": "uuid",
  "content": "...",
  "title": "...",
  "seoOptimized": true,
  "metadata": { "model": "gpt-4o", "tokens": 450 }
}
```

#### `POST /api/content/social-post`
Generate a platform-optimized social media post with hashtags and compliance.

#### `POST /api/content/enhance`
Enhance existing content with AI rewrites.

#### `POST /api/content/ai-optimized`
Generate AI-optimized content with platform-specific formatting.

#### `POST /api/content/regenerate-for-platform`
Take existing content and reformat for a different social platform.

#### `POST /api/content/promote-app`
Generate promotional content for the platform itself.

### Content Types

| Type | Description | Typical Platforms |
|------|-------------|-------------------|
| `social_post` | Short-form social media post | All |
| `blog_article` | Long-form blog content | Website |
| `property_description` | MLS listing description | Website, Facebook |
| `email_campaign` | Email marketing content | Email |
| `market_update` | Local market statistics and analysis | LinkedIn, Facebook |
| `buyer_tips` | Educational content for buyers | All |
| `seller_tips` | Educational content for sellers | All |
| `neighborhood` | Neighborhood spotlight content | Instagram, Facebook |
| `testimonial` | Client testimonial formatting | All |

### Image Generation

#### `POST /api/images/generate`
Generate AI images using OpenAI DALL-E.

#### `GET /api/images/stock`
Search stock images from Pexels API.

#### `GET /api/images/templates`
Get available image templates for social posts.

### AI Chat Sessions

The platform includes a full conversational AI assistant:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/chat-sessions` | GET | List all chat sessions for user |
| `/api/ai/chat-sessions/:id` | GET | Get specific chat session |
| `/api/ai/chat-sessions` | POST | Create new chat session |
| `/api/ai/chat-sessions/:id` | PATCH | Update chat session (title, messages) |
| `/api/ai/chat-sessions/:id` | DELETE | Delete chat session |
| `/api/ai/chat` | POST | Send message to AI assistant |

Chat sessions are persisted in `ai_chat_sessions` table with full message history stored as JSONB.

### AI Assistant Messages

Separate from chat sessions, the AI assistant stores individual messages:

```sql
ai_assistant_messages (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  role TEXT NOT NULL,           -- 'user' or 'assistant'
  content TEXT NOT NULL,
  attachments JSONB,           -- [{ url, type, name }]
  created_at TIMESTAMP
)
```

---

## 6. Social Media Manager

### Overview

The Social Media Manager supports **six platforms**: Facebook, Instagram, LinkedIn, X/Twitter, YouTube, and TikTok. Each platform has its own OAuth flow, token management, and posting mechanism.

### Platform Connection Architecture

All social connections are stored in two tables:

```sql
-- OAuth tokens and connection state
social_media_accounts (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  platform TEXT NOT NULL,        -- 'facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  is_connected BOOLEAN,
  account_username TEXT,
  metadata JSONB,                -- Platform-specific data (page IDs, account IDs, etc.)
  last_synced TIMESTAMP
)

-- Per-user API credentials
social_api_keys (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  facebook_app_id TEXT,
  facebook_app_secret TEXT,
  instagram_business_account_id TEXT,
  instagram_token TEXT,
  twitter_api_key TEXT,
  twitter_api_secret TEXT,
  twitter_access_token TEXT,
  twitter_access_token_secret TEXT,
  linkedin_client_id TEXT,
  linkedin_client_secret TEXT,
  linkedin_access_token TEXT,
  youtube_api_key TEXT,
  youtube_channel_id TEXT,
  tiktok_access_token TEXT
)
```

### Scheduled Posts Workflow

```
Agent creates post → Compliance check → Save as 'pending'
→ Agent reviews/edits → Approve → Status = 'approved'
→ Publish action → API call to platform → Status = 'posted'
```

**Key Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scheduled-posts` | GET | List all scheduled posts |
| `/api/scheduled-posts` | POST | Create new scheduled post |
| `/api/scheduled-posts/:id` | PUT | Full update |
| `/api/scheduled-posts/:id` | PATCH | Partial update (status, content) |
| `/api/scheduled-posts/:id` | DELETE | Delete post |
| `/api/scheduled-posts/bulk-delete` | POST | Bulk delete posts |
| `/api/scheduled-posts/:id/publish` | POST | Publish post to connected platform |
| `/api/scheduled-posts/upload-media` | POST | Upload media for a post |
| `/api/scheduled-posts/update-image` | POST | Update post image |
| `/api/scheduled-posts/generate-weekly` | POST | AI-generate a week of content |
| `/api/scheduled-posts/generate-monthly` | POST | AI-generate a full month of content |
| `/api/scheduled-posts/schedule-smart` | POST | AI-powered smart scheduling |
| `/api/content/generate-plan` | POST | Generate content plan |

### Posting Service (`server/services/socialMedia.ts`)

The `SocialMediaService` class handles all cross-platform posting. Each platform has dedicated `postTo[Platform]` methods.

---

### 6.1 Facebook

#### Connection
- Users provide their own Facebook App ID and App Secret via the settings page
- Stored in `social_api_keys` table
- Platform uses Facebook Graph API v18.0+

#### Token Management
- User tokens are exchanged for long-lived tokens
- Page tokens are discovered via `GET /me/accounts`

#### Debug Token Fallback
When `GET /me/accounts` returns 0 pages (common with "New Pages Experience"), the system falls back to a **Debug Token** approach:

1. Call `GET /debug_token?input_token={userToken}`
2. Parse `granular_scopes` from debug response
3. Extract Page IDs from scopes
4. Call `GET /{pageId}?fields=name,access_token` for each Page ID
5. Return discovered pages

**Relevant Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/facebook/pages` | GET | Get user's Facebook pages (with debug fallback) |
| `/api/facebook/pages/manual` | POST | Manually configure page token |
| `/api/facebook/debug` | GET | Debug token inspection |
| `/api/facebook/posts` | GET | Get recent posts from page |
| `/api/facebook/validate` | GET/POST | Validate Facebook connection |

#### Posting Mechanism
1. Posts to the selected Facebook Page using Page Access Token
2. Text posts: `POST /{pageId}/feed` with `message` parameter
3. Photo posts: `POST /{pageId}/photos` with `url` (image URL) + `message`
4. Metadata stores `{ pageId, pageName, pageAccessToken }`

---

### 6.2 Instagram

#### Connection (Current Implementation)
Instagram posting uses the **Facebook Pages API** approach:
1. Requires a Facebook Page connected to an Instagram Business Account
2. Uses the Facebook Page token to post via Instagram Graph API
3. The Instagram Business Account ID is stored in `social_api_keys.instagramBusinessAccountId`

#### Posting Mechanism (Container Workflow)
Instagram uses a two-step container-based publishing flow:

**Step 1 — Create Media Container**:
```
POST /v18.0/{ig-user-id}/media
  image_url: <public URL>
  caption: <text>
```

**Step 2 — Publish Container**:
```
POST /v18.0/{ig-user-id}/media_publish
  creation_id: <container_id from step 1>
```

#### GoHighLevel Planned Integration
A future integration with GoHighLevel is planned to replace the Facebook Page token approach, enabling:
- Direct Instagram DM posting
- WhatsApp message posting
- More reliable token management

**Relevant Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/instagram/accounts` | GET | List Instagram business accounts |
| `/api/instagram/validate` | GET/POST | Validate Instagram connection |

---

### 6.3 LinkedIn

#### Connection
- OAuth 2.0 flow with `linkedin_client_id` and `linkedin_client_secret`
- Access token stored in `social_api_keys.linkedinAccessToken`

#### Posting Mechanism — Multi-Step Image Upload
LinkedIn uses a **3-step image upload process**:

**Step 1 — Register Upload**:
```
POST https://api.linkedin.com/v2/assets?action=registerUpload
{
  "registerUploadRequest": {
    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
    "owner": "urn:li:person:{personId}"
  }
}
```
Returns: `uploadUrl` and `asset` URN.

**Step 2 — Download & Upload Binary**:
1. Download image from source URL to buffer
2. Upload binary to LinkedIn's `uploadUrl` via PUT request with proper content type

**Step 3 — Create Share**:
```
POST https://api.linkedin.com/v2/ugcPosts
{
  "author": "urn:li:person:{personId}",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": { "text": "<post content>" },
      "shareMediaCategory": "IMAGE",
      "media": [{ "status": "READY", "media": "<asset URN>" }]
    }
  }
}
```

Supports **multi-image posts** — repeats steps 1-2 for each image, then includes all asset URNs in the share.

**Relevant Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/linkedin/test` | GET | Test LinkedIn connection |
| `/api/linkedin/validate` | POST | Validate LinkedIn credentials |

---

### 6.4 X/Twitter

#### Connection — OAuth 2.0 with PKCE
Twitter uses **OAuth 2.0 Authorization Code Flow with PKCE (S256)**:

1. Generate `code_verifier` (random string) and `code_challenge` (SHA-256 hash)
2. Store `{ state, code_verifier, expires_at }` in `pkce_store` database table
3. Redirect user to Twitter authorization URL
4. On callback, exchange authorization code + code_verifier for access token
5. Store access token in `social_media_accounts`

```sql
pkce_store (
  state VARCHAR PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP
)
```

#### Posting Mechanism
- Uses Twitter API v2: `POST /2/tweets`
- OAuth 2.0 Bearer token authentication
- Text-only posts (media upload via Twitter media upload API)

#### Tweet Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/twitter/validate` | GET/POST | Validate Twitter connection |
| `/api/twitter/post/:tweetId` | DELETE | Delete a tweet |

---

### 6.5 YouTube

#### Connection — OAuth 2.0
- Full OAuth 2.0 flow via Google APIs
- Scopes: YouTube Data API v3 + YouTube upload
- Tokens stored in `social_media_accounts`

**OAuth Flow**:
1. `GET /auth/youtube` — Redirects to Google OAuth consent screen
2. `GET /auth/youtube/callback` — Handles OAuth callback, exchanges code for tokens

#### Posting Mechanism
- Video upload via YouTube Data API v3
- Supports title, description, tags, privacy settings
- Videos stored with `youtubeVideoId` and `youtubeUrl` in `video_content` table

**Relevant Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/youtube` | GET | Start YouTube OAuth flow |
| `/auth/youtube/callback` | GET | YouTube OAuth callback |
| `/api/youtube/validate` | GET/POST | Validate YouTube connection |

---

### 6.6 TikTok

#### Connection
- TikTok Login Kit OAuth flow
- Verification files served at root for domain verification:
  - `GET /tiktokHZDg3yBpAzeIOPIIdDfO5vOvb37704m6.txt`
  - `GET /tiktokf3X4X4cD804z5bwoEuSVOcG0BZjc4SpV.txt`

#### Video Upload Workflow (`FILE_UPLOAD` Method)
TikTok requires a specific multi-step video upload process:

**Step 1 — Query Creator Info**:
```
POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
```
Returns privacy level options available to the creator.

**Step 2 — Initialize Upload**:
```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
{
  "post_info": {
    "title": "<title>",
    "privacy_level": "<from step 1>",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": <file_size_bytes>,
    "chunk_size": <file_size_bytes>,
    "total_chunk_count": 1
  }
}
```
Returns: `publish_id` and `upload_url`.

**Step 3 — Download Video to Buffer**:
The system downloads the video from its storage URL (S3/Object Storage) to a local buffer.

**Step 4 — Upload Video Binary**:
```
PUT <upload_url>
Content-Range: bytes 0-{fileSize-1}/{fileSize}
Content-Type: video/mp4
Body: <video binary>
```

**Step 5 — Poll Status**:
```
POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
{ "publish_id": "<publish_id>" }
```
Poll every 5 seconds until `status === "PUBLISH_COMPLETE"` or failure.

**Relevant Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tiktok/validate` | POST | Validate TikTok connection |

---

### 6.7 General Social Media Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/social/connect/:platform` | POST | Initialize OAuth connection for a platform |
| `/api/social/callback/:platform` | GET | Handle OAuth callback |
| `/api/social/status/:platform` | GET | Check connection status |
| `/api/social/accounts` | GET | List all connected accounts |
| `/api/social/accounts` | POST | Create/update social account connection |

---

## 7. Avatar & Video Studio

### Overview

The Avatar & Video Studio is the platform's flagship feature. It enables agents to create professional talking-head videos using AI-generated avatars, powered by **HeyGen** (via an external service proxy). The system supports:

- Photo avatar creation from a single photo
- AI-generated look variations (4 styles)
- Avatar IV video generation
- Video avatars from training footage
- Custom voice cloning

### External Service Proxy Architecture

All HeyGen API calls are proxied through an external service to avoid direct HeyGen API issues:

```
iMakePage Backend → External Service (AWS Elastic Beanstalk) → HeyGen API
```

**External Service URL**: Configured via `PHOTO_AVATAR_SERVICE_URL` environment variable  
**Base URL**: `gb-video-studio-env-2.eba-h2pwbutp.us-east-2.elasticbeanstalk.com`  
**Authentication**: None required on external service  
**File Size Limit**: 50MB  
**Supported Formats**: JPEG, PNG, WebP, GIF

### Photo Avatar Creation Workflow

**Complete Automated Timeline** (~6-8 minutes):

```
t=0s     Upload photo to HeyGen CDN, create avatar group, return group_id
t=0-30s  HeyGen processes uploaded image (background)
t=30s    Backend starts avatar training via POST /photo_avatar/train
t=30s-5m Poll training status every 10s until ready/completed
t=5m     Training complete → generate 4 looks in parallel
t=5-8m   Poll each look generation every 10s
t=8m     All 4 looks saved to database, 100% complete
```

#### Main Entry Point

**`POST /api/photo-avatars/create-with-looks`** (multipart)

Parameters:
- `image` (file): Agent photo (JPEG/PNG/WebP/GIF)
- `name` (optional): Group name
- `prompt`, `orientation`, `pose`, `style` (optional): Look generation options

Response:
```json
{
  "group_id": "heygen_group_123",
  "status": "processing"
}
```

This endpoint returns **immediately** (~2s) and processes everything in the background.

### Look Generation

Four looks are generated in parallel with face-preserving prompts:

| Look | Label | Prompt |
|------|-------|--------|
| Executive | `professional-executive` | "Professional executive in a navy business suit, confident and approachable, maintain the exact same face" |
| Friendly Agent | `friendly-agent` | "Friendly real estate agent in smart casual blazer, warm and welcoming smile" |
| Outdoor Guide | `outdoor-guide` | "Outdoor property tour guide in clean casual attire, natural setting" |
| Modern Professional | `modern-professional` | "Modern professional in contemporary business wear, sleek and polished" |

Each look is tracked in the `look_generation_jobs` table:

```sql
look_generation_jobs (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  group_id TEXT NOT NULL,
  heygen_generation_id TEXT NOT NULL,
  look_label TEXT NOT NULL,
  look_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'pending',    -- pending, processing, completed, failed
  result_avatar_id TEXT,
  result_image_url TEXT,
  error_message TEXT,
  baseline_avatar_ids TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)
```

### Avatar IV (Quick Video Generation)

**`POST /api/avatar-iv/generate`**

Generate a video from an existing avatar image:
```json
{
  "imageKey": "heygen_image_key",
  "script": "Welcome to this beautiful 4-bedroom home...",
  "voiceId": "1c7c897eeb2d4b5fb17d3c6c70250b24"
}
```

### Video Generation Options

| Option | Endpoint | Use Case | Duration |
|--------|----------|----------|----------|
| **Avatar IV** | `POST /api/avatar-iv/generate` | Quick one-off videos | ~2 min |
| **From Generated Look** | `POST /api/avatar-iv/use-look-image` → script → Avatar IV | Use gallery look for video | ~3 min |
| **Direct Upload** | `POST /api/photo-avatars/generate-video-from-image` | Full background flow | ~8-13 min |

### Photo Avatar Status & Polling

| Endpoint | Description | Poll Interval |
|----------|-------------|---------------|
| `GET /api/photo-avatars/status/:groupId` | Training status with workflow_status.percent_complete | 30s |
| `GET /api/photo-avatars/active-jobs` | In-progress look generation jobs | 10s (active), 30s (idle) |
| `GET /api/photo-avatars/video-status/:videoId` | Video generation status | 10s |
| `GET /api/photo-avatars/proxy/generation-status/:generationId` | Look generation status | 10s |

### External Service API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/heygen/assets` | POST | Upload photo/audio (multipart: `file`, `kind`) |
| `/api/heygen/avatars/create-group` | POST | Create avatar group (JSON: `{image_key}`) |
| `/api/heygen/avatars/{groupId}/train` | POST | Start training |
| `/api/heygen/avatars/train/status/{groupId}` | GET | Check training status |
| `/api/heygen/avatars/{groupId}/generate-look` | POST | Generate look (JSON: `{prompt, orientation, pose, style}`) |
| `/api/heygen/avatars/generation/{id}` | GET | Check generation status |
| `/api/heygen/videos` | POST | Create talking avatar video |
| `/api/heygen/voices` | GET | List available TTS voices |
| `/api/heygen/scripts/auto` | POST | Auto-generate script |
| `/api/avatars/library` | GET | Avatar library (trained + looks) |

### Our Proxy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/photo-avatars/create-with-looks` | POST | Main entry: upload, train, generate 4 looks |
| `/api/photo-avatars/generate-video-from-image` | POST | Upload + train + generate video (multipart) |
| `/api/photo-avatars/status/:groupId` | GET | Training status |
| `/api/photo-avatars/video-status/:videoId` | GET | Video generation status |
| `/api/photo-avatars/active-jobs` | GET | In-progress jobs for current user |
| `/api/photo-avatars/groups/:groupId/proxy-generate-look` | POST | Single look generation |
| `/api/photo-avatars/proxy/generation-status/:generationId` | GET | Look generation status |
| `/api/avatar-iv/use-look-image` | POST | Bridge: download look URL → re-upload → get image_key |
| `/api/avatar-iv/generate` | POST | Generate Avatar IV video |

### Video Avatar (Enterprise)

For agents who want ultra-realistic avatars trained from video footage:

```sql
video_avatars (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  avatar_name TEXT NOT NULL,
  heygen_avatar_id TEXT UNIQUE NOT NULL,
  training_video_url TEXT NOT NULL,  -- S3 URL
  consent_video_url TEXT NOT NULL,   -- S3 URL
  voice_id TEXT,
  audio_asset_id TEXT,               -- Voice extracted from training video
  status TEXT DEFAULT 'in_progress', -- in_progress, complete, failed
  error_message TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)
```

**Endpoints**:
- `POST /api/video-avatars` — Create video avatar (multipart upload with training + consent videos)
- `GET /api/video-avatars` — List video avatars for user

### Custom Voices

Agents can upload voice samples for voice cloning:

```sql
custom_voices (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  audio_url TEXT NOT NULL,        -- S3 URL
  file_size INTEGER,
  heygen_audio_asset_id TEXT,     -- HeyGen asset ID
  status TEXT DEFAULT 'pending',
  heygen_voice_id TEXT,
  language TEXT,
  gender TEXT,
  sample_audio_url TEXT,
  created_at TIMESTAMP
)
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/custom-voices` | GET | List user's custom voices |
| `/api/custom-voices` | POST | Upload voice sample |
| `/api/custom-voices/:id` | DELETE | Delete custom voice |

### Common Default Voice IDs

| Voice | ID | Description |
|-------|-----|-------------|
| Professional Male - Confident | `92c93dc0dff2428ab0bea258ba68f173` | Confident male voice |
| Professional Male - Warm | `f577da968446491289b53bceb77e5092` | Warm male voice |
| Professional Female - Clear | `73c0b6a2e29d4d38aca41454bf58c955` | Clear female voice |
| Professional Female - Friendly | `1c7c897eeb2d4b5fb17d3c6c70250b24` | **Default** voice |
| Neutral - Balanced | `119caed25533477ba63822d5d1552d25` | Gender-neutral voice |

### Mobile Upload (QR Code)

For uploading training/consent videos from a mobile device:

1. Agent generates QR code from desktop → creates `MobileUploadSession` with session ID
2. Agent scans QR code on phone → opens `/mobile-upload/:sessionId`
3. Phone uploads video directly to S3
4. Desktop polls session status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mobile-upload/:sessionId` | GET | Get mobile upload session info |
| `/api/upload-placeholder` | PUT | Upload placeholder/file |
| `/api/upload-reference` | POST | Upload reference file |
| `/api/upload/video-source` | POST | Upload video source file |

---

## 8. Video Generation (Kling AI & Voice Providers)

### Kling AI Motion Video

Kling AI is used to add **motion effects** to static avatar images, creating dynamic video content without requiring HeyGen's motion features.

**Service**: `server/services/kling.ts`

Key capabilities:
- Image-to-video transformation
- Motion style application
- Per-user Kling API key support (stored encrypted in `brand_settings.kling_api_key_encrypted`)

### Dual Voice Provider System

The platform supports two TTS providers that can be used interchangeably:

#### ElevenLabs (`server/services/elevenlabs.ts`)

- **API URL**: `https://api.elevenlabs.io/v1`
- **Auth**: `xi-api-key` header with `ELEVENLABS_API_KEY`
- **Features**:
  - Voice listing: `GET /v1/voices`
  - Text-to-speech: `POST /v1/text-to-speech/{voiceId}?output_format=mp3_44100_128`
  - Voice settings: stability, similarity_boost, style, speaker_boost
- **Output**: Audio buffer uploaded to S3, returns URL

#### Kling Voice

- Built into the Kling AI service
- Used for motion videos with synchronized lip movement

### Background Video Generation

Video generation is handled as background jobs with WebSocket notifications:

```sql
video_generation_jobs (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  source TEXT NOT NULL,            -- 'avatar_iv', 'video_studio', 'template'
  heygen_video_id TEXT,
  title TEXT,
  status TEXT DEFAULT 'pending',   -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0,
  video_url TEXT,
  thumbnail_url TEXT,
  error_message TEXT,
  metadata JSONB,                  -- { avatarId, voiceId, script, templateId }
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
)
```

The `videoJobWorker` service polls HeyGen for video status and sends WebSocket notifications on completion.

---

## 9. Property Tour Studio

### Overview

The Property Tour Studio is a **4-step wizard** for creating virtual property tour videos:

1. **Floor Plan Setup**: Upload property photos, arrange rooms on a visual floor plan
2. **Room Configuration**: Assign up to 6 photos per room, set camera positions
3. **Room Connections**: Define pathways between rooms for camera movement
4. **Video Generation**: VEO 3.1 generates 16-second video segments with spatial camera motion

### VEO 3.1 Integration

**Service**: `server/services/veo-video.ts`

Google's VEO 3.1 (via Gemini API) generates cinematic property tour video segments:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/veo/start` | POST | Start VEO video generation for a room |
| `/api/ai/veo/status/:operationId` | GET | Check VEO generation status |
| `/api/ai/veo/combine` | POST | Combine room segments into full tour |

**Generation Parameters**:
- 16-second segments per room
- Spatial camera motion (pan, tilt, dolly)
- Cinematic transitions between rooms
- Per-room video generation enables individual room social sharing

### Ken Burns Effect

**Service**: `server/services/kenburns-video.ts`

For still photos, a Ken Burns (pan-and-zoom) effect can be applied to create motion from static images.

---

## 10. Media Library

### Overview

The Unified Media Library stores all photos, videos, and avatar assets in a single searchable library.

```sql
media_assets (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  type TEXT NOT NULL,              -- 'photo', 'video', 'avatar'
  source TEXT NOT NULL,            -- 'upload', 'heygen', 'library'
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  avatar_id VARCHAR,               -- FK to avatars table
  title TEXT,
  description TEXT,
  mime_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  metadata JSONB,
  created_at TIMESTAMP
)
```

### Post-Media Junction

Posts can have multiple media attachments via a many-to-many junction table:

```sql
post_media (
  id UUID PRIMARY KEY,
  post_id VARCHAR NOT NULL,
  media_id VARCHAR NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP
)
```

### Avatar Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/avatars` | GET | List user's avatars |
| `/api/avatars` | POST | Create new avatar |
| `/api/avatars/import` | POST | Import avatars from HeyGen |
| `/api/avatars/heygen-list` | GET | List available HeyGen avatars |
| `/api/voices/heygen-list` | GET | List available HeyGen voices |

### Storage Architecture

**Dual Storage**:
1. **AWS S3**: Primary storage for user uploads, generated videos, voice samples
   - Service: `server/services/s3Upload.ts`
   - Env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`

2. **Replit Object Storage**: Secondary storage for platform assets
   - Service: `server/objectStorage.ts`
   - Public objects served via: `GET /public-objects/:filePath(*)`

---

## 11. Content Calendar

### Overview

The Content Calendar provides auto-filled monthly content scheduling with AI-generated posts.

### Calendar Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scheduled-posts/generate-weekly` | POST | Generate a week of content |
| `/api/scheduled-posts/generate-monthly` | POST | Generate a full month of content |
| `/api/scheduled-posts/schedule-smart` | POST | AI-powered smart scheduling |
| `/api/content/generate-plan` | POST | Generate a content plan |
| `/api/ai/schedule-content` | POST | AI schedule content |

### AI Content Calendar Service

**Service**: `server/services/ai-content-calendar.ts`

Generates a monthly calendar of content based on:
- Agent's service areas and neighborhoods
- Market conditions
- Seasonal relevance
- Platform mix optimization
- Compliance requirements

### Event-Based Content

Events from various sources can trigger automatic content suggestions:

```sql
events (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  source_id VARCHAR NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  timezone TEXT DEFAULT 'America/Chicago',
  location TEXT,
  event_url TEXT,
  image_url TEXT,
  is_all_day BOOLEAN,
  category TEXT,                -- 'real_estate', 'community', 'market', 'networking'
  tags TEXT[],
  raw_data JSONB,
  UNIQUE(user_id, source_id, external_id)
)

event_sources (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'google_calendar_public', 'google_calendar_private', 'ical', 'aggregator'
  config JSONB,                -- { calendarId, icalUrl, apiKey, accessToken, refreshToken, query, location }
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMP,
  last_sync_status TEXT,
  sync_error TEXT
)

event_post_suggestions (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  event_id VARCHAR NOT NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  hashtags TEXT[],
  suggested_post_time TIMESTAMP,
  status TEXT DEFAULT 'suggested', -- suggested, accepted, rejected, scheduled
  scheduled_post_id VARCHAR,
  ai_metadata JSONB
)
```

### Event Ingestion

**Service**: `server/services/event-ingestion.ts`

Syncs events from:
- Google Calendar (public and private)
- iCal feeds
- Event aggregators

---

## 12. SEO Optimizer

### Overview

The SEO Optimizer integrates with Google Search Console and provides AI-powered keyword analysis.

### Google Search Console Integration

**OAuth Flow**:
1. `GET /api/search-console/connect` — Start Google OAuth flow
2. `GET /api/search-console/callback` — Handle callback

**Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search-console/connect` | GET | Start Search Console OAuth |
| `/api/search-console/callback` | GET | OAuth callback |
| `/api/search-console/status` | GET | Connection status |
| `/api/search-console/sites` | GET | List verified sites |
| `/api/search-console/metrics` | GET | Get performance metrics |

### SEO Analysis

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/seo/keywords` | GET | List tracked keywords |
| `/api/seo/keywords/generate` | POST | AI-generate keyword suggestions |
| `/api/seo/analyze` | POST | Analyze content for SEO |
| `/api/seo/site-health` | GET | Site health check |

### Keyword Tracking

```sql
seo_keywords (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty INTEGER,
  last_checked TIMESTAMP,
  current_rank INTEGER,
  previous_rank INTEGER,
  neighborhood TEXT,
  created_at TIMESTAMP
)
```

### Services

- **`server/services/seo.ts`**: SEO analysis and scoring
- **`server/services/searchConsole.ts`**: Google Search Console API integration
- **`server/services/ai-keyword-generator.ts`**: AI-powered keyword research

---

## 13. BHHS Compliance System

### Overview

The BHHS Compliance System enforces brokerage-mandated marketing rules for BHHS Ambassador Real Estate agents. All content is automatically checked before publishing.

**Service**: `server/services/compliance.ts`

### Compliance Rules

| Rule | Description | Auto-Fix |
|------|-------------|----------|
| **First-Line Brokerage** | Brokerage name must appear in the first line of all posts | ✅ Prepends brokerage name |
| **Brokerage on Media** | All images/videos must include brokerage watermark | ✅ Adds watermark |
| **Brokerage in Video** | Video content must mention brokerage | ✅ Adds intro/outro |
| **Prohibited Terms** | Certain terms are banned (configurable per brokerage) | ✅ Removes/replaces |
| **Required Disclosures** | Required legal disclosures must be included | ✅ Appends disclosures |
| **Platform-Specific Rules** | Per-platform requirements (character limits, hashtag rules) | ✅ Platform-specific fixes |

### Compliance Settings

```sql
compliance_settings (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL UNIQUE,
  brokerage_name TEXT DEFAULT 'BHHS Ambassador Real Estate',
  brokerage_short_name TEXT DEFAULT 'BHHS Ambassador',
  agent_name TEXT,
  team_name TEXT,
  license_type TEXT DEFAULT 'agent',  -- agent, broker, associate_broker
  require_brokerage_in_first_line BOOLEAN DEFAULT true,
  require_brokerage_on_media BOOLEAN DEFAULT true,
  require_brokerage_in_video BOOLEAN DEFAULT true,
  auto_add_brokerage BOOLEAN DEFAULT true,
  compliance_rules JSONB,       -- { prohibitedTerms, requiredDisclosures, platformSpecificRules }
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Compliance Check Flow

```
Content Created → Compliance Service Check → Issues Found?
  ├── No Issues → Content Approved
  └── Issues Found → Auto-Fix Enabled?
        ├── Yes → Apply Fixes → Re-check → Approve
        └── No → Return Violations → Agent Reviews
```

---

## 14. Streaming Avatar

### Overview

The Streaming Avatar feature provides **real-time interactive avatar** conversations using HeyGen's streaming API.

**Service**: `server/services/heygen-streaming.ts`

### How It Works

1. Agent selects an avatar and voice
2. System opens a HeyGen streaming session
3. Agent types or speaks → text is sent to the avatar
4. Avatar responds with real-time video + audio stream
5. Useful for live presentations, client meetings, or training

### Use Cases
- Live property presentations
- Client-facing virtual assistant
- Training demonstrations
- Interactive property tours

---

## 15. WhatsApp & Twilio Chatbot

### Twilio SMS/Voice Integration

**Service**: `server/services/twilio.ts`

The Twilio integration provides AI-powered SMS and voice chatbot capabilities:

#### SMS Chatbot
- Receives incoming SMS via Twilio webhook
- Generates AI response using GPT-4o
- Sends response back via TwiML
- Captures lead information (name, email, interest)

#### Voice Chatbot
- Receives incoming calls via Twilio webhook
- Plays AI-generated greeting using Amazon Polly (Joanna voice)
- Gathers speech input via Twilio's `<Gather>` verb
- Processes speech → generates AI response
- Optionally transfers to live agent

**Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/twilio/sms` | POST | Twilio SMS webhook |
| `/api/twilio/voice` | POST | Twilio voice webhook |
| `/api/twilio/voice-input` | POST | Voice speech input handler |

#### Twilio Settings

```sql
twilio_settings (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL UNIQUE,
  phone_number TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  is_enabled BOOLEAN DEFAULT false,
  ai_greeting TEXT,
  ai_personality TEXT DEFAULT 'friendly',
  business_hours_start TEXT DEFAULT '09:00',
  business_hours_end TEXT DEFAULT '17:00',
  after_hours_message TEXT,
  capture_lead_on_first_message BOOLEAN DEFAULT true,
  ask_for_name BOOLEAN DEFAULT true,
  ask_for_email BOOLEAN DEFAULT true,
  agent_name TEXT,
  brokerage_name TEXT,
  service_areas TEXT[],
  specialties TEXT[],
  voice_greeting TEXT,
  voice_enabled BOOLEAN DEFAULT false,
  transfer_number TEXT
)
```

#### Twilio Conversations & Messages

```sql
twilio_conversations (
  id UUID, user_id, from_number, to_number,
  conversation_type TEXT DEFAULT 'sms',  -- 'sms' or 'voice'
  status TEXT DEFAULT 'active',
  lead_name, lead_email, lead_interest, lead_quality, lead_notes,
  last_message_at, created_at, converted_to_lead_at
)

twilio_messages (
  id UUID, conversation_id, twilio_message_sid,
  direction TEXT NOT NULL,           -- 'inbound' or 'outbound'
  message_type TEXT DEFAULT 'sms',   -- 'sms', 'mms', 'voice_transcript'
  body TEXT NOT NULL,
  media_urls TEXT[],
  status TEXT DEFAULT 'delivered',
  is_ai_generated BOOLEAN DEFAULT false,
  ai_model TEXT
)
```

### WhatsApp Business Integration

**Service**: `server/services/whatsapp.ts`

Uses the **Meta WhatsApp Cloud API** for business messaging.

**Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/settings` | GET | Get WhatsApp settings |
| `/api/whatsapp/settings` | POST | Update WhatsApp settings |
| `/api/whatsapp/send` | POST | Send WhatsApp message |
| `/api/whatsapp/conversations` | GET | List conversations |
| `/api/whatsapp/conversations/:id/messages` | GET | Get conversation messages |
| `/api/webhooks/whatsapp` | GET | Webhook verification (Meta challenge) |
| `/api/webhooks/whatsapp` | POST | Incoming message webhook |

#### WhatsApp Settings

```sql
whatsapp_settings (
  id UUID PRIMARY KEY,
  user_id VARCHAR NOT NULL UNIQUE,
  phone_number_id TEXT,           -- WhatsApp Cloud API phone number ID
  waba_id TEXT,                   -- WhatsApp Business Account ID
  display_phone_number TEXT,
  access_token TEXT,              -- Permanent token from Meta
  webhook_verify_token TEXT,      -- Random token for webhook verification
  is_enabled BOOLEAN DEFAULT false,
  ai_greeting TEXT,
  ai_personality TEXT DEFAULT 'friendly',
  business_hours_start TEXT DEFAULT '09:00',
  business_hours_end TEXT DEFAULT '17:00',
  after_hours_message TEXT,
  capture_lead_on_first_message BOOLEAN DEFAULT true,
  ask_for_name BOOLEAN DEFAULT true,
  ask_for_email BOOLEAN DEFAULT true,
  agent_name TEXT,
  brokerage_name TEXT,
  service_areas TEXT[],
  specialties TEXT[]
)
```

#### WhatsApp Conversations & Messages

```sql
whatsapp_conversations (
  id UUID, user_id, wa_id TEXT NOT NULL,  -- Contact's WhatsApp ID (phone)
  contact_name, status DEFAULT 'active',
  lead_name, lead_email, lead_interest, lead_quality, lead_notes,
  last_message_at, created_at, converted_to_lead_at
)

whatsapp_messages (
  id UUID, conversation_id, whatsapp_message_id TEXT,
  direction TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',  -- 'text', 'image', 'template'
  body TEXT NOT NULL,
  media_url TEXT,
  status TEXT DEFAULT 'delivered',
  is_ai_generated BOOLEAN DEFAULT false,
  ai_model TEXT
)
```

---

## 16. GoHighLevel Integration

### Status: **Planned / Not Yet Implemented**

GoHighLevel (GHL) integration is planned to provide:

1. **Instagram Posting**: Direct Instagram posting via GHL API instead of Facebook Page token approach
2. **WhatsApp Posting**: WhatsApp message sending through GHL's integration
3. **CRM Sync**: Sync leads from iMakePage engagement tracking to GHL CRM
4. **Workflow Automation**: Trigger GHL workflows from iMakePage events

This integration would replace the current Facebook Page token approach for Instagram and provide more reliable token management.

---

## 17. WebSocket Real-time Updates

### Overview

WebSocket connections enable real-time push notifications for long-running operations.

**Service**: `server/websocket.ts`  
**Path**: `/ws`  
**Connection**: `ws://host/ws?userId={userId}`

### Message Types

```typescript
type WebSocketMessageType =
  | "content_published"
  | "social_post_scheduled"
  | "notification"
  | "status_update"
  | "photo_generated"
  | "video_created"
  | "avatar_group_created"
  | "motion_added"
  | "sound_effect_added"
  | "avatar_ready"
  | "training_status_update"
  | "video_generation_complete"
  | "video_generation_failed"
  | "motion_complete"
  | "look_generation_complete"
  | "look_generation_failed";
```

### Message Format

```json
{
  "type": "video_generation_complete",
  "data": {
    "videoId": "uuid",
    "videoUrl": "https://...",
    "thumbnailUrl": "https://..."
  },
  "timestamp": "2026-02-21T12:00:00Z",
  "userId": "user_uuid",
  "link": "/dashboard"
}
```

### Connection Management

- Clients are grouped by `userId` in a `Map<string, Set<WebSocket>>`
- Multiple browser tabs from the same user receive the same notifications
- Connection requires valid `userId` parameter (guest connections rejected)
- Welcome message sent on connection: "Connected to RealtyFlow real-time updates"
- Dead connections cleaned up on close/error events

### Primary Use Cases

1. **Video Generation**: Notify when HeyGen video rendering completes (~2-13 min)
2. **Look Generation**: Notify when avatar looks are ready (~5-8 min)
3. **Avatar Training**: Real-time training progress updates
4. **Social Post Publishing**: Confirm successful platform posting
5. **Content Generation**: Notify when AI content is ready

---

## 18. API Reference

### Complete Endpoint Listing

All endpoints require JWT authentication via `extractUserId` middleware unless noted otherwise.

#### Authentication & User

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Agent login |
| GET | `/api/user/is-admin` | Check admin status |

#### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/overview` | Dashboard metrics |
| GET | `/api/openai/status` | AI provider status |

#### AI Content

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/content/generate` | Generate content |
| POST | `/api/content/social-post` | Generate social post |
| POST | `/api/content/promote-app` | Generate promotional content |
| GET | `/api/content` | List content pieces |
| POST | `/api/content/enhance` | Enhance content |
| POST | `/api/content/ai-optimized` | AI-optimized content |
| POST | `/api/content/regenerate-for-platform` | Reformat for platform |
| GET | `/api/content/suggestions` | Content suggestions |
| POST | `/api/images/generate` | Generate AI images |
| GET | `/api/images/stock` | Search stock images |
| GET | `/api/images/templates` | Image templates |

#### AI Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/chat-sessions` | List chat sessions |
| GET | `/api/ai/chat-sessions/:id` | Get chat session |
| POST | `/api/ai/chat-sessions` | Create chat session |
| PATCH | `/api/ai/chat-sessions/:id` | Update chat session |
| DELETE | `/api/ai/chat-sessions/:id` | Delete chat session |
| POST | `/api/ai/chat` | Send chat message |

#### VEO Property Tours

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/veo/start` | Start VEO generation |
| GET | `/api/ai/veo/status/:operationId` | VEO generation status |
| POST | `/api/ai/veo/combine` | Combine room segments |

#### Social Media

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/social/connect/:platform` | Start OAuth flow |
| GET | `/api/social/callback/:platform` | OAuth callback |
| GET | `/api/social/status/:platform` | Connection status |
| GET | `/api/social/accounts` | List connected accounts |
| POST | `/api/social/accounts` | Create/update account |
| GET | `/api/social/platform-scores` | Platform fit scores |

#### Facebook

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/facebook/pages` | List Facebook pages |
| POST | `/api/facebook/pages/manual` | Manual page config |
| GET | `/api/facebook/debug` | Debug token |
| GET | `/api/facebook/posts` | Recent page posts |
| GET/POST | `/api/facebook/validate` | Validate connection |

#### Instagram

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instagram/accounts` | Instagram business accounts |
| GET/POST | `/api/instagram/validate` | Validate connection |

#### Twitter/X

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/twitter/validate` | Validate connection |
| DELETE | `/api/twitter/post/:tweetId` | Delete tweet |

#### LinkedIn

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/linkedin/test` | Test connection |
| POST | `/api/linkedin/validate` | Validate connection |

#### YouTube

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/youtube` | Start OAuth |
| GET | `/auth/youtube/callback` | OAuth callback |
| GET/POST | `/api/youtube/validate` | Validate connection |

#### TikTok

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tiktok/validate` | Validate connection |
| GET | `/tiktokHZDg3yBp...` | Domain verification file |
| GET | `/tiktokf3X4X4cD...` | Domain verification file |

#### Scheduled Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduled-posts` | List scheduled posts |
| POST | `/api/scheduled-posts` | Create scheduled post |
| PUT | `/api/scheduled-posts/:id` | Full update |
| PATCH | `/api/scheduled-posts/:id` | Partial update |
| DELETE | `/api/scheduled-posts/:id` | Delete post |
| POST | `/api/scheduled-posts/bulk-delete` | Bulk delete |
| POST | `/api/scheduled-posts/:id/publish` | Publish to platform |
| POST | `/api/scheduled-posts/upload-media` | Upload post media |
| POST | `/api/scheduled-posts/update-image` | Update post image |
| POST | `/api/scheduled-posts/generate-weekly` | Generate week of content |
| POST | `/api/scheduled-posts/generate-monthly` | Generate month of content |
| POST | `/api/scheduled-posts/schedule-smart` | Smart schedule |

#### Avatars & Video

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/avatars` | List avatars |
| POST | `/api/avatars` | Create avatar |
| POST | `/api/avatars/import` | Import from HeyGen |
| GET | `/api/avatars/heygen-list` | HeyGen avatar catalog |
| GET | `/api/voices/heygen-list` | HeyGen voice catalog |
| GET | `/api/custom-voices` | User's custom voices |
| POST | `/api/custom-voices` | Upload voice sample |
| DELETE | `/api/custom-voices/:id` | Delete custom voice |
| POST | `/api/video-avatars` | Create video avatar |
| GET | `/api/video-avatars` | List video avatars |

#### Photo Avatars

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/photo-avatars/create-with-looks` | Create avatar with 4 looks |
| POST | `/api/photo-avatars/generate-video-from-image` | Generate video from image |
| GET | `/api/photo-avatars/status/:groupId` | Training status |
| GET | `/api/photo-avatars/video-status/:videoId` | Video gen status |
| GET | `/api/photo-avatars/active-jobs` | Active generation jobs |
| POST | `/api/photo-avatars/groups/:groupId/proxy-generate-look` | Generate single look |
| GET | `/api/photo-avatars/proxy/generation-status/:generationId` | Look gen status |
| POST | `/api/avatar-iv/use-look-image` | Bridge look to image_key |
| POST | `/api/avatar-iv/generate` | Generate Avatar IV video |

#### SEO

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seo/keywords` | List keywords |
| POST | `/api/seo/keywords/generate` | Generate keywords |
| POST | `/api/seo/analyze` | Analyze content |
| GET | `/api/seo/site-health` | Site health |
| GET | `/api/search-console/connect` | Start SC OAuth |
| GET | `/api/search-console/callback` | SC callback |
| GET | `/api/search-console/status` | SC status |
| GET | `/api/search-console/sites` | SC sites |
| GET | `/api/search-console/metrics` | SC metrics |

#### Market Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market/data` | Market data |
| POST | `/api/market/refresh` | Refresh market data |
| GET | `/api/market/intelligence` | Market intelligence |
| GET | `/api/ai/opportunities` | AI opportunities |

#### Content Calendar & Scheduling

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/schedule-content` | AI schedule content |
| POST | `/api/content/generate-plan` | Generate plan |

#### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| GET | `/api/templates/:templateId` | Get template |
| POST | `/api/templates` | Create template |
| POST | `/api/templates/:templateId/generate` | Generate from template |
| PUT | `/api/templates/:templateId` | Update template |
| DELETE | `/api/templates/:templateId` | Delete template |
| GET | `/api/templates/:templateId/variables` | Template variables |
| POST | `/api/templates/from-video` | Create template from video |
| POST | `/api/templates/:templateId/duplicate` | Duplicate template |
| GET | `/api/templates/real-estate` | Real estate templates |
| GET | `/api/video-templates` | Video templates |
| GET | `/api/video-templates/:id` | Get video template |

#### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/property/search` | Search properties |
| POST | `/api/property/details-by-address` | Property details |

#### Brand & Company Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/brand-guide/analyze` | Analyze brand |

#### Tutorial Videos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tutorial-videos` | List tutorials |
| DELETE | `/api/tutorial-videos/:id` | Delete tutorial |

#### Engagement Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/track/session` | Track user session |
| POST | `/api/track/property-interaction` | Track property interaction |
| POST | `/api/track/property-like` | Track property like |
| POST | `/api/track/generate-engagement-lead` | Generate engagement lead |
| GET | `/api/analytics/engagement/:agentSlug` | Engagement analytics |
| GET | `/api/analytics/leads/:agentSlug` | Lead analytics |
| GET | `/api/analytics/properties/:agentSlug` | Property analytics |
| GET | `/api/analytics/sessions/:agentSlug` | Session analytics |

#### Twilio

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/twilio/sms` | SMS webhook |
| POST | `/api/twilio/voice` | Voice webhook |
| POST | `/api/twilio/voice-input` | Voice input handler |

#### WhatsApp

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whatsapp/settings` | Get settings |
| POST | `/api/whatsapp/settings` | Update settings |
| POST | `/api/whatsapp/send` | Send message |
| GET | `/api/whatsapp/conversations` | List conversations |
| GET | `/api/whatsapp/conversations/:id/messages` | Conversation messages |
| GET | `/api/webhooks/whatsapp` | Webhook verification |
| POST | `/api/webhooks/whatsapp` | Incoming message webhook |

#### File Uploads & Storage

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/upload-placeholder` | Upload file |
| POST | `/api/upload-reference` | Upload reference |
| POST | `/api/upload/video-source` | Upload video source |
| GET | `/api/mobile-upload/:sessionId` | Mobile upload session |
| GET | `/public-objects/:filePath(*)` | Serve public object storage files |

---

## 19. External Services & Dependencies

### AI Services

| Service | Purpose | Env Variable |
|---------|---------|-------------|
| **OpenAI** | GPT-4o/GPT-5 content generation, DALL-E images, chat | `OPENAI_API_KEY` |
| **Google Gemini** | Fallback AI, VEO 3.1 video generation | `GEMINI_API_KEY` |
| **ElevenLabs** | Text-to-speech, voice cloning | `ELEVENLABS_API_KEY` |

### Video & Avatar Services

| Service | Purpose | Env Variable |
|---------|---------|-------------|
| **HeyGen** | Avatar creation, video generation (via proxy) | `HEYGEN_API_KEY` |
| **External Avatar Service** | HeyGen proxy (AWS Elastic Beanstalk) | `PHOTO_AVATAR_SERVICE_URL` |
| **Kling AI** | Image-to-video motion, lip sync | Per-user (encrypted in `brand_settings`) |

### Social Media Platforms

| Service | Purpose | Env Variables |
|---------|---------|--------------|
| **Facebook/Meta** | Page posting, Instagram Business | Per-user in `social_api_keys` |
| **Instagram** | Business account posting | Via Facebook Page token |
| **LinkedIn** | Professional network posting | Per-user in `social_api_keys` |
| **Twitter/X** | Tweet posting (OAuth 2.0 PKCE) | Per-user in `social_api_keys` |
| **YouTube** | Video upload and management | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` |
| **TikTok** | Video upload (FILE_UPLOAD method) | Per-user in `social_api_keys` |

### Communication

| Service | Purpose | Env Variables |
|---------|---------|--------------|
| **Twilio** | SMS/Voice chatbot | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| **WhatsApp (Meta)** | Business messaging | Per-user in `whatsapp_settings` |

### Storage & Infrastructure

| Service | Purpose | Env Variables |
|---------|---------|--------------|
| **AWS S3** | File storage (media, videos, voices) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` |
| **Replit Object Storage** | Platform assets | Auto-configured |
| **PostgreSQL (Neon)** | Primary database | `DATABASE_URL` |

### Analytics & SEO

| Service | Purpose | Env Variables |
|---------|---------|--------------|
| **Google Search Console** | SEO metrics | OAuth (stored per-user) |
| **Pexels** | Stock photo search | `PEXELS_API_KEY` |

### Authentication

| Service | Purpose | Env Variables |
|---------|---------|--------------|
| **JWT** | Token-based auth | `JWT_SECRET` |
| **Replit OpenID Connect** | SSO auth | Auto-configured |

---

## 20. Database Schema

### Complete Table Listing (40+ Tables)

#### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Agent accounts | id, username, password, name, email, role, is_demo |
| `public_users` | Public/website users | id, email, agent_slug, role, UNIQUE(agent_slug, email) |
| `sessions` | Session storage (Replit Auth) | sid, sess (JSONB), expire |
| `user_preferences` | AI & location preferences | user_id, ai_provider, service_area, communities, agent_photo_url, onboarding_completed |

#### Content Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `content_pieces` | AI-generated content | user_id, type, title, content, keywords, neighborhood, status |
| `ai_content` | Legacy AI content | user_id, content_type, title, content, keywords, property_id |
| `ai_chat_sessions` | Conversational AI history | user_id, title, messages (JSONB array) |
| `ai_assistant_messages` | Individual AI messages | user_id, role, content, attachments |

#### Social Media Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `social_media_accounts` | OAuth connections | user_id, platform, access_token, refresh_token, is_connected, metadata |
| `social_api_keys` | Per-user API credentials | user_id, facebook_app_id, twitter_api_key, linkedin_client_id, etc. |
| `scheduled_posts` | Content scheduling | user_id, platform, content, scheduled_for, status, seo_score, is_ai_generated |
| `social_posts` | Legacy social posts | user_id, content, platforms, status, engagement |
| `pkce_store` | OAuth 2.0 PKCE state | state (PK), code_verifier, expires_at |

#### Avatar & Video Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `avatars` | HeyGen avatars | user_id, heygen_avatar_id, avatar_type, preview_image_url |
| `photo_avatar_groups` | Avatar groups | user_id, heygen_group_id, training_status, image_hash |
| `photo_avatars` | Individual photos | group_id, photo_url, heygen_photo_id, pose_type |
| `photo_avatar_group_voices` | Group voice samples | user_id, group_id, audio_url, heygen_audio_asset_id |
| `look_generation_jobs` | Look gen tracking | user_id, group_id, heygen_generation_id, look_label, status |
| `video_avatars` | Enterprise video avatars | user_id, heygen_avatar_id, training_video_url, consent_video_url |
| `custom_voices` | Voice cloning | user_id, audio_url, heygen_voice_id, status |
| `video_content` | Generated videos | user_id, avatar_id, script, heygen_video_id, video_url, youtube_video_id |
| `video_generation_jobs` | Background video jobs | user_id, source, heygen_video_id, status, progress, notification_sent |

#### Template Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `video_templates` | Template definitions | slug, name, category, script_template, render_settings |
| `template_variables` | Template form fields | template_id, key, label, field_type, options |
| `generated_videos` | Videos from templates | user_id, template_id, variables (JSONB), heygen_video_id, video_url |

#### Media Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `media_assets` | Unified media library | user_id, type, source, url, mime_type, file_size, width, height |
| `post_media` | Post-media junction | post_id, media_id, order_index |
| `file_uploads` | Legacy file uploads | user_id, filename, mime_type, path, url |

#### SEO & Market Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `seo_keywords` | Keyword tracking | user_id, keyword, search_volume, difficulty, current_rank |
| `market_data` | Market statistics | user_id, neighborhood, avg_price, days_on_market, trend |
| `analytics` | Performance metrics | user_id, metric_type, metric_value, dimension |

#### Property & Engagement Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `properties` | MLS listings | mls_id, list_price, address, bedrooms, bathrooms, agent_id |
| `user_sessions` | Visitor sessions | session_id, public_user_id, agent_slug, device_type, total_page_views |
| `property_interactions` | User interactions | public_user_id, property_id, interaction_type, time_spent_seconds |
| `property_likes` | Property favorites | public_user_id, property_id, agent_slug |
| `engagement_leads` | Auto-generated leads | public_user_id, agent_slug, engagement_score, lead_quality |
| `content_opportunities` | AI content suggestions | user_id, opportunity_type, title, priority |

#### Event Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `event_sources` | Calendar feed sources | user_id, type, config (JSONB), last_sync_at |
| `events` | Calendar events | user_id, source_id, external_id, title, start_time, category |
| `event_post_suggestions` | AI post ideas from events | user_id, event_id, platform, content, suggested_post_time |

#### Communication Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `twilio_settings` | Per-user Twilio config | user_id, phone_number, ai_greeting, voice_enabled |
| `twilio_conversations` | SMS/Voice threads | user_id, from_number, conversation_type, lead_name |
| `twilio_messages` | Individual messages | conversation_id, direction, body, is_ai_generated |
| `whatsapp_settings` | WhatsApp config | user_id, phone_number_id, waba_id, access_token |
| `whatsapp_conversations` | WhatsApp threads | user_id, wa_id, contact_name, lead_quality |
| `whatsapp_messages` | WhatsApp messages | conversation_id, direction, message_type, body |

#### Settings Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `brand_settings` | Branding & visual identity | user_id, assets, colors, fonts, ai_provider, kling_api_key_encrypted |
| `company_profiles` | Company/agent info | user_id, company_name, agent_name, brokerage_name, license_number |
| `compliance_settings` | BHHS compliance rules | user_id, brokerage_name, require_brokerage_in_first_line, compliance_rules |
| `platform_settings` | Admin platform config | key (unique), value (JSONB) |
| `tutorial_videos` | Help/training videos | category, subcategory, title, video_url, duration |
| `user_activity` | Activity logging | user_id, action, description, metadata |

---

## 21. Environment Variables

### Required Environment Variables

#### Core

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT token signing secret |
| `SESSION_SECRET` | Express session secret |

#### AI Services

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI GPT-4o/GPT-5, DALL-E |
| `GEMINI_API_KEY` | Google Gemini / VEO 3.1 |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS |

#### AWS

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_REGION` | AWS region (e.g., `us-east-2`) |
| `S3_BUCKET_NAME` | S3 bucket for media storage |

#### Video & Avatar

| Variable | Purpose |
|----------|---------|
| `HEYGEN_API_KEY` | HeyGen API access |
| `PHOTO_AVATAR_SERVICE_URL` | External avatar service URL |

#### Social Media (Platform-Level)

| Variable | Purpose |
|----------|---------|
| `YOUTUBE_CLIENT_ID` | YouTube OAuth client ID |
| `YOUTUBE_CLIENT_SECRET` | YouTube OAuth client secret |

> Note: Most social media credentials (Facebook, Instagram, LinkedIn, Twitter, TikTok) are stored **per-user** in the `social_api_keys` database table, not as environment variables.

#### Communication

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

#### Stock Images

| Variable | Purpose |
|----------|---------|
| `PEXELS_API_KEY` | Pexels stock photo API |

#### Encryption

| Variable | Purpose |
|----------|---------|
| `ENCRYPTION_KEY` | Key for encrypting stored API keys |

---

## 22. Known Limitations & Gaps

### Not Yet Implemented

1. **GoHighLevel Integration**: Planned for Instagram DM posting and WhatsApp — not yet built.

2. **HeyGen Motion Videos**: The external reference app supports `POST /api/heygen/videos/motion` with groupId + lookId + motionId. iMakePage uses Kling AI for motion instead of HeyGen's native motion feature.

3. **Unified Avatar Library**: The reference app has `GET /api/avatars/library` combining trained avatars + generated looks. iMakePage loads looks separately from `look_generation_jobs`.

4. **HeyGen Motion Styles**: `GET /api/heygen/motions` (list available motion styles) is not implemented. Kling AI is used as the motion provider instead.

5. **Gallery Deduplication**: The reference app uses a `gallery_items` table with `upsertGalleryItemBySource()`. iMakePage uses `lookGenerationJobs` with separate inserts (no dedup logic).

6. **Richer Status Tracking**: The reference app provides:
   - `workflow_status.percent_complete` (0-100%)
   - `motion.enabled` flag
   - `ready_for_video` / `ready_for_looks` / `ready_for_motion` flags
   
   iMakePage has simpler status tracking.

7. **WebSocket Authentication**: Currently uses `userId` query parameter for connection authentication. Production should validate JWT token from cookies or headers.

8. **Streaming Avatar UI**: The streaming avatar backend service exists (`heygen-streaming.ts`) but the frontend UI integration may be limited.

9. **MLS Integration**: The MLS service (`server/services/mls.ts`) exists but live MLS feed integration is not fully documented.

10. **Post Scheduling Automation**: While smart scheduling endpoints exist, fully automated background posting (cron-based) at the scheduled time is not confirmed as active.

### Known Technical Debt

- **routes.ts Size**: At ~20,024 lines, the monolithic routes file should be split into feature-specific route files for maintainability.
- **Legacy Tables**: Several tables (`ai_content`, `social_posts`, `user_activity`, `file_uploads`) are maintained for backward compatibility but are being replaced by newer equivalents.
- **Per-User API Keys**: Social media API credentials are stored per-user in the database rather than as platform-level OAuth apps, which means each agent needs their own developer app credentials.

---

*This document was generated from a comprehensive analysis of the iMakePage codebase including `shared/schema.ts` (1,647 lines, 40+ tables), `server/routes.ts` (20,024 lines, 200+ endpoints), 30+ service modules, and all frontend page components.*
