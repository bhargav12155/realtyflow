# RealtyFlow Multi-User Authentication System

## Overview

RealtyFlow now supports multiple user types with a comprehensive authentication system designed for real estate applications:

1. **Agents** - Real estate professionals who manage properties, create content, and serve clients
2. **Public Users** - Clients, visitors, and prospects who interact with agent services

## Quick Setup Guide

### 1. Environment Configuration

Copy the `.env` file and update the required variables:

```bash
# Required for authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DATABASE_URL=postgresql://username:password@localhost/realtyflow

# Optional: External integrations
OPENAI_API_KEY=your_openai_key
HEYGEN_API_KEY=your_heygen_key
```

### 2. Database Setup

```bash
# Push the schema to your database
npm run db:push

# Or if you have data conflicts:
npm run db:push --force
```

### 3. Start the Application

```bash
npm run dev
```

## Authentication API Endpoints

### Agent Registration & Login

**Register Agent**

```http
POST /api/auth/agent/register
Content-Type: application/json

{
  "username": "john_doe",
  "password": "secure_password_123",
  "name": "John Doe",
  "email": "john@realty.com",
  "role": "agent"
}
```

**Login Agent**

```http
POST /api/auth/agent/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "secure_password_123"
}
```

### Public User Authentication

**Create/Login Public User**

```http
POST /api/auth/public/login
Content-Type: application/json

{
  "email": "client@example.com",
  "agentSlug": "john-doe-realtor",
  "name": "Jane Client"
}
```

### Shared Endpoints

**Check Authentication Status**

```http
GET /api/auth/check
```

**Get Current User**

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Logout**

```http
POST /api/auth/logout
```

## User Types & Identification

### Agent Users

- **Primary ID**: UUID string (e.g., "uuid-123-456")
- **Authentication**: Username/password
- **JWT Token**: Contains `id`, `username`, `email`, `type: "agent"`
- **Permissions**: Full access to create content, manage properties, view analytics

### Public Users

- **Primary ID**: Auto-increment integer (e.g., 123)
- **Authentication**: Email + Agent Slug (no password required)
- **JWT Token**: Contains `id`, `email`, `agentSlug`, `type: "public"`
- **Permissions**: Limited access, scoped to specific agent's content

## Using Authentication in Your Code

### Backend Middleware

```typescript
import { requireAuth, requireAgent, optionalAuth } from "./middleware/auth";

// Require any authenticated user
app.get("/api/protected", requireAuth, (req, res) => {
  console.log("User ID:", req.userId);
  console.log("User Type:", req.userType);
});

// Require agent access only
app.get("/api/admin", requireAgent, (req, res) => {
  // Only agents can access
});

// Optional authentication
app.get("/api/public", optionalAuth, (req, res) => {
  if (req.user) {
    // User is authenticated
  } else {
    // Anonymous user
  }
});
```

### Frontend Usage

```javascript
// Register agent
const registerResponse = await fetch("/api/auth/agent/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "agent123",
    password: "password",
    name: "Agent Name",
    email: "agent@example.com",
  }),
});

// Login agent
const loginResponse = await fetch("/api/auth/agent/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "agent123",
    password: "password",
  }),
});

// Public user login (no password needed)
const publicLoginResponse = await fetch("/api/auth/public/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "client@example.com",
    agentSlug: "agent-slug",
    name: "Client Name",
  }),
});

// Use token for authenticated requests
const token = loginResponse.token;
const apiResponse = await fetch("/api/protected-endpoint", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

## External API Integration

### Passing User Context to External Services

```typescript
import { callAiSeoService } from "./utils/auth";

app.post("/api/generate-seo-content", requireAuth, async (req, res) => {
  try {
    const { contentType, keywords } = req.body;

    // This automatically includes user identification
    const seoResult = await callAiSeoService(req, {
      contentType,
      keywords,
      targetUrl: "https://example.com",
    });

    res.json({
      success: true,
      userId: req.userId, // Primary identifier
      userType: req.userType, // 'agent' or 'public'
      seoContent: seoResult,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate SEO content" });
  }
});
```

### Manual User Context Building

```typescript
import { buildUserPayload } from "./utils/auth";

app.post("/api/custom-service", requireAuth, async (req, res) => {
  const userContext = buildUserPayload(req);

  // userContext will be:
  // For agents: { userId: "uuid", userType: "agent", username: "agent123", context: "agent" }
  // For public: { userId: 123, userType: "public", agentSlug: "agent-slug", context: "client" }

  const externalApiResponse = await fetch("https://external-service.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: userContext,
      data: req.body,
    }),
  });
});
```

## Database Schema

### Users Table (Agents)

```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, -- bcrypt hashed
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Public Users Table (Clients)

```sql
CREATE TABLE public_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  agent_slug TEXT NOT NULL,
  preferences JSONB,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_slug, email) -- One email per agent
);
```

## Security Features

1. **JWT Tokens**: Secure, stateless authentication
2. **HTTP-Only Cookies**: Tokens stored securely in cookies
3. **Password Hashing**: bcrypt with 12 salt rounds
4. **Type-based Access Control**: Different permissions for agents vs public users
5. **Agent Scoping**: Public users are scoped to specific agents
6. **Token Expiration**: Configurable token lifetime

## Best Practices

### 1. Always Use Numeric ID for External APIs

```typescript
// ✅ GOOD - Stable, secure, performant
const userId = req.userId; // Works for both user types

// ❌ AVOID - Can change, security risk
const userEmail = req.user?.email;
```

### 2. Handle Both User Types Gracefully

```typescript
const handleUserData = (req: Request) => {
  if (req.userType === "agent") {
    // Agent-specific logic
    return getAgentProperties(req.userId);
  } else {
    // Public user logic
    return getClientFavorites(req.userId, req.agentSlug);
  }
};
```

### 3. Validate User Context

```typescript
app.post("/api/agent-only-feature", requireAgent, (req, res) => {
  // This middleware ensures only agents can access
  // req.userType is guaranteed to be 'agent'
});
```

## Environment Variables

```bash
# Required
JWT_SECRET=your-jwt-secret-key
DATABASE_URL=postgresql://user:pass@localhost/realtyflow

# Optional external integrations
AI_SEO_SERVICE_URL=https://your-ai-service.com
AI_SEO_SERVICE_API_KEY=your-api-key
```

## Testing the System

Use the built-in test endpoint (development only):

```http
POST /api/auth/test-token
Content-Type: application/json

{
  "token": "your-jwt-token-here"
}
```

This will decode and validate the token, showing user identification details.

## Migration from Single User

If you're upgrading from a single-user system:

1. **Backup your data** before running migrations
2. **Update environment variables** with JWT_SECRET
3. **Run database migration**: `npm run db:push`
4. **Update existing routes** to use authentication middleware
5. **Test user flows** for both agent and public users

## Common Issues & Solutions

**Database Connection Error**

```bash
# Check DATABASE_URL in .env file
# Ensure PostgreSQL is running
# Verify connection string format
```

**JWT Token Errors**

```bash
# Ensure JWT_SECRET is set in environment
# Check token format in Authorization header
# Verify cookie parsing is enabled
```

**User Type Confusion**

```typescript
// Always check user type when needed
if (req.userType === "agent") {
  // Agent logic
} else if (req.userType === "public") {
  // Public user logic
}
```

This multi-user system provides a robust foundation for real estate applications that need to serve both agents and their clients with proper authentication, authorization, and data isolation.
