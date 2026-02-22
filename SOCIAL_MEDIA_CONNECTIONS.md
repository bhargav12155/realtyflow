# iMakePage Social Media Connections & Posting — Complete Developer Reference

> **Last Updated:** February 22, 2026
> **Platform:** iMakePage (imakepage.com) by My Golden Brick (mygoldenbrick.com)
> **Stack:** Express.js backend, React frontend, PostgreSQL (Neon), Drizzle ORM

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Shared Infrastructure](#shared-infrastructure)
4. [Facebook](#facebook)
5. [Instagram](#instagram)
6. [X / Twitter](#x--twitter)
7. [YouTube](#youtube)
8. [LinkedIn](#linkedin)
9. [TikTok](#tiktok)
10. [Unified Posting Endpoint](#unified-posting-endpoint)
11. [Frontend Connection UI](#frontend-connection-ui)
12. [Environment Variables Reference](#environment-variables-reference)
13. [GoHighLevel](#gohighlevel)

---

## Architecture Overview

### Key Design Decisions

1. **Stable Database User IDs:** All OAuth state parameters and token storage use the stable PostgreSQL user ID (`req.user.id` cast to `String`). Earlier implementations tried converting to MemStorage UUIDs, which caused persistence issues on page refresh.

2. **Unified OAuth Route:** All platforms share a single connect endpoint (`POST /api/social/connect/:platform`) and a single callback endpoint (`GET /api/social/callback/:platform`).

3. **PKCE for Twitter & TikTok:** Both use OAuth 2.0 with PKCE (S256). Code verifiers are stored in PostgreSQL with 10-minute expiration and automatic cleanup.

4. **Instagram via Facebook Pages:** Instagram content publishing uses Facebook Graph API with Page tokens, not Instagram Business Login tokens (which don't support the `/media` content publishing endpoint).

5. **Media Resolution Priority:** `mediaIds` array > direct upload (`req.file`) > property photos > sample images.

6. **Character Limits:** Enforced per-platform before posting:
   - X/Twitter: 280
   - Facebook: 63,206
   - LinkedIn: 3,000
   - Instagram: 2,200
   - YouTube: 5,000
   - TikTok: 2,200

---

## Database Schema

### `social_media_accounts` Table

Primary table for storing all platform connections.

```sql
CREATE TABLE social_media_accounts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  platform TEXT NOT NULL,           -- 'facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  is_connected BOOLEAN DEFAULT false,
  account_username TEXT,
  metadata JSONB,                    -- Platform-specific data (pages, permissions, profile info)
  last_synced TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Drizzle Definition** (`shared/schema.ts` line 329):
```typescript
export const socialMediaAccounts = pgTable("social_media_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  platform: text("platform").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  isConnected: boolean("is_connected").default(false),
  accountUsername: text("account_username"),
  metadata: jsonb("metadata"),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### `pkce_store` Table

Stores PKCE code verifiers for Twitter and TikTok OAuth flows.

```sql
CREATE TABLE pkce_store (
  state VARCHAR PRIMARY KEY,        -- Base64-encoded JSON {userId, platform}
  code_verifier TEXT NOT NULL,       -- Random 32-byte base64url string
  expires_at TIMESTAMP NOT NULL,     -- 10 minutes after creation
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Drizzle Definition** (`shared/schema.ts` line 1209):
```typescript
export const pkceStore = pgTable("pkce_store", {
  state: varchar("state").primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Cleanup:** Expired entries are deleted every 10 minutes via `setInterval`:
```typescript
setInterval(async () => {
  const now = new Date();
  await db.delete(pkceStore).where(sql`${pkceStore.expiresAt} < ${now}`);
}, 10 * 60 * 1000);
```

### `scheduled_posts` Table

Records all posts made to social platforms.

```sql
CREATE TABLE scheduled_posts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  platform TEXT NOT NULL,
  post_type TEXT,                    -- 'open_houses', 'just_listed', 'manual_post', 'quick_test'
  content TEXT NOT NULL,
  hashtags TEXT[],
  scheduled_for TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'posted', 'cancelled'
  is_edited BOOLEAN DEFAULT false,
  original_content TEXT,
  neighborhood TEXT,
  seo_score INTEGER DEFAULT 0,
  is_ai_generated BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `social_api_keys` Table (Legacy)

Stores per-user API keys (legacy, kept for compatibility):

```sql
CREATE TABLE social_api_keys (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
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
  tiktok_access_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Shared Infrastructure

### PKCE Helper Functions

Located at `server/routes.ts` lines 75-132:

```typescript
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

async function storePKCE(state: string, codeVerifier: string, expiresInMs: number = 600000) {
  const expiresAt = new Date(Date.now() + expiresInMs);
  await db.insert(pkceStore).values({ state, codeVerifier, expiresAt })
    .onConflictDoUpdate({ target: pkceStore.state, set: { codeVerifier, expiresAt } });
}

async function retrievePKCE(state: string): Promise<{ codeVerifier: string; expiresAt: Date } | null> {
  const result = await db.select().from(pkceStore).where(eq(pkceStore.state, state)).limit(1);
  if (result.length === 0) return null;
  // Delete after retrieval (one-time use)
  await db.delete(pkceStore).where(eq(pkceStore.state, state));
  return { codeVerifier: result[0].codeVerifier, expiresAt: result[0].expiresAt };
}
```

### State Parameter Construction

All OAuth flows encode user identity into the `state` parameter:

```typescript
const state = Buffer.from(JSON.stringify({ userId, platform })).toString("base64");
```

### Base URL Resolution

```typescript
const baseUrl = process.env.BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : `https://${req.get("host")}`);
```

### Default Sample Image

```typescript
const DEFAULT_SOCIAL_SAMPLE_IMAGE =
  process.env.SOCIAL_TEST_IMAGE_URL ||
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1080&q=80";
```

---

## Facebook

### Connection Flow

#### OAuth URL Construction

**Route:** `POST /api/social/connect/:platform` (platform = "facebook")
**Middleware:** `requireAuth`

```typescript
const facebookClientId = process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID;
const facebookConfigId = process.env.FACEBOOK_CONFIG_ID;

// If config_id is set (Meta Login Configuration), use it instead of scope:
if (configId) {
  authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${facebookClientId}&redirect_uri=${redirectUri}&response_type=code&config_id=${configId}&state=${stateParam}&auth_type=rerequest`;
} else {
  // Fallback with explicit scopes:
  authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${facebookClientId}&redirect_uri=${redirectUri}&response_type=code&scope=pages_show_list,pages_manage_posts,pages_read_engagement,pages_manage_metadata&state=${stateParam}&auth_type=rerequest`;
}
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `client_id` | `FACEBOOK_CLIENT_ID` or `FACEBOOK_APP_ID` |
| `redirect_uri` | `{baseUrl}/api/social/callback/facebook` |
| `response_type` | `code` |
| `scope` | `pages_show_list,pages_manage_posts,pages_read_engagement,pages_manage_metadata` |
| `config_id` | `FACEBOOK_CONFIG_ID` (if set, replaces scope) |
| `state` | Base64 JSON `{userId, platform: "facebook"}` |
| `auth_type` | `rerequest` |

#### Callback Handling

**Route:** `GET /api/social/callback/facebook`

**Step 1: Exchange code for short-lived token**
```
GET https://graph.facebook.com/v22.0/oauth/access_token?client_id={}&redirect_uri={}&client_secret={}&code={}
```

**Step 2: Exchange for long-lived token (60 days)**
```
GET https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id={}&client_secret={}&fb_exchange_token={}
```

**Step 3: Fetch user profile**
```
GET https://graph.facebook.com/v22.0/me?fields=id,name,email&access_token={}
```

**Step 4: Fetch pages via `me/accounts`**
```
GET https://graph.facebook.com/v22.0/me/accounts?fields=id,name,category,access_token&access_token={}
```

**Step 5: Debug Token fallback (New Pages Experience)**

If `me/accounts` returns 0 pages:
```
GET https://graph.facebook.com/v22.0/debug_token?input_token={userToken}&access_token={appId}|{appSecret}
```

The response contains `granular_scopes` with `target_ids`:
```json
{
  "data": {
    "granular_scopes": [
      { "scope": "pages_show_list", "target_ids": ["123456789"] },
      { "scope": "pages_manage_posts", "target_ids": ["123456789"] }
    ]
  }
}
```

For each discovered page ID:
```
GET https://graph.facebook.com/v22.0/{pageId}?fields=id,name,category,access_token&access_token={userToken}
```

**Step 6: Fetch granted permissions**
```
GET https://graph.facebook.com/v22.0/me/permissions?access_token={}
```

**Step 7: Store in database**

What gets stored in `social_media_accounts`:
- `accessToken`: The long-lived user token
- `isConnected`: `true`
- `accountId`: Facebook profile ID or "facebook_account"
- `metadata` (JSONB):
  ```json
  {
    "profileId": "fb_user_id",
    "profileName": "User Name",
    "profileEmail": "email@example.com",
    "tokenType": "bearer",
    "expiresIn": 5184000,
    "pages": [
      {
        "id": "page_id",
        "name": "Page Name",
        "category": "Real Estate",
        "access_token": "page_access_token"
      }
    ],
    "grantedPermissions": ["pages_show_list", "pages_manage_posts", ...],
    "tokenExchangedAt": "2026-02-22T...",
    "isLongLived": true
  }
  ```

**Success Response:** HTML page with `window.opener?.postMessage({ success: true, platform: 'facebook' }, '*')` and auto-close after 2 seconds.

#### Token Refresh

Facebook long-lived tokens last ~60 days. There is no automatic refresh mechanism currently implemented. Users must reconnect when the token expires.

#### Disconnect Flow

**Route:** `POST /api/social/disconnect/facebook`
**Middleware:** `requireAuth`

Calls `storage.disconnectSocialMediaAccount(userId, "facebook")` which sets `isConnected = false` and clears tokens.

### Posting Flow

#### Facebook Page Post

**Route:** `POST /api/facebook/post`
**Middleware:** `requireAuth`, `upload.single("photo")`

**Request Body (multipart/form-data or JSON):**
```json
{
  "content": "Post text content",
  "pageId": "optional_page_id",
  "useSampleImage": false,
  "mediaUrl": "https://example.com/image.jpg"
}
```

**Token Resolution Priority:**
1. `metadata.pageAccessToken`
2. `facebookAccount.accessToken`
3. `process.env.FACEBOOK_PAGE_ACCESS_TOKEN`
4. `process.env.FACEBOOK_USER_TOKEN`

**Page ID Resolution Priority:**
1. Request body `pageId`
2. `metadata.pageId`
3. `facebookAccount.accountId`
4. `process.env.FACEBOOK_PAGE_ID`

**API Calls:**

For text-only posts:
```
POST https://graph.facebook.com/v22.0/{pageId}/feed
Content-Type: application/x-www-form-urlencoded

message={content}&access_token={pageAccessToken}
```

For photo posts:
```
POST https://graph.facebook.com/v22.0/{pageId}/photos
Content-Type: application/x-www-form-urlencoded

message={content}&url={imageUrl}&access_token={pageAccessToken}
```

**Successful Response:**
```json
{
  "success": true,
  "message": "Content posted successfully to Facebook page",
  "postId": "page_id_post_id",
  "pageId": "page_id",
  "usedSampleImage": false,
  "scheduledPostId": "uuid",
  "permalinkHint": "https://www.facebook.com/{pageId}",
  "timestamp": "2026-02-22T..."
}
```

**Error Codes:**
- `190`: Token expired → "Invalid Facebook access token. Please reconnect your Facebook account."
- `200`: Insufficient permissions → "Insufficient permissions for this page."
- `100`: Invalid parameters → "Invalid parameters. Please check your content."

> **Note:** Direct Facebook profile posting is NOT supported. The `/api/social/post` unified endpoint returns a 400 error for `platform=facebook` and directs users to use the page posting endpoint.

### Facebook Pages API

**Route:** `GET /api/facebook/pages`
**Middleware:** `requireAuth`

Returns pages from:
1. Live API call to `me/accounts`
2. Cached pages from `metadata.pages`
3. Manually added pages from `metadata.manualPages`

**Route:** `POST /api/facebook/pages/manual`
**Middleware:** `requireAuth`

**Request Body:**
```json
{
  "pageId": "123456789",
  "pageName": "Optional Page Name"
}
```

Verifies the page via:
```
GET https://graph.facebook.com/v22.0/{pageId}?fields=id,name,category,access_token&access_token={userToken}
```

Stores in `metadata.manualPages` array.

### Facebook Debug Endpoint

**Route:** `GET /api/facebook/debug`
**Middleware:** `requireAuth`

Returns comprehensive debug info:
- `me` endpoint result
- `me/permissions` result
- `me/accounts` (with tasks)
- `debug_token` result (if app ID and secret available)

### Special Cases & Edge Cases

1. **New Pages Experience:** Facebook's "New Pages Experience" causes `me/accounts` to return empty even when the user has pages. The Debug Token API (`debug_token`) is used as a fallback to discover page IDs from `granular_scopes.target_ids`.

2. **Long-lived Token Exchange:** Short-lived tokens (~1 hour) are always exchanged for long-lived tokens (~60 days) using `fb_exchange_token` grant type.

3. **Page Access Token vs User Token:** The `metadata.pages` array stores individual page access tokens. When posting, the system first tries to find the page in `me/accounts` to get its token, then falls back to fetching `/{pageId}?fields=access_token`.

4. **Multi-photo not yet supported:** When multiple `photoUrls` are provided, only the first is used. A warning is logged.

5. **Video posts not yet supported:** Video upload to Facebook pages is not implemented via the media library. Direct upload works.

---

## Instagram

### Connection Flow

#### OAuth URL Construction

**Route:** `POST /api/social/connect/:platform` (platform = "instagram")

```typescript
const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${instagramClientId}&redirect_uri=${redirectUri}&response_type=code&scope=instagram_business_basic,instagram_business_content_publish&state=${stateParam}`;
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `enable_fb_login` | `0` |
| `force_authentication` | `1` |
| `client_id` | `INSTAGRAM_CLIENT_ID` |
| `redirect_uri` | `{baseUrl}/api/social/callback/instagram` |
| `response_type` | `code` |
| `scope` | `instagram_business_basic,instagram_business_content_publish` |
| `state` | Base64 JSON `{userId, platform: "instagram"}` |

#### Callback Handling

**Route:** `GET /api/social/callback/instagram`

**Step 1: Exchange code for short-lived token**
```
POST https://api.instagram.com/oauth/access_token
Content-Type: application/x-www-form-urlencoded

client_id={}&client_secret={}&grant_type=authorization_code&redirect_uri={}&code={}
```

Response:
```json
{
  "access_token": "short_lived_token",
  "user_id": 12345678
}
```

**Step 2: Exchange for long-lived token (60 days)**
```
GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret={}&access_token={shortLivedToken}
```

Response:
```json
{
  "access_token": "long_lived_token",
  "token_type": "bearer",
  "expires_in": 5184000
}
```

**Step 3: Fetch user profile**
```
GET https://graph.instagram.com/me?fields=user_id,username,name&access_token={longLivedToken}
```

**Step 4: Store in database**

What gets stored:
- `platform`: "instagram"
- `accessToken`: Long-lived Instagram token
- `accountUsername`: `"{igUserId}:@{igUsername}"` (colon-delimited format)
- `isConnected`: `true`

### Posting Flow

#### Why Facebook Page Token is Used Instead of Instagram Business Login Token

> **Critical Design Decision:** Instagram Business Login tokens (obtained via `instagram.com/oauth/authorize`) do NOT support the Content Publishing API (`POST /{ig-user-id}/media`). This is a known Meta API limitation. To publish content to Instagram, you MUST use a Facebook Page token from a Page that has a linked Instagram Business Account.

#### Instagram Post Route

**Route:** `POST /api/instagram/post`
**Middleware:** `requireAuth`, `upload.single("photo")`

**Request Body:**
```json
{
  "content": "Caption text with #hashtags",
  "instagramBusinessAccountId": "optional_ig_business_id",
  "mediaUrl": "https://example.com/image.jpg",
  "mediaIds": ["media_library_id"]
}
```

**Token Resolution Strategy:**

1. Look up Facebook account for the user
2. Call `me/accounts` with Facebook user token, requesting `instagram_business_account` field:
   ```
   GET https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token={fbToken}
   ```
3. If `me/accounts` returns empty (New Pages Experience), use Debug Token fallback:
   ```
   GET https://graph.facebook.com/v22.0/debug_token?input_token={fbToken}&access_token={appId}|{appSecret}
   ```
   Then for each discovered page ID:
   ```
   GET https://graph.facebook.com/v22.0/{pageId}?fields=id,name,access_token,instagram_business_account{id,username}&access_token={fbToken}
   ```
4. Find first page with `instagram_business_account.id`
5. Use that page's `access_token` as the posting token
6. Fall back to direct Instagram token if no Facebook connection

**API Call — Step 1: Create Media Container**

Tries multiple endpoints in order:
1. `https://graph.facebook.com/v22.0/{igUserId}/media`
2. `https://graph.instagram.com/v22.0/{igUserId}/media`
3. `https://graph.instagram.com/v22.0/me/media`

For image posts:
```
POST https://graph.facebook.com/v22.0/{igUserId}/media
Content-Type: application/x-www-form-urlencoded

access_token={token}&caption={content}&image_url={resolvedUrl}
```

For video posts:
```
POST https://graph.facebook.com/v22.0/{igUserId}/media
Content-Type: application/x-www-form-urlencoded

access_token={token}&caption={content}&video_url={resolvedUrl}&media_type=VIDEO
```

Response:
```json
{ "id": "container_id_12345" }
```

**API Call — Step 2: Poll Container Status**

```
GET https://graph.facebook.com/v22.0/{containerId}?fields=status_code&access_token={token}
```

Polls every 3 seconds for up to 60 seconds. Status values:
- `FINISHED`: Ready to publish
- `ERROR`: Media processing failed
- `IN_PROGRESS`: Still processing

**API Call — Step 3: Publish the Container**

Tries multiple endpoints:
1. `https://graph.facebook.com/v22.0/{igUserId}/media_publish`
2. `https://graph.instagram.com/v22.0/{igUserId}/media_publish`
3. `https://graph.instagram.com/v22.0/me/media_publish`

```
POST https://graph.facebook.com/v22.0/{igUserId}/media_publish
Content-Type: application/x-www-form-urlencoded

access_token={token}&creation_id={containerId}
```

Response:
```json
{ "id": "published_post_id" }
```

**HTTPS Requirement:** Instagram requires all media URLs to be HTTPS. If the source URL is HTTP, it's proxied through:
```
{httpsBase}/api/image-proxy?url={encodedHttpUrl}
```

**Error Handling:**
- Code `190`: Session expired
- Code `100`, subcode `33`: Missing `instagram_business_content_publish` permission
- "Unsupported request": App not in Live mode or missing permissions

### Instagram Accounts Discovery

**Route:** `GET /api/instagram/accounts`
**Route:** `GET /api/instagram/account/:pageId`

Both fetch Instagram Business Account info from Facebook Pages:
```
GET https://graph.facebook.com/v22.0/{pageId}?fields=instagram_business_account{username,id}&access_token={token}
```

---

## X / Twitter

### Connection Flow

#### OAuth URL Construction

Uses **OAuth 2.0 with PKCE (S256)**.

**Route:** `POST /api/social/connect/:platform` (platform = "twitter" or "x")

```typescript
const codeVerifier = generateCodeVerifier(); // crypto.randomBytes(32).toString("base64url")
const codeChallenge = generateCodeChallenge(codeVerifier); // SHA-256 hash, base64url

// Store in PostgreSQL with 10-minute expiration
await storePKCE(state, codeVerifier, 10 * 60 * 1000);

const twitterUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/twitter")}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${encodeURIComponent(state)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `response_type` | `code` |
| `client_id` | `TWITTER_CLIENT_ID` |
| `redirect_uri` | `{baseUrl}/api/social/callback/twitter` |
| `scope` | `tweet.read tweet.write users.read offline.access` |
| `state` | URL-encoded Base64 JSON `{userId, platform}` |
| `code_challenge` | SHA-256 of code_verifier, base64url encoded |
| `code_challenge_method` | `S256` |

#### Callback Handling

**Route:** `GET /api/social/callback/twitter`

**Step 1: Retrieve and validate PKCE code verifier from database**
```typescript
const pkceData = await retrievePKCE(decodedStateString);
// Checks: exists, not expired, auto-deletes after retrieval
```

**Step 2: Exchange code for tokens**
```
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(clientId:clientSecret)}

grant_type=authorization_code&code={code}&redirect_uri={redirectUri}&code_verifier={codeVerifier}
```

Response:
```json
{
  "token_type": "bearer",
  "expires_in": 7200,
  "access_token": "...",
  "refresh_token": "...",
  "scope": "tweet.read tweet.write users.read offline.access"
}
```

**Step 3: Store in database**
- `platform`: "x"
- `accessToken`: OAuth 2.0 access token
- `refreshToken`: Refresh token (for offline access)
- `accountId`: "x_account"
- `isConnected`: `true`

### Posting Flow

**Route:** `POST /api/twitter/post`
**Middleware:** `requireAuth`, `upload.single("photo")`

**Token Retrieval:**
```typescript
// socialMedia.ts: getTwitterAccessToken(userId)
const accounts = await storage.getSocialMediaAccounts(userId);
const twitterAccount = accounts.find(acc => acc.platform === "x" || acc.platform === "twitter");
```

**API Call:**
```
POST https://api.twitter.com/2/tweets
Authorization: Bearer {accessToken}
Content-Type: application/json
User-Agent: RealEstateAI/1.0

{ "text": "Tweet content" }
```

Response:
```json
{
  "data": {
    "id": "tweet_id_12345",
    "text": "Tweet content"
  }
}
```

**Error Handling:**
- Duplicate content detection
- 403: Permission denied (missing `tweet.write`)
- 401: Token expired (reconnect needed)

**Media Upload:** NOT yet implemented. Twitter media requires a separate multi-step process:
1. Upload media to `https://upload.twitter.com/1.1/media/upload.json`
2. Get `media_id` from response
3. Attach `media_ids` array to tweet creation

If media URLs are provided, a warning is logged and a text-only tweet is posted.

### Delete Tweet

**Route:** `DELETE /api/twitter/post/:tweetId`

Uses OAuth 1.0a (legacy credentials from env vars):
```
DELETE https://api.twitter.com/2/tweets/{tweetId}
Authorization: OAuth ... (HMAC-SHA1 signed)
```

### Special Cases

1. **"Temporarily Down" Badge:** The frontend displays an amber badge "Temporarily down" next to the X/Twitter connect button (`social-media-manager.tsx` line 1384). This is a hardcoded UI indicator.

2. **Platform alias:** Twitter/X accounts are stored with `platform: "x"`. The accounts endpoint maps both "twitter" and "x" to the same account.

3. **Token Refresh:** TODO - not yet implemented. The `offline.access` scope is requested but refresh logic isn't built.

---

## YouTube

### Connection Flow

#### OAuth URL Construction

**Route:** `POST /api/social/connect/:platform` (platform = "youtube")

Also available as standalone: `GET /auth/youtube`

```typescript
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/youtube")}&scope=https://www.googleapis.com/auth/youtube.upload%20https://www.googleapis.com/auth/youtube.force-ssl&access_type=offline&state=${encodeURIComponent(state)}`;
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `response_type` | `code` |
| `client_id` | `YOUTUBE_CLIENT_ID` |
| `redirect_uri` | `{baseUrl}/api/social/callback/youtube` |
| `scope` | `https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl` |
| `access_type` | `offline` (required for refresh tokens) |
| `state` | Base64 JSON |
| `prompt` | `consent` (standalone route only) |

**Note:** The standalone `/auth/youtube` route uses slightly different scopes:
```
https://www.googleapis.com/auth/youtube
https://www.googleapis.com/auth/youtube.upload
```

#### Callback Handling

**Route:** `GET /api/social/callback/youtube`
Also: `GET /auth/youtube/callback`

**Token Exchange:**
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={code}&redirect_uri={redirectUri}&client_id={}&client_secret={}
```

Response:
```json
{
  "access_token": "...",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "...",
  "token_type": "Bearer"
}
```

**What gets stored:**
- `platform`: "youtube"
- `accessToken`: Google OAuth access token
- `refreshToken`: Google refresh token
- `accountId`: "youtube_account"
- `isConnected`: `true`

### Posting Flow

#### Video Upload

**Route:** `POST /api/youtube/post`
**Middleware:** `requireAuth`, `upload.single("video")`

**Route:** `POST /api/youtube/upload-video`
**Middleware:** `requireAuth`, `videoUpload.single("video")` (500MB limit)

**Request Body:**
```json
{
  "title": "Video Title",
  "description": "Video description",
  "content": "Alternative content for title/description",
  "accessToken": "optional_override_token"
}
```

**Video Source Resolution:**
1. Uploaded file (`req.file`)
2. `options.videoUrls[0]`
3. `videoUrl` parameter (URL or file path)
4. Sample video: `YOUTUBE_SAMPLE_VIDEO_PATH` or `uploads/videos/demo-property-tour.mp4`

**API Call — Multipart Upload:**

Video metadata:
```json
{
  "snippet": {
    "title": "Video Title",
    "description": "Description",
    "tags": ["real estate", "Omaha", "property", "home", "marketing"],
    "categoryId": "28"
  },
  "status": {
    "privacyStatus": "public",
    "selfDeclaredMadeForKids": false
  }
}
```

Upload request:
```
POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart
Authorization: Bearer {accessToken}
Content-Type: multipart/related; boundary={boundary}
Content-Length: {totalSize}

--{boundary}
Content-Type: application/json; charset=UTF-8

{videoMetadata JSON}
--{boundary}
Content-Type: video/mp4

{binary video data}
--{boundary}--
```

Response:
```json
{
  "id": "video_id_abc123",
  "snippet": { "title": "...", ... },
  "status": { "privacyStatus": "public", ... }
}
```

**Success Response:**
```json
{
  "success": true,
  "postId": "video_id_abc123",
  "watchUrl": "https://www.youtube.com/watch?v=video_id_abc123",
  "studioUrl": "https://studio.youtube.com/video/video_id_abc123/edit"
}
```

#### Community Post (Text-Only)

When no video is available, the system attempts a community post. However, **YouTube Data API v3 does not support creating Community Posts**. Instead, it verifies authentication by calling:
```
GET https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true
Authorization: Bearer {accessToken}
```

And returns a simulated success response.

### Token Refresh

YouTube provides refresh tokens via `access_type=offline`. Currently stored in `refreshToken` column but **automatic refresh is not yet implemented** in the posting flow. The standalone `/auth/youtube` route has `prompt=consent` to ensure refresh tokens are always provided.

---

## LinkedIn

### Connection Flow

#### OAuth URL Construction

**Route:** `POST /api/social/connect/:platform` (platform = "linkedin")

```typescript
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/linkedin")}&scope=openid%20profile%20email%20w_member_social&state=${encodeURIComponent(state)}`;
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `response_type` | `code` |
| `client_id` | `LINKEDIN_CLIENT_ID` |
| `redirect_uri` | `{baseUrl}/api/social/callback/linkedin` |
| `scope` | `openid profile email w_member_social` |
| `state` | URL-encoded Base64 JSON |

#### Callback Handling

**Route:** `GET /api/social/callback/linkedin`

**Token Exchange:**
```
POST https://www.linkedin.com/oauth/v2/accessToken
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={code}&redirect_uri={redirectUri}&client_id={}&client_secret={}
```

Response:
```json
{
  "access_token": "...",
  "expires_in": 5184000
}
```

**What gets stored:**
- `platform`: "linkedin"
- `accessToken`: LinkedIn OAuth token
- `accountId`: "linkedin_account"
- `isConnected`: `true`

### Posting Flow

**Route:** `POST /api/social/post` (unified endpoint, platform = "linkedin")

#### Step 1: Get User Profile (Person URN)

```
GET https://api.linkedin.com/v2/userinfo
Authorization: Bearer {accessToken}
```

Response contains `sub` field used to construct: `urn:li:person:{sub}`

#### Step 2: Upload Images (3-Step Process)

**Step 2a: Register Upload**
```
POST https://api.linkedin.com/v2/assets?action=registerUpload
Authorization: Bearer {accessToken}
Content-Type: application/json
X-Restli-Protocol-Version: 2.0.0

{
  "registerUploadRequest": {
    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
    "owner": "urn:li:person:{sub}",
    "serviceRelationships": [
      {
        "relationshipType": "OWNER",
        "identifier": "urn:li:userGeneratedContent"
      }
    ]
  }
}
```

Response provides:
- `value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl`
- `value.asset` (e.g., `urn:li:digitalmediaAsset:...`)

**Step 2b: Download image from source URL**
```
GET {imageUrl}
```

**Step 2c: Upload binary to LinkedIn**
```
PUT {uploadUrl}
Authorization: Bearer {accessToken}
Content-Type: image/jpeg
{...additional headers from LinkedIn's response...}

{binary image data}
```

#### Step 3: Create Post

```
POST https://api.linkedin.com/v2/ugcPosts
Authorization: Bearer {accessToken}
Content-Type: application/json
X-Restli-Protocol-Version: 2.0.0

{
  "author": "urn:li:person:{sub}",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": { "text": "Post content" },
      "shareMediaCategory": "IMAGE",
      "media": [
        {
          "status": "READY",
          "media": "urn:li:digitalmediaAsset:...",
          "description": { "text": "Property photo" }
        }
      ]
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

For text-only posts, `shareMediaCategory` is `"NONE"` and `media` array is omitted.

**Note:** LinkedIn video upload requires chunked upload and is **not yet implemented**. Videos fall back to text-only posts.

---

## TikTok

### Connection Flow

#### OAuth URL Construction

Uses **OAuth 2.0 with PKCE (S256)**, similar to Twitter.

**Route:** `POST /api/social/connect/:platform` (platform = "tiktok")

```typescript
const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);
await storePKCE(state, codeVerifier, 10 * 60 * 1000);

const tiktokUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${TIKTOK_CLIENT_KEY}&response_type=code&scope=user.info.basic,video.publish,video.upload&redirect_uri=${encodeURIComponent(baseUrl + "/api/social/callback/tiktok")}&state=${encodeURIComponent(state)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
```

**Parameters:**
| Parameter | Value |
|-----------|-------|
| `client_key` | `TIKTOK_CLIENT_KEY` |
| `response_type` | `code` |
| `scope` | `user.info.basic,video.publish,video.upload` |
| `redirect_uri` | `{baseUrl}/api/social/callback/tiktok` |
| `state` | URL-encoded Base64 JSON |
| `code_challenge` | SHA-256 hash, base64url |
| `code_challenge_method` | `S256` |

#### Callback Handling

**Route:** `GET /api/social/callback/tiktok`

**Step 1: Retrieve PKCE verifier from database**

**Step 2: Exchange code for tokens**
```
POST https://open.tiktokapis.com/v2/oauth/token/
Content-Type: application/x-www-form-urlencoded

client_key={}&client_secret={}&code={}&grant_type=authorization_code&redirect_uri={}&code_verifier={}
```

Response:
```json
{
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "open_id": "user_open_id",
    "expires_in": 86400,
    "refresh_expires_in": 31536000,
    "scope": "user.info.basic,video.publish,video.upload",
    "token_type": "Bearer"
  }
}
```

**Note:** TikTok nests token data inside a `data` object unlike other providers.

**What gets stored:**
- `platform`: "tiktok"
- `accessToken`: TikTok access token
- `refreshToken`: TikTok refresh token
- `accountId`: `openId` or "tiktok_account"
- `isConnected`: `true`

### Posting Flow

#### Why FILE_UPLOAD Instead of PULL_FROM_URL

TikTok's `PULL_FROM_URL` method only works with videos hosted on **verified domains** registered in the TikTok Developer portal. Since our video URLs are on Replit/S3 domains that aren't verified with TikTok, we use `FILE_UPLOAD` instead — downloading the video to a buffer and uploading it directly.

#### Video Post Flow

**Step 1: Query Creator Info**
```
POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
Authorization: Bearer {accessToken}
Content-Type: application/json; charset=UTF-8
```

Response:
```json
{
  "data": {
    "creator_username": "...",
    "creator_nickname": "...",
    "privacy_level_options": ["SELF_ONLY", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "PUBLIC_TO_EVERYONE"],
    "max_video_post_duration_sec": 300
  }
}
```

**Step 2: Download Video to Buffer**
```typescript
const videoResponse = await fetch(videoUrl);
const arrayBuffer = await videoResponse.arrayBuffer();
const videoBuffer = Buffer.from(arrayBuffer);
```

Constraints:
- Minimum: 1KB
- Maximum: 4GB

**Step 3: Initialize Video Upload**
```
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer {accessToken}
Content-Type: application/json; charset=UTF-8

{
  "post_info": {
    "title": "Video title (max 2200 chars)",
    "privacy_level": "SELF_ONLY",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 12345678,
    "chunk_size": 12345678,
    "total_chunk_count": 1
  }
}
```

Response:
```json
{
  "data": {
    "publish_id": "publish_id_abc123",
    "upload_url": "https://open-upload.tiktokapis.com/video/?upload_id=..."
  },
  "error": { "code": "ok" }
}
```

**Step 4: Upload Video Binary (Single Chunk)**
```
PUT {upload_url}
Content-Type: video/mp4
Content-Length: {videoSize}
Content-Range: bytes 0-{videoSize-1}/{videoSize}

{binary video data}
```

**Step 5: Check Post Status**
```
POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
Authorization: Bearer {accessToken}
Content-Type: application/json; charset=UTF-8

{ "publish_id": "publish_id_abc123" }
```

Response:
```json
{
  "data": {
    "status": "PROCESSING_UPLOAD"
  },
  "error": { "code": "ok" }
}
```

#### Photo Post (Alternative Method)

```
POST https://open.tiktokapis.com/v2/post/publish/content/init/
Authorization: Bearer {accessToken}
Content-Type: application/json; charset=UTF-8

{
  "post_info": {
    "title": "Photo title (max 150 chars)",
    "description": "Description (max 2200 chars)",
    "disable_comment": false,
    "privacy_level": "SELF_ONLY",
    "auto_add_music": true
  },
  "source_info": {
    "source": "PULL_FROM_URL",
    "photo_cover_index": 0,
    "photo_images": ["https://example.com/photo1.jpg", "..."]
  },
  "post_mode": "DIRECT_POST",
  "media_type": "PHOTO"
}
```

### TikTok Post Options

Available via the unified `POST /api/social/post` endpoint:
```json
{
  "platform": "tiktok",
  "content": "Video description",
  "title": "Video title",
  "privacyLevel": "SELF_ONLY",
  "disableComment": false,
  "disableDuet": false,
  "disableStitch": false
}
```

**Privacy Level Options:** `SELF_ONLY`, `MUTUAL_FOLLOW_FRIENDS`, `FOLLOWER_OF_CREATOR`, `PUBLIC_TO_EVERYONE`

---

## Unified Posting Endpoint

**Route:** `POST /api/social/post`
**Middleware:** `requireAuth`, `upload.single("photo")`

Supports both single-platform and multi-platform posting.

### Single Platform Request

```json
{
  "platform": "linkedin",
  "content": "Post text",
  "text": "Alternative to content field",
  "mediaType": "avatar|video|asset|media",
  "mediaId": "media_library_id",
  "mediaIds": ["id1", "id2"],
  "title": "For YouTube/TikTok",
  "description": "For YouTube",
  "privacyLevel": "For TikTok"
}
```

### Multi-Platform Request

```json
{
  "platforms": ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"],
  "content": "Post text",
  "text": "Alternative",
  "mediaIds": ["id1"]
}
```

### Media Resolution

The `mediaIds` array is resolved by trying each ID against multiple storage tables:

1. **Video** (`storage.getVideoById(id)`) → `videoUrls`
2. **Avatar** (`storage.getAvatarById(id)`) → `videoUrls` (if videoUrl) or `photoUrls` (if photoUrl)
3. **Media Asset** (`storage.getMediaAssetById(id)`) → `videoUrls` or `photoUrls` (based on mimeType)

Single `mediaType`/`mediaId` also supports: `"avatar"`, `"video"`, `"asset"`, `"media"`.

### Multi-Platform Response

```json
{
  "success": true,
  "message": "Posted to 3 of 4 platforms",
  "results": [
    { "platform": "linkedin", "success": true, "postId": "li_123" },
    { "platform": "instagram", "success": true, "postId": "ig_456" },
    { "platform": "youtube", "success": true, "postId": "yt_789" }
  ],
  "errors": [
    { "platform": "tiktok", "error": "TikTok requires a video." }
  ],
  "timestamp": "2026-02-22T..."
}
```

### Post Record Creation

After each successful post, a `scheduled_posts` record is created:
```typescript
await storage.createScheduledPost({
  userId: userId,
  platform: platform.toLowerCase(),
  content: postContent,
  scheduledFor: new Date(),
  status: "posted",
  postType: "manual_post",
  hashtags: postContent.match(/#\w+/g) || [],
  isEdited: false,
  originalContent: postContent,
  neighborhood: null,
});
```

A real-time WebSocket notification is also sent:
```typescript
realtimeService.notifySocialPostScheduled(userId, scheduledPost.id, platform, new Date().toISOString());
```

---

## Frontend Connection UI

### Social Media Manager Component

**File:** `client/src/components/dashboard/social-media-manager.tsx`

#### Platform Display Order
1. Facebook
2. X (Twitter) — with amber "Temporarily down" badge
3. YouTube
4. LinkedIn
5. Instagram
6. TikTok

#### Connection Flow (Frontend)

```typescript
// 1. Call connect endpoint
const response = await fetch(`/api/social/connect/${platform}`, {
  method: "POST",
  credentials: "include",
});
const data = await response.json();

// 2. Open OAuth popup
const popup = window.open(data.authUrl, `${platform}_oauth`, "width=600,height=700");

// 3. Listen for postMessage from callback
window.addEventListener("message", (event) => {
  if (event.data.success && event.data.platform === platform) {
    // Refresh accounts list
  }
});
```

#### Disconnect Flow

```typescript
await fetch(`/api/social/disconnect/${platform}`, {
  method: "POST",
  credentials: "include",
});
// Invalidates query cache for `/api/social/accounts`
```

#### Accounts Fetching

```
GET /api/social/accounts
```

Returns array of all 6 platforms with `isConnected` status.

### Facebook Page Selector Component

**File:** `client/src/components/facebook/facebook-page-selector.tsx` (237 lines)

Provides:
- Dropdown of fetched Facebook pages from `GET /api/facebook/pages`
- Manual Page ID entry fallback (for New Pages Experience where API returns empty)
- Page verification via `POST /api/facebook/pages/manual`

---

## Environment Variables Reference

### Facebook

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `FACEBOOK_CLIENT_ID` | Meta App ID | [Meta Developers](https://developers.facebook.com) → App Dashboard |
| `FACEBOOK_APP_ID` | Alternative name for App ID | Same as above |
| `FACEBOOK_CLIENT_SECRET` | Meta App Secret | App Dashboard → Settings → Basic |
| `FACEBOOK_APP_SECRET` | Alternative name | Same as above |
| `FACEBOOK_CONFIG_ID` | Meta Login Configuration ID | App Dashboard → Use Cases → Customize |
| `FACEBOOK_PAGE_ID` | Default Page ID (fallback) | Your Facebook Page → About → Page ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Preset Page token (bypass OAuth) | Graph API Explorer |
| `FACEBOOK_USER_TOKEN` | Fallback user token | Graph API Explorer |

### Instagram

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `INSTAGRAM_CLIENT_ID` | Instagram App ID (from Meta) | Meta Developers → Instagram Basic Display or Business |
| `INSTAGRAM_CLIENT_SECRET` | Instagram App Secret | Same app settings |
| `INSTAGRAM_CONFIG_ID` | Meta Login Configuration for Instagram | App Dashboard → Use Cases |
| `INSTAGRAM_ACCESS_TOKEN` | Fallback token | Graph API Explorer |
| `INSTAGRAM_USER_ID` | Fallback user ID | Graph API Explorer |

### X / Twitter

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `TWITTER_CLIENT_ID` | OAuth 2.0 Client ID | [Twitter Developer Portal](https://developer.twitter.com) |
| `TWITTER_CLIENT_SECRET` | OAuth 2.0 Client Secret | Same app settings |
| `TWITTER_CONSUMER_KEY` | OAuth 1.0a Consumer Key (for delete) | Same app, Keys & Tokens |
| `TWITTER_CONSUMER_SECRET` | OAuth 1.0a Consumer Secret | Same |
| `TWITTER_ACCESS_TOKEN` | OAuth 1.0a Access Token (for delete) | Same |
| `TWITTER_ACCESS_TOKEN_SECRET` | OAuth 1.0a Access Token Secret | Same |

### YouTube

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `YOUTUBE_CLIENT_ID` | Google OAuth Client ID | [Google Cloud Console](https://console.cloud.google.com) → Credentials |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth Client Secret | Same |
| `YOUTUBE_SAMPLE_VIDEO_PATH` | Path to demo video file | Local file system |
| `YOUTUBE_ACCESS_TOKEN` | Fallback token (validation only) | OAuth Playground |

### LinkedIn

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `LINKEDIN_CLIENT_ID` | LinkedIn App Client ID | [LinkedIn Developers](https://developer.linkedin.com) → My Apps |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn App Client Secret | Same app settings |

### TikTok

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `TIKTOK_CLIENT_KEY` | TikTok App Client Key | [TikTok Developers](https://developers.tiktok.com) |
| `TIKTOK_CLIENT_SECRET` | TikTok App Client Secret | Same app settings |

### General

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Override base URL for OAuth redirects |
| `REPLIT_DEV_DOMAIN` | Auto-set by Replit for dev environments |
| `REPLIT_DEPLOYMENT_URL` | Auto-set by Replit for deployments |
| `CLIENT_URL` | Fallback client URL |
| `SOCIAL_TEST_IMAGE_URL` | Default sample image URL for testing |

---

## Backend API Routes Summary

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/social/connect/:platform` | `requireAuth` | Generate OAuth URL for any platform |
| `GET` | `/api/social/callback/:platform` | None | OAuth callback handler (all platforms) |
| `POST` | `/api/social/disconnect/:platform` | `requireAuth` | Disconnect a platform |
| `GET` | `/api/social/accounts` | `requireAuth` | List all platform connection statuses |
| `POST` | `/api/social/accounts` | `requireAuth` | Create/update social account manually |
| `GET` | `/api/social/status/:platform` | None | Check platform connection status |
| `POST` | `/api/social/post` | `requireAuth` | Unified post endpoint (single/multi) |
| `GET` | `/api/facebook/pages` | `requireAuth` | List connected Facebook Pages |
| `POST` | `/api/facebook/pages/manual` | `requireAuth` | Add a page manually by ID |
| `GET` | `/api/facebook/debug` | `requireAuth` | Debug Facebook token and permissions |
| `POST` | `/api/facebook/post` | `requireAuth` | Post to Facebook Page |
| `GET` | `/api/facebook/posts` | None | List recent Facebook posts (mock) |
| `GET` | `/api/facebook/validate` | None | Validate Facebook connection |
| `POST` | `/api/facebook/validate` | None | Validate Facebook credentials |
| `POST` | `/api/instagram/post` | `requireAuth` | Post to Instagram |
| `GET` | `/api/instagram/accounts` | `requireAuth` | List Instagram Business Accounts |
| `GET` | `/api/instagram/account/:pageId` | `requireAuth` | Get IG Business Account for a Page |
| `GET` | `/api/instagram/validate` | None | Validate Instagram connection |
| `POST` | `/api/instagram/validate` | None | Validate Instagram credentials |
| `POST` | `/api/twitter/post` | `requireAuth` | Post a tweet |
| `DELETE` | `/api/twitter/post/:tweetId` | None | Delete a tweet |
| `GET` | `/api/twitter/validate` | None | Validate Twitter connection |
| `POST` | `/api/twitter/validate` | None | Validate Twitter credentials |
| `POST` | `/api/youtube/post` | `requireAuth` | Post to YouTube (video or community) |
| `POST` | `/api/youtube/upload-video` | `requireAuth` | Upload video to YouTube |
| `GET` | `/api/youtube/validate` | None | Validate YouTube connection |
| `POST` | `/api/youtube/validate` | None | Validate YouTube credentials |
| `GET` | `/auth/youtube` | None | Standalone YouTube OAuth initiation |
| `GET` | `/auth/youtube/callback` | None | Standalone YouTube OAuth callback |
| `POST` | `/api/linkedin/validate` | None | Validate LinkedIn credentials |
| `POST` | `/api/tiktok/validate` | None | Validate TikTok credentials |

---

## Validation Endpoints

Each platform has `GET` and/or `POST` validation endpoints that check if credentials are valid. The `GET` versions test stored/environment tokens against the platform API. The `POST` versions validate user-provided credentials.

---

## GoHighLevel

**Status:** No GoHighLevel integration exists in the codebase. No code references to "GoHighLevel", "gohighlevel", or "highlevel" were found anywhere in the project.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/routes.ts` | All OAuth routes, callback handlers, posting endpoints, validation endpoints |
| `server/services/socialMedia.ts` | `SocialMediaService` class with all platform-specific posting logic |
| `shared/schema.ts` | Database table definitions (Drizzle ORM) |
| `server/storage.ts` | Storage interface with CRUD operations for social accounts |
| `client/src/components/dashboard/social-media-manager.tsx` | Frontend connection/disconnect UI |
| `client/src/components/facebook/facebook-page-selector.tsx` | Facebook Page selection dropdown with manual entry |
