# Aiseo - Complete System Architecture

## High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL APPLICATIONS                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐      ┌──────────────────────┐                │
│  │  Açaí Freeman App    │      │   Other Apps         │                │
│  │  (Parent App)        │      │   (Future)           │                │
│  │                      │      │                      │                │
│  │ • User Login         │      │ • CRM Systems        │                │
│  │ • Profile Mgmt       │      │ • Analytics Tools    │                │
│  │ • Data Storage       │      │ • Dashboards         │                │
│  └──────────────┬───────┘      └──────────┬───────────┘                │
│                │                          │                            │
│                └──────────────┬───────────┘                            │
│                               │ (User Data)                            │
│                         ┌─────▼──────┐                                 │
│                         │ localStorage│ OR postMessage OR URL params    │
│                         │aiseo_user │                                │
│                         └─────┬──────┘                                 │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                ┌─────────────────▼──────────────────┐
                │   AISEO APP (This Application)   │
                └──────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
    ┌───▼────┐            ┌───────▼────────┐       ┌───────▼────────┐
    │FRONTEND│            │    BACKEND     │       │    DATABASE    │
    │ LAYER  │            │    LAYER       │       │    LAYER       │
    └────────┘            └────────────────┘       └────────────────┘
        │                         │                         │
```

---

## Frontend Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React + TypeScript)              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         App.tsx / Main Entry Point                      │    │
│  │  ├─ AppInitializer Wrapper                             │    │
│  │  └─ Router Setup (Wouter)                              │    │
│  └────────────┬────────────────────────────────────────────┘    │
│               │                                                  │
│  ┌────────────▼────────────────────────────────────────────┐    │
│  │    AppInitializer Component                            │    │
│  │    ├─ Check localStorage for user                      │    │
│  │    ├─ Redirect to /login if no user                    │    │
│  │    ├─ Fetch /api/user/social-api-keys                  │    │
│  │    ├─ Show SocialKeysOnboarding if needed              │    │
│  │    └─ Render children (Dashboard)                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │    Components                                           │    │
│  │                                                         │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │ SocialKeysOnboarding                            │   │    │
│  │  │ ├─ Tabbed Interface (6 platforms)              │   │    │
│  │  │ ├─ Input Fields for Credentials                │   │    │
│  │  │ ├─ "Skip for Now" Button                        │   │    │
│  │  │ └─ "Save API Keys" Button                       │   │    │
│  │  │    └─ POST /api/user/social-api-keys           │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  │                                                         │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │ Dashboard                                       │   │    │
│  │  │ ├─ Social Media Manager                         │   │    │
│  │  │ ├─ Content Generator                           │   │    │
│  │  │ ├─ Analytics                                   │   │    │
│  │  │ └─ Settings                                    │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │    Hooks                                                │    │
│  │                                                         │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │ useAiseoUser()                                │   │    │
│  │  │ ├─ Detects user from:                          │   │    │
│  │  │ │  ├─ localStorage ('aiseo_user')            │   │    │
│  │  │ │  ├─ URL params (?user=base64)                │   │    │
│  │  │ │  └─ postMessage events                       │   │    │
│  │  │ ├─ Returns { user, isLoading, logout }         │   │    │
│  │  │ └─ Persistent across page reloads              │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express + TypeScript)                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ server/index.ts                                          │   │
│  │ ├─ Express App Setup                                     │   │
│  │ ├─ Middleware (CORS, JSON, Auth)                        │   │
│  │ ├─ registerRoutes(app)                                  │   │
│  │ └─ Listen on Port 5000                                  │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │                                               │
│  ┌──────────────▼───────────────────────────────────────────┐   │
│  │ server/routes.ts - Route Registration                    │   │
│  │ ├─ app.use('/api/auth', authRoutes)                      │   │
│  │ ├─ app.use('/api/user', userRoutes)                      │   │
│  │ └─ app.use('/api/[other]', [other]Routes)               │   │
│  └──────────────┬───────────────────────────────────────────┘   │
│                 │                                               │
│  ┌──────────────▼───────────────────────────────────────────┐   │
│  │ server/routes/user/ - User Routes                        │   │
│  │ ├─ index.ts (Router setup)                               │   │
│  │ ├─ settings.ts (User settings endpoints)                 │   │
│  │ ├─ social-links.ts (Social profile URLs)                 │   │
│  │ └─ social-api-keys.ts (API key management)               │   │
│  │    ├─ GET /api/user/social-api-keys                      │   │
│  │    │  ├─ Auth check (requireAuth middleware)             │   │
│  │    │  ├─ Query: SELECT from socialApiKeys WHERE userId   │   │
│  │    │  └─ Return masked keys                              │   │
│  │    │                                                     │   │
│  │    └─ POST /api/user/social-api-keys                     │   │
│  │       ├─ Auth check (requireAuth middleware)             │   │
│  │       ├─ Validate request body                           │   │
│  │       ├─ Encrypt secrets                                 │   │
│  │       ├─ INSERT/UPDATE database                          │   │
│  │       └─ Return { success: true }                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                 │                                               │
│  ┌──────────────▼───────────────────────────────────────────┐   │
│  │ server/middleware/                                       │   │
│  │ ├─ auth.ts                                               │   │
│  │ │  ├─ requireAuth: Check JWT token                       │   │
│  │ │  ├─ extractUser: Get user from JWT                     │   │
│  │ │  └─ Attach req.user                                    │   │
│  │ └─ error.ts: Error handling                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                 │                                               │
│  ┌──────────────▼───────────────────────────────────────────┐   │
│  │ server/services/                                         │   │
│  │ ├─ socialMedia.ts (Social posting logic)                 │   │
│  │ ├─ openai.ts (AI features)                               │   │
│  │ └─ [other services]                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                 │                                               │
│  ┌──────────────▼───────────────────────────────────────────┐   │
│  │ server/db.ts                                             │   │
│  │ ├─ Drizzle ORM Setup                                     │   │
│  │ ├─ Database Connection Pool                              │   │
│  │ └─ Query Interface                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```
┌──────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Table: users                                              │  │
│  │ ├─ id (PK)                                                │  │
│  │ ├─ username (UNIQUE)                                      │  │
│  │ ├─ email                                                  │  │
│  │ ├─ name                                                   │  │
│  │ ├─ password (hashed)                                      │  │
│  │ ├─ role                                                   │  │
│  │ ├─ facebookUrl                                            │  │
│  │ ├─ instagramUrl                                           │  │
│  │ ├─ linkedinUrl                                            │  │
│  │ ├─ xUrl                                                   │  │
│  │ ├─ youtubeUrl                                             │  │
│  │ ├─ tiktokUrl                                              │  │
│  │ ├─ created_at (DEFAULT NOW())                             │  │
│  │ └─ updated_at                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                  ▲                                               │
│                  │ (1 to many)                                   │
│                  │                                               │
│  ┌───────────────┴───────────────────────────────────────────┐  │
│  │ Table: social_api_keys (NEW)                              │  │
│  │ ├─ id (PK) UUID                                           │  │
│  │ ├─ user_id (FK → users.id)                                │  │
│  │ │                                                         │  │
│  │ ├─ facebook_app_id TEXT                                   │  │
│  │ ├─ facebook_app_secret TEXT (encrypted)                   │  │
│  │ │                                                         │  │
│  │ ├─ instagram_token TEXT (encrypted)                       │  │
│  │ ├─ instagram_business_account_id TEXT                     │  │
│  │ │                                                         │  │
│  │ ├─ tiktok_api_key TEXT (encrypted)                        │  │
│  │ ├─ tiktok_api_secret TEXT (encrypted)                     │  │
│  │ ├─ tiktok_access_token TEXT (encrypted)                   │  │
│  │ │                                                         │  │
│  │ ├─ twitter_api_key TEXT (encrypted)                       │  │
│  │ ├─ twitter_api_secret TEXT (encrypted)                    │  │
│  │ ├─ twitter_access_token TEXT (encrypted)                  │  │
│  │ ├─ twitter_access_token_secret TEXT (encrypted)           │  │
│  │ ├─ twitter_bearer_token TEXT (encrypted)                  │  │
│  │ │                                                         │  │
│  │ ├─ youtube_api_key TEXT (encrypted)                       │  │
│  │ ├─ youtube_channel_id TEXT                                │  │
│  │ │                                                         │  │
│  │ ├─ linkedin_access_token TEXT (encrypted)                 │  │
│  │ ├─ linkedin_organization_id TEXT                          │  │
│  │ │                                                         │  │
│  │ ├─ keys_configured BOOLEAN DEFAULT false                  │  │
│  │ ├─ created_at TIMESTAMP DEFAULT NOW()                     │  │
│  │ ├─ updated_at TIMESTAMP DEFAULT NOW()                     │  │
│  │ └─ last_updated TIMESTAMP DEFAULT NOW()                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Other tables...]                                         │  │
│  │ ├─ content_pieces                                         │  │
│  │ ├─ scheduled_posts                                        │  │
│  │ ├─ social_media_accounts                                  │  │
│  │ └─ ...                                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### 1. User Login Flow

```
Parent App (Açaí Freeman)
    │
    ├─ User enters credentials
    │
    ├─ Validate credentials
    │
    ├─ JWT token generated
    │
    ├─ User data stored in localStorage:
    │  localStorage.setItem('aiseo_user', JSON.stringify(userData))
    │
    └─ Redirect to Aiseo: window.open('https://aiseo.com')

                        ↓

Aiseo App
    │
    ├─ Page loads (App.tsx)
    │
    ├─ AppInitializer component mounts
    │
    ├─ Check localStorage.getItem('aiseo_user')
    │
    ├─ User found!
    │  ├─ Set user context
    │  │
    │  └─ useAiseoUser hook returns { user, isLoading: false }
    │
    ├─ Fetch GET /api/user/social-api-keys
    │  ├─ JWT from cookies/Authorization header
    │  ├─ Backend validates JWT
    │  └─ Returns: { configured: false, ... }
    │
    ├─ Keys NOT configured
    │  └─ Show SocialKeysOnboarding modal
    │
    └─ Render children (Dashboard inside AppInitializer)
```

### 2. API Keys Setup Flow

```
User sees onboarding modal
    │
    ├─ Tabs: Facebook, Instagram, TikTok, Twitter, YouTube, LinkedIn
    │
    ├─ User fills Facebook tab:
    │  ├─ Facebook App ID:     "12345..."
    │  ├─ Facebook App Secret: "secret..."
    │  └─ No other tabs filled
    │
    ├─ User clicks "Save API Keys" button
    │  ├─ setIsLoading(true)
    │  │
    │  ├─ Prepare payload:
    │  │  {
    │  │    facebookAppId: "12345...",
    │  │    facebookAppSecret: "secret...",
    │  │    instagramToken: "",
    │  │    ... (other platforms empty)
    │  │  }
    │  │
    │  ├─ POST to /api/user/social-api-keys with JWT
    │  │
    │  └─ Backend:
    │     ├─ Verify JWT
    │     ├─ Extract userId from JWT
    │     ├─ Check: Does socialApiKeys record exist for this user?
    │     │  ├─ YES → UPDATE
    │     │  └─ NO → INSERT
    │     ├─ Encrypt secrets before storing
    │     │  facebookAppSecret → encrypted
    │     ├─ Set keys_configured = true
    │     ├─ INSERT/UPDATE in database
    │     └─ Return { success: true, configured: true }
    │
    ├─ Frontend receives response
    │  ├─ Show toast: "Your social media keys have been saved!"
    │  ├─ setIsLoading(false)
    │  └─ Close modal: onOpenChange(false)
    │
    └─ Dashboard appears
       ├─ User can see all features
       ├─ Social posting features available
       └─ AppInitializer doesn't show modal again
```

### 3. Social Posting with API Keys

```
User on Dashboard
    │
    ├─ Clicks "Post to Facebook"
    │
    ├─ Component calls checkApiKeys()
    │  ├─ GET /api/user/social-api-keys
    │  ├─ Backend returns { facebook: { configured: true }, ... }
    │  └─ Component checks: keys.facebook.configured === true
    │
    ├─ Keys configured! ✅
    │  └─ Show posting form
    │
    ├─ User enters content and clicks "Post"
    │  │
    │  ├─ POST to /api/social/post/facebook
    │  │  ├─ Include JWT token
    │  │  ├─ Include post content
    │  │  └─ Request body: { content: "Hello world" }
    │  │
    │  └─ Backend:
    │     ├─ Verify JWT
    │     ├─ Get socialApiKeys from database WHERE user_id = userId
    │     ├─ Decrypt facebookAppSecret
    │     ├─ Use credentials to call Facebook Graph API
    │     ├─ Parse response
    │     ├─ Log post info to database
    │     └─ Return { success: true, postId: "..." }
    │
    └─ Frontend shows success message
       └─ Post appears on Facebook! 🎉
```

---

## Security Architecture

```
┌──────────────────────────────────────────────────────────┐
│              SECURITY LAYERS                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Network Security                              │
│  ├─ HTTPS/TLS for all communication                     │
│  ├─ Secure cookies (HttpOnly, Secure flags)             │
│  └─ CORS properly configured                            │
│                                                          │
│  Layer 2: Authentication                                │
│  ├─ JWT tokens issued after login                       │
│  ├─ Token validation on every request                   │
│  ├─ requireAuth middleware                              │
│  └─ Token expiration (default: 24 hours)                │
│                                                          │
│  Layer 3: Authorization                                 │
│  ├─ Users can only access their own data                │
│  ├─ Query filter: WHERE user_id = req.user.id           │
│  └─ Role-based access control (future)                  │
│                                                          │
│  Layer 4: Data Encryption                               │
│  ├─ Secrets encrypted in database using:                │
│  │  ├─ Node.js crypto module                            │
│  │  ├─ AES-256-GCM algorithm                            │
│  │  └─ Encryption key from .env                         │
│  ├─ Keys never logged                                   │
│  └─ Decryption only at point of use                     │
│                                                          │
│  Layer 5: API Response Masking                          │
│  ├─ GET /api/user/social-api-keys returns MASKED keys   │
│  │  ├─ facebookAppId: "1234..."                         │
│  │  ├─ instagramToken: "***configured***"               │
│  │  └─ Full secrets never in response                   │
│  └─ Prevents accidental secret exposure                 │
│                                                          │
│  Layer 6: Input Validation                              │
│  ├─ Zod schemas for type validation                     │
│  ├─ Length/format checks on credentials                 │
│  └─ Sanitization before storage                         │
│                                                          │
│  Layer 7: Audit & Monitoring                            │
│  ├─ Log all API key access attempts                     │
│  ├─ Monitor failed authentication                       │
│  └─ Alert on suspicious activity                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Component Interaction Map

```
                    ┌─────────────────────┐
                    │   App Component     │
                    │   (Entry Point)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ AppInitializer      │
                    │                     │
                    │ • Check user        │
                    │ • Check API keys    │
                    │ • Show/hide modal   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────▼─────┐    ┌──────▼──────┐  ┌────▼──────┐
        │SocialKeys │    │  Dashboard  │  │   Login   │
        │Onboarding │    │             │  │           │
        │Modal      │    │ • Content   │  │  (Redirect)
        │           │    │ • Social    │  │           │
        │ • Tabs    │    │ • Analytics │  └───────────┘
        │ • Forms   │    │ • Settings  │
        │ • Save    │    └─────┬───────┘
        │ • Skip    │          │
        └─────┬─────┘    ┌─────▼────────┐
              │           │ Settings     │
              │           │ Page         │
              │           │              │
              │           │ • Update     │
              │           │   API Keys   │
              │           │ • Manage     │
              │           │   Accounts   │
              │           └──────────────┘
              │
       ┌──────▼──────────────────────┐
       │  useAiseoUser Hook        │
       │                             │
       │ • Detect user from:         │
       │   ├─ localStorage           │
       │   ├─ URL params             │
       │   └─ postMessage            │
       │                             │
       │ • Return { user, ... }      │
       └─────────────────────────────┘
```

---

## State Management Flow

```
Global App State
    │
    ├─ User Context
    │  ├─ id, email, name
    │  ├─ sourceApp
    │  └─ Loaded from localStorage via useAiseoUser()
    │
    ├─ Auth State
    │  ├─ JWT token (in cookies)
    │  └─ isAuthenticated (boolean)
    │
    └─ Social Keys State
       ├─ Stored in database (encrypted)
       ├─ Checked via GET /api/user/social-api-keys
       ├─ Updated via POST /api/user/social-api-keys
       └─ Masked in API responses

Component Local State
    │
    ├─ SocialKeysOnboarding
    │  └─ keys: { facebookAppId, instagramToken, ... }
    │
    ├─ Dashboard
    │  ├─ activeView
    │  ├─ isGenerating
    │  └─ showSocialLinksPrompt
    │
    └─ UserMenu
       └─ isDropdownOpen
```

---

## Error Handling Flow

```
Error Occurs
    │
    ├─ Frontend Error
    │  ├─ Try-catch block catches error
    │  ├─ Log to console (development)
    │  ├─ Send to error tracking (production)
    │  └─ Show user-friendly toast notification
    │
    ├─ Network Error
    │  ├─ Retry mechanism (with exponential backoff)
    │  ├─ Show "Connection lost" message
    │  └─ Offer "Try again" button
    │
    ├─ Authentication Error (401)
    │  ├─ Redirect to /login
    │  ├─ Clear JWT token
    │  ├─ Clear localStorage
    │  └─ Show "Session expired" message
    │
    ├─ Authorization Error (403)
    │  ├─ Show "You don't have permission" message
    │  └─ Log unauthorized access attempt
    │
    ├─ Backend Error
    │  ├─ Express error handler catches
    │  ├─ Log error with context
    │  ├─ Return JSON error response
    │  │  { error: "message", status: 500 }
    │  └─ Frontend receives and displays
    │
    └─ Database Error
       ├─ Try-catch in route handler
       ├─ Log with query context
       ├─ Return 500 status
       └─ Frontend shows generic error message
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  DEPLOYMENT ENVIRONMENT                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ CDN (Content Delivery Network)                     │    │
│  │ ├─ Static assets (CSS, JS, images)                │    │
│  │ ├─ Cached for performance                         │    │
│  │ └─ Geographic distribution                        │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                        │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ Load Balancer                                      │    │
│  │ ├─ Route traffic to multiple servers              │    │
│  │ ├─ Health checks                                  │    │
│  │ └─ SSL/TLS termination                            │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                        │
│      ┌────────────┼────────────┐                           │
│      │            │            │                           │
│  ┌───▼───┐   ┌────▼────┐  ┌───▼───┐                       │
│  │Server │   │ Server  │  │Server │                       │
│  │ 1     │   │   2     │  │  3    │                       │
│  │       │   │         │  │       │                       │
│  │Node.js│   │Node.js  │  │Node.js│                       │
│  │+Exp   │   │+Exp     │  │+Exp   │                       │
│  └───┬───┘   └────┬────┘  └───┬───┘                       │
│      │            │            │                           │
│      └────────────┼────────────┘                           │
│                   │                                        │
│      ┌────────────▼────────────┐                           │
│      │ Database Connection Pool│                           │
│      │ (Neon PostgreSQL)       │                           │
│      │ ├─ Primary DB           │                           │
│      │ ├─ Read replicas        │                           │
│      │ └─ Backup instances     │                           │
│      └─────────────────────────┘                           │
│                                                             │
│      ┌─────────────────────────┐                           │
│      │ Redis Cache (optional)  │                           │
│      │ ├─ Session storage      │                           │
│      │ ├─ Rate limiting        │                           │
│      │ └─ API response cache   │                           │
│      └─────────────────────────┘                           │
│                                                             │
│      ┌─────────────────────────┐                           │
│      │ Monitoring & Logging    │                           │
│      │ ├─ Application logs     │                           │
│      │ ├─ Error tracking       │                           │
│      │ ├─ Performance metrics  │                           │
│      │ └─ Security audit logs  │                           │
│      └─────────────────────────┘                           │
│                                                             │
│      ┌─────────────────────────┐                           │
│      │ Backup & Recovery       │                           │
│      │ ├─ Daily backups        │                           │
│      │ ├─ Point-in-time recovery
│      │ └─ Disaster recovery    │                           │
│      └─────────────────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

This comprehensive architecture ensures:
✅ Scalability
✅ Security
✅ Reliability
✅ Performance
✅ Maintainability
✅ User Experience
