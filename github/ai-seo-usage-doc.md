# 🎯 AI-SEO Integration Guide: NebraskaHomeHub ↔ RealtyFlow

## **Overview**
The AI-SEO feature allows real estate agents in NebraskaHomeHub to access RealtyFlow's advanced social media automation and content generation tools. It's **100% user-specific** - each agent gets their own experience with their own data.

---

## **📍 User Journey Flow**

### **Step 1: Agent Clicks AI-SEO Button**
- **Location**: Available in NebraskaHomeHub header (on `/external` route)
- **What happens**: Opens RealtyFlow in an iframe (or new tab if iframe blocked)

### **Step 2: URL Construction with User Context**
When the button is clicked, this function runs:

```typescript
// From: NebraskaHomeHub/client/src/lib/constants.ts
buildRealtyFlowUrl(
  "https://multi-users-realtyflow.replit.app",
  user.email // PASSES THE LOGGED-IN USER'S EMAIL
)
```

**Generated URL Example:**
```
https://multi-users-realtyflow.replit.app/integration
  ?source=nebraska-home-hub
  &domain=localhost (or actual domain)
  &timestamp=1761625689430
  &userEmail=agent@example.com  ← USER-SPECIFIC
  &autoLogin=true
```

### **Step 3: RealtyFlow Auto-Login (User-Specific)**
- **File**: `realtyflow/client/src/pages/integration.tsx`
- **What happens**:
  ```typescript
  // Detects URL parameters
  const userEmail = urlParams.get("userEmail");
  const autoLogin = urlParams.get("autoLogin");

  // Logs in THIS SPECIFIC USER automatically
  const loginResult = await universalLogin(userEmail);
  ```

### **Step 4: User-Specific Data Loading**
Once logged in, RealtyFlow loads **only this user's data**:

1. **Social Media Links** (from NebraskaHomeHub template)
   - Makes API call to NebraskaHomeHub: `GET /api/template`
   - Fetches the logged-in agent's social URLs (Facebook, Instagram, etc.)

2. **API Keys** (from RealtyFlow database)
   - Makes API call to RealtyFlow: `GET /api/user/social-api-keys`
   - Fetches THIS user's saved Facebook tokens, Instagram tokens, etc.

### **Step 5: Social Media Setup Modal**
- Shows a modal with **this agent's social URLs** pre-filled
- Agent enters their **personal API keys** for each platform
- All data saved to RealtyFlow database **linked to this user's account**

---

## **🔐 User-Specific Architecture**

### **Database Design (Multi-User)**

#### **RealtyFlow Database**
```typescript
// Users table
{
  id: 1,
  email: "agent@example.com",  // Unique identifier
  username: "agent1",
  role: "agent"
}

// Social API Keys table (USER-SPECIFIC)
{
  userId: 1,  // ← Links to specific user
  facebookPageId: "agent1's page ID",
  facebookAccessToken: "agent1's token",
  instagramUserId: "agent1's instagram",
  // etc...
}

// Social Links table (USER-SPECIFIC)
{
  userId: 1,  // ← Links to specific user
  facebookUrl: "facebook.com/agent1",
  instagramUrl: "instagram.com/agent1",
  // etc...
}
```

#### **NebraskaHomeHub Database**
```typescript
// Users table
{
  id: 1,
  email: "agent@example.com",
  name: "Agent Name"
}

// Templates table (USER-SPECIFIC)
{
  userId: 1,  // ← Links to specific user
  facebookUrl: "facebook.com/agent1",
  instagramUrl: "instagram.com/agent1",
  customSlug: "agent1",
  // All branding/template settings
}
```

---

## **🔒 Security & User Isolation**

### **1. Authentication Flow**
```
NebraskaHomeHub (agent1@email.com logged in)
    ↓ passes userEmail in URL
RealtyFlow receives userEmail
    ↓ universalLogin(userEmail)
Creates/finds user in RealtyFlow DB
    ↓ JWT token issued
All subsequent API calls authenticated as agent1@email.com
```

### **2. Data Isolation**
Every API endpoint checks authentication:

```typescript
// Example: GET /api/user/social-api-keys
requireAuth(async (req, res) => {
  const userId = req.user.id; // From JWT token

  // Only fetches THIS user's keys
  const keys = await db.query(`
    SELECT * FROM social_api_keys 
    WHERE userId = ?
  `, [userId]);

  return keys; // Can ONLY see their own data
});
```

### **3. Cross-App Security**
- **CORS**: Only allows requests from known domains
- **JWT Tokens**: Stored in httpOnly cookies (can't be accessed by JavaScript)
- **API Key Encryption**: Sensitive tokens encrypted in database

---

## **📊 What's User-Specific vs Shared?**

| Data Type | User-Specific? | Storage Location |
|-----------|---------------|------------------|
| Social Media URLs | ✅ YES | NebraskaHomeHub DB (per user) |
| API Keys/Tokens | ✅ YES | RealtyFlow DB (per user) |
| Generated Content | ✅ YES | RealtyFlow DB (per user) |
| Posted Content History | ✅ YES | RealtyFlow DB (per user) |
| Template/Branding | ✅ YES | NebraskaHomeHub DB (per user) |
| RealtyFlow Base Code | ❌ NO (shared) | Replit deployment |

---

## **🚀 Replit Deployment Requirements**

### **What You Need to Explain to Replit:**

1. **Multi-User System**
   - "This is a multi-user SaaS application"
   - "Each user has their own isolated data"
   - "Users are identified by email address"

2. **Database Requirements**
   ```
   - One Neon PostgreSQL database (already configured)
   - Tables have `userId` foreign keys for data isolation
   - JWT authentication for user sessions
   ```

3. **Environment Variables Required**
   ```bash
   DATABASE_URL="postgresql://..." # Neon cloud database
   JWT_SECRET="random-secret-key"   # For JWT tokens
   PORT=5000                        # Default port
   NODE_ENV=production              # Production mode
   ```

4. **Security Features**
   - CORS configured for specific domains
   - JWT tokens in httpOnly cookies
   - All API routes require authentication
   - Data queries filtered by `userId`

5. **Cross-App Integration**
   ```
   NebraskaHomeHub embeds RealtyFlow in iframe
   ↓
   Passes userEmail via URL parameter
   ↓
   RealtyFlow auto-logs in that specific user
   ↓
   User only sees/edits their own data
   ```

---

## **🔍 How to Verify It's User-Specific**

### **Test Case:**

1. **Login as Agent 1** in NebraskaHomeHub (agent1@email.com)
2. Click AI-SEO button
3. Set up social media accounts (Facebook Page A, Instagram Account A)
4. Save and close

5. **Logout and login as Agent 2** (agent2@email.com)
6. Click AI-SEO button
7. Should see **empty/different social media setup**
8. Set up different accounts (Facebook Page B, Instagram Account B)

**Result**: Agent 1 can NEVER see Agent 2's data and vice versa.

---

## **🎯 Key Points for Replit**

1. ✅ **User-specific**: Every piece of data is tied to a `userId`
2. ✅ **Secure**: JWT authentication on every API call
3. ✅ **Isolated**: Database queries always filter by `userId`
4. ✅ **Cross-app**: NebraskaHomeHub passes user context via URL
5. ✅ **Production-ready**: Uses cloud database (Neon), not local

---

## **📁 Key Files**

### **NebraskaHomeHub**
- `client/src/lib/constants.ts` - Builds RealtyFlow URL with user email
- `client/src/pages/external.tsx` - Renders RealtyFlow iframe
- `server/index.ts` - CORS configuration for RealtyFlow

### **RealtyFlow**
- `client/src/pages/integration.tsx` - Auto-login and setup modal
- `client/src/components/setup/social-media-setup.tsx` - Social media configuration UI
- `server/routes/user/social-api-keys.ts` - API key management endpoints
- `server/routes/user/social-links.ts` - Social links management endpoints
- `server/middleware/auth.ts` - Authentication middleware (requireAuth, optionalAuth)
- `server/index.ts` - CORS configuration for NebraskaHomeHub

---

## **🔗 API Endpoints**

### **Authentication**
- `POST /api/auth/login` - Universal login (email-based)
- `GET /api/auth/check` - Check authentication status
- `POST /api/auth/logout` - Logout user

### **Social Media**
- `GET /api/user/social-api-keys` - Get user's API keys
- `POST /api/user/social-api-keys` - Save user's API keys
- `GET /api/user/social-links` - Get user's social URLs
- `POST /api/user/social-links` - Save user's social URLs

### **Cross-App (NebraskaHomeHub)**
- `GET /api/template` - Get user's template data (requires auth)
- `GET /api/template/public` - Get public template data (fallback)

---

## **🛡️ Security Best Practices**

1. **Never expose JWT secrets** - Keep in environment variables
2. **Always filter by userId** - Every database query must include user context
3. **Use httpOnly cookies** - Prevents XSS attacks
4. **Validate CORS origins** - Only allow trusted domains
5. **Encrypt sensitive data** - API keys/tokens should be encrypted at rest
6. **Rate limiting** - Prevent abuse of API endpoints
7. **Input validation** - Sanitize all user inputs

---

## **🐛 Troubleshooting**

### **403 Forbidden Error**
- Check CORS configuration in both apps
- Verify NebraskaHomeHub domain is in allowed origins
- Ensure RealtyFlow URL is correct in constants.ts

### **Auto-login Not Working**
- Check URL parameters are being passed correctly
- Verify user email exists in RealtyFlow database
- Check JWT_SECRET is set in environment variables

### **Social URLs Not Loading**
- Verify NebraskaHomeHub API is accessible
- Check user is authenticated in NebraskaHomeHub
- Try public endpoint: `/api/template/public`

### **Can See Other Users' Data**
- **CRITICAL SECURITY ISSUE** - Check all database queries include `WHERE userId = ?`
- Verify authentication middleware is applied to all routes
- Check JWT token is being validated correctly

---

## **📈 Future Enhancements**

1. **Real-time Sync** - Sync social URLs when changed in NebraskaHomeHub
2. **Advanced Auth** - OAuth flow between applications
3. **Webhooks** - Notify NebraskaHomeHub of posting success/failure
4. **Analytics** - Track posting performance per user
5. **Brand Consistency** - Import brand colors and settings from NebraskaHomeHub
6. **Scheduled Posts** - Allow users to schedule social media posts
7. **Multi-Account** - Support multiple social accounts per user
8. **Team Collaboration** - Share content between team members

---

## **📞 Support & Documentation**

- **RealtyFlow Docs**: See `AISEO_INTEGRATION_GUIDE.md`
- **Nebraska Integration**: See `NEBRASKA_INTEGRATION.md`
- **Multi-User Guide**: See `MULTI_USER_GUIDE.md`
- **Deployment**: See `AISEO_DEPLOYMENT_CHECKLIST.md`

---

**Last Updated**: October 27, 2025  
**Version**: Multi-User Branch  
**Database**: Neon PostgreSQL (Cloud)  
**Deployment**: Replit (Production)
