# LinkedIn OAuth & Posting Test Script

## Overview
This script tests the complete LinkedIn integration flow end-to-end:
1. OAuth connection endpoint
2. OAuth callback handling
3. Token storage
4. LinkedIn posting functionality

## Quick Start

### Run the Test Script
```bash
# Mock mode (default - no real LinkedIn API calls)
npx tsx scripts/test-linkedin-flow.ts

# Live mode (requires real LinkedIn OAuth)
LIVE_MODE=true npx tsx scripts/test-linkedin-flow.ts
```

## Test Modes

### MOCK Mode (Default)
- Tests all endpoints without making real LinkedIn API calls
- Validates request/response formats
- Checks that OAuth flow is properly configured
- **Use this for rapid testing without LinkedIn credentials**

### LIVE Mode
- Makes real LinkedIn OAuth and API calls
- Requires valid LinkedIn OAuth credentials in environment
- Actually posts to LinkedIn
- **Use this to verify end-to-end integration**

## What the Script Tests

### ✅ Step 1: OAuth Connect Endpoint
- Tests: `POST /api/social/connect/linkedin`
- Verifies: Auth URL generation, state parameter creation
- Expected: Returns LinkedIn authorization URL with state

### ✅ Step 2: OAuth Callback
- Tests: `GET /api/social/callback/linkedin`
- Verifies: Token exchange flow, error handling
- Expected: Saves LinkedIn access tokens to storage

### ✅ Step 3: Token Injection (Mock Mode)
- Injects test tokens for subsequent testing
- Simulates successful OAuth without real LinkedIn

### ✅ Step 4: LinkedIn Posting
- Tests: `POST /api/linkedin/post`
- Verifies: Post creation with saved tokens
- Expected: Successfully creates LinkedIn post

### ✅ Step 5: Account Verification
- Tests: `GET /api/social/accounts`
- Verifies: LinkedIn account is saved correctly
- Expected: Finds LinkedIn account with valid tokens

## Environment Variables

```bash
# Optional configuration
export BASE_URL="http://localhost:5000"        # Backend URL
export TEST_USER_ID="2"                        # Test user ID
export TEST_USER_EMAIL="your@email.com"        # Test user email
export JWT_SECRET="your-jwt-secret"            # JWT secret for auth
export LIVE_MODE="true"                        # Enable live mode

# Required for LIVE mode
export LINKEDIN_CLIENT_ID="your-client-id"
export LINKEDIN_CLIENT_SECRET="your-secret"
```

## Output Example

```
╔═══════════════════════════════════════════════════════════════════════╗
║         LinkedIn OAuth & Posting - End-to-End Test Suite             ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode: MOCK
Base URL: http://localhost:5000
Test User: bhargav12155@gmail.com (ID: 2)

🔐 STEP 1: Testing OAuth Connect Endpoint
✅ Connect endpoint responds successfully
✅ Auth URL contains LinkedIn domain
✅ State parameter is present

🔄 STEP 2: Testing OAuth Callback (MOCK mode)
✅ Callback reached token exchange step

💉 STEP 3: Injecting Mock LinkedIn Tokens
✅ Token injection

📤 STEP 4: Testing LinkedIn Post Creation
✅ Post endpoint accessible

🔍 STEP 5: Verifying LinkedIn Account Saved
✅ LinkedIn account exists

📊 TEST SUMMARY
Total Tests: 7
Passed: 7
Failed: 0
```

## Manual Testing Flow

If you prefer to test manually:

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Navigate to the dashboard**
   - Open http://localhost:5000
   - Log in as the test user

3. **Connect LinkedIn**
   - Find the LinkedIn card in Social Accounts
   - Click "Connect"
   - Authorize the application

4. **Create a test post**
   - Use the AI Content Generator or Social Posts page
   - Select LinkedIn as the platform
   - Write or generate content
   - Click "Post Now"

5. **Verify on LinkedIn**
   - Go to your LinkedIn profile
   - Check that the post appears

## Troubleshooting

### "User not found" error
- Make sure your JWT_SECRET matches the server's JWT_SECRET
- Verify TEST_USER_ID exists in your database

### "oauth_error=token_exchange_failed"
- Check LinkedIn credentials (CLIENT_ID, CLIENT_SECRET)
- Verify redirect URI is registered in LinkedIn app settings
- Ensure redirect URI matches exactly (including http/https)

### "Invalid or expired token"
- LinkedIn tokens expire - reconnect OAuth
- Check token storage in `/api/social/accounts`

### "Account not found" after OAuth
- Check server logs for OAuth callback errors
- Verify storage layer is saving tokens correctly
- Test with: `GET /api/social/accounts`

## Next Steps

After running this test:

1. **If MOCK mode passes**: Your endpoints are correctly configured
2. **If LIVE mode fails**: Check LinkedIn credentials and redirect URIs
3. **If posting fails**: Verify LinkedIn access token has correct scopes

## LinkedIn API Scopes Required

```
openid
profile  
email
w_member_social  (for posting)
```

Make sure these scopes are enabled in your LinkedIn app configuration.
