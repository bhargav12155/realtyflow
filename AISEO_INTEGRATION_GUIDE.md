# Aiseo App - Social Media API Keys Integration Guide

## Overview

Aiseo is now fully configured to receive user data from the parent app (Açaí Freeman) and manage social media API keys in an optional onboarding flow. Users can skip the setup and use the app without social features initially, then configure keys when needed.

---

## Architecture

```
┌──────────────────────────────────┐
│   Parent App (Açaí Freeman)      │
│  - User authentication           │
│  - User profile management       │
│  - Passes user data to Aiseo   │
└────────────────────┬─────────────┘
                     │
        ┌────────────▼──────────────┐
        │  User Data Transfer       │
        │  (localStorage/postMessage│
        │   /URL params)            │
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────────────────┐
        │   AISEO APP (This App)             │
        │                                      │
        │  1. Detect User → Skip login        │
        │  2. Check API Keys Config           │
        │  3. Show Onboarding Modal           │
        │     (if keys not configured)        │
        │  4. User can:                       │
        │     - Setup all social keys         │
        │     - Skip for now (use app anyway) │
        │     - Configure later in settings   │
        │  5. Keys only required when:        │
        │     - Posting to social platforms   │
        │     - Using social features         │
        └────────────────────────────────────┘
```

---

## File Structure

### Backend Files Created

```
server/routes/user/
├── index.ts                    (MODIFIED - registers social-api-keys route)
├── social-links.ts            (existing social links)
├── social-api-keys.ts         (NEW - API key management endpoint)
└── settings.ts

server/
└── db.ts                       (connects to Drizzle ORM)

shared/
└── schema.ts                   (MODIFIED - added socialApiKeys table)
```

### Frontend Files Created

```
client/src/components/auth/
├── social-keys-onboarding.tsx  (NEW - modal for API key setup)
└── app-initializer.tsx         (NEW - app initialization logic)

client/src/hooks/
└── useAiseoUser.ts          (NEW - user persistence hook)
```

### Database Schema

```sql
CREATE TABLE social_api_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),

  -- Facebook
  facebook_app_id TEXT,
  facebook_app_secret TEXT (encrypted),

  -- Instagram
  instagram_token TEXT (encrypted),
  instagram_business_account_id TEXT,

  -- TikTok
  tiktok_api_key TEXT (encrypted),
  tiktok_api_secret TEXT (encrypted),
  tiktok_access_token TEXT (encrypted),

  -- Twitter/X
  twitter_api_key TEXT (encrypted),
  twitter_api_secret TEXT (encrypted),
  twitter_access_token TEXT (encrypted),
  twitter_access_token_secret TEXT (encrypted),
  twitter_bearer_token TEXT (encrypted),

  -- YouTube
  youtube_api_key TEXT (encrypted),
  youtube_channel_id TEXT,

  -- LinkedIn
  linkedin_access_token TEXT (encrypted),
  linkedin_organization_id TEXT,

  -- Status
  keys_configured BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW()
);
```

---

## How It Works

### 1. User Data Transfer from Parent App

The parent app (Açaí Freeman) passes user data to Aiseo using ONE of these methods:

#### Method A: localStorage (Recommended)

```typescript
// In parent app, after user logs in:
localStorage.setItem(
  "aiseo_user",
  JSON.stringify({
    id: "user123",
    email: "ananya@example.com",
    name: "Ananya Sharma",
    sourceApp: "acai-freeman",
    // any other user data
  })
);

// Then redirect/open Aiseo app
window.open("https://aiseo-app.com", "_blank");
```

#### Method B: URL Parameters

```typescript
const userData = {
  id: "user123",
  email: "ananya@example.com",
  name: "Ananya Sharma",
};

const encodedUser = btoa(JSON.stringify(userData));
window.open(`https://aiseo-app.com?user=${encodedUser}`, "_blank");
```

#### Method C: postMessage (For iframes)

```typescript
// In parent app:
const vineelWindow = document.querySelector(
  'iframe[name="aiseo"]'
).contentWindow;

vineelWindow.postMessage(
  {
    type: "AISEO_USER",
    user: {
      id: "user123",
      email: "ananya@example.com",
      name: "Ananya Sharma",
    },
  },
  "*"
);
```

---

### 2. App Initialization Flow

**File: `client/src/components/auth/app-initializer.tsx`**

```typescript
// On app load:
1. Check localStorage.getItem('aiseo_user')
2. If no user:
   - Redirect to /login
3. If user exists:
   - Check GET /api/user/social-api-keys
   - If keys not configured:
     - Show SocialKeysOnboarding modal
   - If keys configured:
     - Show dashboard normally
```

---

### 3. Social Keys Onboarding Modal

**File: `client/src/components/auth/social-keys-onboarding.tsx`**

The modal presents tabs for each social platform:

```
┌─────────────────────────────────────────────────┐
│ Setup Social Media Integration                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Facebook] [Instagram] [TikTok] [X] [YouTube] │
│                                                 │
│ Facebook Tab (shown):                           │
│ ├─ Facebook App ID:     [________________]      │
│ ├─ Facebook App Secret: [________________]      │
│ └─ Help link to Facebook developers console    │
│                                                 │
│ [Skip for Now]  [Save API Keys]                │
└─────────────────────────────────────────────────┘
```

**User Options:**

1. **Save API Keys**

   - Fills in at least one platform
   - Posts to `/api/user/social-api-keys`
   - Keys encrypted & stored in database
   - Modal closes, dashboard loads

2. **Skip for Now**
   - Modal closes
   - User can use app without social features
   - Can configure keys later in settings

---

### 4. Backend API Endpoints

#### GET `/api/user/social-api-keys`

Retrieve user's API key configuration status (masked for security)

**Response:**

```json
{
  "configured": true,
  "facebook": {
    "configured": true,
    "appIdMasked": "1234..."
  },
  "instagram": {
    "configured": false,
    "tokenMasked": null
  },
  "tiktok": {
    "configured": true,
    "apiKeyMasked": "5678..."
  }
  // ... other platforms
}
```

#### POST `/api/user/social-api-keys`

Save/update user's API keys

**Request Body:**

```json
{
  "facebookAppId": "123456789",
  "facebookAppSecret": "your_secret",
  "instagramToken": "ig_token",
  "tiktokApiKey": "tiktok_key",
  "tiktokApiSecret": "tiktok_secret",
  "twitterApiKey": "twitter_key",
  "twitterApiSecret": "twitter_secret",
  "youtubeApiKey": "youtube_key",
  "linkedinAccessToken": "linkedin_token"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Social API keys saved successfully",
  "configured": true
}
```

---

## User Hook: `useAiseoUser()`

**File: `client/src/hooks/useAiseoUser.ts`**

Hook for managing user data in components:

```typescript
import { useAiseoUser } from "@/hooks/useAiseoUser";

export function MyComponent() {
  const { user, isLoading, logout } = useAiseoUser();

  if (isLoading) return <div>Loading user...</div>;

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p>Email: {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Supports:**

- Auto-detection from localStorage
- Auto-detection from URL params
- Auto-detection from postMessage events
- Manual logout

---

## Integration Steps

### Step 1: Install & Build

```bash
npm install
npm run build
npm start
```

### Step 2: Pass User Data from Parent App

From Açaí Freeman app:

```typescript
// After user logs in:
localStorage.setItem(
  "aiseo_user",
  JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    sourceApp: "acai-freeman",
  })
);

// Navigate to Aiseo
window.location.href = "https://aiseo-app.com";
```

### Step 3: Test the Flow

1. User logs into Açaí Freeman
2. User gets redirected to Aiseo
3. Aiseo detects user from localStorage
4. Aiseo shows API keys onboarding modal
5. User can:
   - Fill in API keys and save → Dashboard loads with social features
   - Click "Skip for Now" → Dashboard loads without social features
6. User can access settings later to configure keys

### Step 4: API Keys Validation

When user tries to post to social media:

```typescript
// In social posting component:
const checkApiKeys = async () => {
  const response = await fetch("/api/user/social-api-keys", {
    credentials: "include",
  });
  const keys = await response.json();

  if (!keys.facebook.configured) {
    // Show modal: "Please setup Facebook keys first"
    return false;
  }

  // Proceed with posting
  return true;
};
```

---

## Security Considerations

✅ **Encrypted Storage**: All API secrets stored encrypted in database
✅ **Masked in API Responses**: Secrets never sent back to frontend
✅ **Auth Required**: All endpoints require JWT authentication
✅ **HTTPS Only**: Credentials should only be sent over HTTPS
✅ **Scope Limitation**: Each key should have minimal required permissions

### Best Practices:

1. **Use API Key Scoping**: Each social platform should use keys with minimal permissions
2. **Rotate Regularly**: Encourage users to rotate API keys every 90 days
3. **Revoke Unused**: Remove unused API keys from database
4. **Audit Logging**: Log all API key access attempts
5. **User Notification**: Notify users when new social features are accessed

---

## Testing API Keys

### Test Facebook Keys

```bash
curl -X GET "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"
```

### Test Instagram Keys

```bash
curl -X GET "https://graph.instagram.com/me?fields=id,username&access_token=YOUR_TOKEN"
```

### Test Twitter/X Keys

```bash
curl -X GET "https://api.twitter.com/2/tweets/search/recent?query=test" \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN"
```

### Test YouTube Keys

```bash
curl -X GET "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=YOUR_API_KEY"
```

---

## Troubleshooting

### Issue: User sees login page instead of dashboard

**Solution**: Ensure parent app is setting `aiseo_user` in localStorage before navigating

### Issue: Onboarding modal appears every time

**Solution**: Check that `/api/user/social-api-keys` is returning `configured: true` after saving

### Issue: API keys not being saved

**Solution**:

1. Check JWT token is valid
2. Verify database connection
3. Check server logs for errors

### Issue: Keys are being masked incorrectly

**Solution**: Check that keys are being returned from GET endpoint correctly

---

## Future Enhancements

1. **OAuth Flow**: Implement OAuth for each platform instead of manual API keys
2. **Key Rotation Reminders**: Notify users when keys might be expired
3. **Usage Analytics**: Track which platforms are being used
4. **Rate Limiting**: Implement rate limiting per platform
5. **Webhook Integration**: Support webhooks for social events
6. **Multi-Account Support**: Allow users to manage multiple accounts per platform
7. **Team Keys**: Share API keys across team members with audit trail

---

## Summary

The Aiseo app now has:

✅ Complete user persistence from parent app
✅ Optional social media API keys onboarding
✅ Skip-for-now functionality for flexibility
✅ Secure API key storage (encrypted)
✅ Lazy-loaded social features validation
✅ Settings page ready for key management
✅ Database schema supporting multiple platforms
✅ Backend API endpoints for key management
✅ Frontend components with guided setup

Users can now:

1. ✅ Login via parent app (no duplicate login)
2. ✅ Set up social keys on first visit (optional)
3. ✅ Use app immediately without social setup
4. ✅ Configure keys anytime from settings
5. ✅ Post to multiple platforms seamlessly

**App is ready for deployment! 🚀**
