# NebraskaHomeHub ↔ RealtyFlow Integration

This document describes the integration between NebraskaHomeHub and RealtyFlow applications for social media management.

## Overview

When users click the "AI-SEO" button in NebraskaHomeHub, they are redirected to RealtyFlow with specific parameters that enable automatic setup of social media configurations.

## Integration Flow

### 1. User clicks AI-SEO button in NebraskaHomeHub

**Location**: Any page in NebraskaHomeHub  
**Button**: Golden "✨ AI-SEO" button in header  
**Action**: Opens RealtyFlow in new tab with parameters

### 2. URL Parameters Passed

```
https://realty-flow-mikebjork.replit.app?source=nebraska-home-hub&domain=example.com&timestamp=1234567890
```

- `source=nebraska-home-hub`: Identifies the source application
- `domain=example.com`: The domain of the NebraskaHomeHub instance
- `timestamp=1234567890`: Prevents caching issues

### 3. RealtyFlow detects NebraskaHomeHub source

**File**: `/client/src/pages/dashboard.tsx`  
**Logic**:

- Checks URL parameters on component mount
- If `source=nebraska-home-hub`, shows social media setup modal
- Automatically fetches social URLs from NebraskaHomeHub API

### 4. Social URLs are fetched automatically

**API Call**: `GET https://{domain}/api/template` or `/api/template/public`  
**Response includes**:

```json
{
  "facebookUrl": "https://facebook.com/...",
  "twitterUrl": "https://twitter.com/...",
  "instagramUrl": "https://instagram.com/...",
  "linkedinUrl": "https://linkedin.com/...",
  "youtubeUrl": "https://youtube.com/...",
  "tiktokUrl": "https://tiktok.com/..."
}
```

### 5. User completes social media setup

**Component**: `SocialMediaSetup`  
**Features**:

- Pre-populated social URLs from NebraskaHomeHub
- Form fields for API keys and access tokens
- Platform-specific validation
- Setup instructions for each platform

## API Endpoints

### NebraskaHomeHub → RealtyFlow

| Endpoint               | Method | Purpose                                |
| ---------------------- | ------ | -------------------------------------- |
| `/api/template`        | GET    | Get user's social URLs (authenticated) |
| `/api/template/public` | GET    | Get public social URLs (fallback)      |

### RealtyFlow Internal

| Endpoint                    | Method | Purpose                       |
| --------------------------- | ------ | ----------------------------- |
| `/api/user/social-api-keys` | GET    | Get stored API keys           |
| `/api/user/social-api-keys` | POST   | Save API keys                 |
| `/api/{platform}/validate`  | POST   | Validate platform credentials |

## Social Media Platforms Supported

### Facebook

- **Required**: Page ID, Page Access Token
- **Setup**: Facebook Developer Console → App → Pages API
- **Permissions**: `pages_manage_posts`

### Instagram

- **Required**: User ID, Access Token
- **Setup**: Instagram Business Account → Facebook Graph API
- **Permissions**: Business account required

### Twitter/X

- **Required**: API Key, API Secret, Access Token, Access Token Secret
- **Setup**: Twitter Developer Portal → Create App
- **Permissions**: Write permissions

### LinkedIn

- **Required**: Access Token
- **Setup**: LinkedIn Developer → OAuth 2.0
- **Permissions**: `w_member_social`

### YouTube

- **Required**: API Key, Access Token
- **Setup**: Google Cloud Console → YouTube Data API v3
- **Permissions**: Channel management

### TikTok

- **Required**: Access Token
- **Setup**: TikTok for Business → Developer Portal
- **Permissions**: Business account verification

## Security Considerations

### 1. CORS Configuration

RealtyFlow must allow requests from NebraskaHomeHub domains:

```javascript
// In RealtyFlow server
app.use(
  cors({
    origin: [
      "https://bjorkhomes.com",
      "https://mandy.bjorkhomes.com",
      // Add other NebraskaHomeHub domains
    ],
    credentials: true,
  })
);
```

### 2. API Key Storage

- API keys are encrypted in RealtyFlow database
- Only masked versions returned in API responses
- Full keys only used for posting operations

### 3. Cross-Domain Authentication

Currently uses fallback to public endpoints. For full integration:

- Implement JWT token passing via URL parameters
- Or use OAuth flow between applications
- Or implement session sharing mechanism

## Testing the Integration

### 1. Local Development

```bash
# Start NebraskaHomeHub
cd NebraskaHomeHub
npm run dev

# Start RealtyFlow
cd realtyflow
npm run dev

# Test URL
http://localhost:5173?source=nebraska-home-hub&domain=localhost:3000
```

### 2. Production Testing

1. Navigate to any NebraskaHomeHub site
2. Click the "✨ AI-SEO" button
3. Verify RealtyFlow opens with setup modal
4. Check that social URLs are pre-populated
5. Complete setup and test posting

## Troubleshooting

### Setup Modal Doesn't Appear

- Check URL parameters in browser address bar
- Verify `source=nebraska-home-hub` parameter is present
- Check browser console for JavaScript errors

### Social URLs Not Loading

- Verify NebraskaHomeHub API is accessible
- Check CORS settings
- Try public endpoint manually: `{domain}/api/template/public`

### API Key Validation Fails

- Verify platform credentials are correct
- Check platform-specific setup requirements
- Review validation endpoint logs

## Future Enhancements

1. **Real-time Sync**: Sync social URLs when changed in NebraskaHomeHub
2. **Advanced Auth**: Implement proper JWT-based authentication
3. **Webhooks**: Notify NebraskaHomeHub of posting success/failure
4. **Analytics**: Track posting performance and return to NebraskaHomeHub
5. **Brand Consistency**: Import brand colors and settings from NebraskaHomeHub

## File Changes Made

### NebraskaHomeHub

- `client/src/lib/constants.ts`: Added `buildRealtyFlowUrl()` function
- `client/src/components/layout/header.tsx`: Updated AI-SEO button links
- `client/src/components/layout/public-header.tsx`: Updated AI-SEO button links

### RealtyFlow

- `client/src/components/setup/social-media-setup.tsx`: New setup component
- `client/src/pages/dashboard.tsx`: Added setup modal detection
- `server/routes/user/social-api-keys.ts`: Updated API routes
- `server/routes.ts`: Added validation endpoints
