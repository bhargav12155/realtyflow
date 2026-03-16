# Copilot Extension API - Usage Examples

Your NebraskaHomeHub app now exposes AI generation endpoints at `/api/copilot/*`

## API Reference Summary

| Method | Path                                | Purpose                                           | Key Request Fields                                                                 | Success Payload                                                |
| ------ | ----------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| GET    | `/api/copilot/status`               | Provider health/status                            | _None_                                                                             | `data.providers` map, `availableCount`, `healthy`              |
| POST   | `/api/copilot/generate`             | Free-form generation with automatic fallback      | `prompt` (string), optional `systemPrompt`, `temperature`, `maxTokens`, `provider` | `data.content`, `data.provider`, `data.model`                  |
| POST   | `/api/copilot/chat`                 | Chat-style responses tuned for real estate helper | `message` (string), optional `context`, `provider`                                 | `response` string plus `metadata.provider`/`model`             |
| POST   | `/api/copilot/blog-post`            | Long-form article generator                       | `topic` (string), optional `tone`, `length`, `provider`                            | `data.content` (Markdown), `metadata.provider`/`model`         |
| POST   | `/api/copilot/property-description` | Listing description generator                     | `address` (string), optional `features[]`, `price`, `neighborhood`, `provider`     | `data.description`, `metadata.provider`/`model`                |
| POST   | `/api/copilot/generate-json`        | Structured JSON output                            | `prompt` (string), optional `systemPrompt`, `temperature`, `maxTokens`, `provider` | `data` (parsed JSON object/array), `metadata.provider`/`model` |

Each endpoint returns `success: true` with a `data` or `response` field on success, and `success: false` with an `error` message on failure.

## Available Endpoints

Local base URL: `http://localhost:3001/api/copilot/*`

Production base URL: `https://www.imakepage.com/api/copilot/*`

---

## 1. Check Provider Status

**GET** `/api/copilot/status`

Check which AI providers are configured and available.

```bash
curl http://localhost:3001/api/copilot/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "providers": {
      "openai": true,
      "github-copilot": false,
      "anthropic": true
    },
    "availableCount": 2,
    "healthy": true
  }
}
```

---

## 2. Generate AI Content

**POST** `/api/copilot/generate`

Generate any AI content. When `provider` is omitted, GitHub Copilot is used first and the request automatically falls back to OpenAI and then Anthropic if needed.

```bash
curl -X POST http://localhost:3001/api/copilot/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short description of Omaha, Nebraska",
    "systemPrompt": "You are a local area expert",
    "temperature": 0.7,
    "maxTokens": 500
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": "Omaha is Nebraska's largest city...",
    "provider": "github-copilot",
    "model": "gpt-4o"
  }
}
```

---

## 3. Chat Endpoint

**POST** `/api/copilot/chat`

Conversational AI endpoint.

```bash
curl -X POST http://localhost:3001/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the best schools in Omaha?",
    "context": "User is relocating with a family"
  }'
```

**Response:**

```json
{
  "success": true,
  "response": "Omaha has several excellent school districts...",
  "metadata": {
    "provider": "github-copilot",
    "model": "gpt-4o"
  }
}
```

---

## 4. Generate Blog Post

**POST** `/api/copilot/blog-post`

Generate complete blog posts easily.

```bash
curl -X POST http://localhost:3001/api/copilot/blog-post \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Best Neighborhoods in Omaha for Families",
    "tone": "friendly",
    "length": "medium"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": "# Best Neighborhoods in Omaha for Families\n\n...",
    "topic": "Best Neighborhoods in Omaha for Families",
    "tone": "friendly",
    "length": "medium"
  },
  "metadata": {
    "provider": "github-copilot",
    "model": "gpt-4o"
  }
}
```

---

## 5. Generate Property Description

**POST** `/api/copilot/property-description`

Generate compelling property descriptions.

```bash
curl -X POST http://localhost:3001/api/copilot/property-description \
  -H "Content-Type: application/json" \
  -d '{
    "address": "123 Maple Street, Omaha, NE 68022",
    "features": ["4 bed", "3 bath", "2-car garage", "finished basement"],
    "price": 425000,
    "neighborhood": "Elkhorn"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "description": "Welcome to this stunning 4-bedroom home...",
    "address": "123 Maple Street, Omaha, NE 68022",
    "neighborhood": "Elkhorn"
  },
  "metadata": {
    "provider": "github-copilot",
    "model": "gpt-4o"
  }
}
```

---

## 6. Generate Structured JSON

**POST** `/api/copilot/generate-json`

Generate structured data in JSON format. For strict JSON mode, pass `provider: "openai"`.

```bash
curl -X POST http://localhost:3001/api/copilot/generate-json \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate 3 key features of living in Omaha",
    "systemPrompt": "Return JSON array with {title, description} objects",
    "provider": "openai"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "title": "Affordable Living",
      "description": "Omaha offers a low cost of living..."
    },
    {
      "title": "Strong Job Market",
      "description": "Home to 5 Fortune 500 companies..."
    },
    {
      "title": "Family Friendly",
      "description": "Excellent schools and safe neighborhoods..."
    }
  ],
  "metadata": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

---

## Use from JavaScript/TypeScript

### In Your Frontend (React, etc.)

```typescript
// Generate AI content
async function generateContent(prompt: string) {
  const response = await fetch("/api/copilot/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemPrompt: "You are a helpful assistant",
    }),
  });

  const data = await response.json();
  return data.data.content;
}

// Generate blog post
async function createBlogPost(topic: string) {
  const response = await fetch("/api/copilot/blog-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      tone: "professional",
      length: "medium",
    }),
  });

  const data = await response.json();
  return data.data.content;
}

// Chat
async function chat(message: string) {
  const response = await fetch("/api/copilot/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  const data = await response.json();
  return data.response;
}
```

---

## Use from External Apps

### From Another Node.js App

```javascript
const axios = require("axios");

const NEBRASKA_HUB_URL = "https://your-production-url.com";

async function generateWithNebraskaHub(prompt) {
  const response = await axios.post(
    `${NEBRASKA_HUB_URL}/api/copilot/generate`,
    {
      prompt,
      systemPrompt: "You are a helpful assistant",
    }
  );

  return response.data.data.content;
}

// Usage
const content = await generateWithNebraskaHub("Write about Omaha");
console.log(content);
```

### From Python

```python
import requests

NEBRASKA_HUB_URL = "https://your-production-url.com"

def generate_content(prompt):
    response = requests.post(
        f"{NEBRASKA_HUB_URL}/api/copilot/generate",
        json={
            "prompt": prompt,
      "systemPrompt": "You are a helpful assistant"
        }
    )
    return response.json()["data"]["content"]

# Usage
content = generate_content("Write about Omaha")
print(content)
```

---

## Configuration

Make sure you have at least one AI provider configured in your `.env`:

```env
# GitHub Copilot (primary provider)
GITHUB_TOKEN=ghp_your-token-here

# OpenAI (fallback provider)
OPENAI_API_KEY=sk-your-key-here

# Anthropic Claude (optional second fallback)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## Provider Auto-Fallback

The system automatically falls back to other providers if the preferred one fails:

```bash
# Try GitHub Copilot first (default), fallback to OpenAI, then Anthropic
curl -X POST http://localhost:3001/api/copilot/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello world"
  }'
```

If GitHub Copilot fails → tries OpenAI → tries Anthropic

---

## Benefits of This Approach

✅ **Single Deployment** - No separate Copilot Extension server
✅ **Same Infrastructure** - Uses your existing NebraskaHomeHub setup
✅ **Call from Anywhere** - Any app can use these endpoints via HTTP
✅ **Multiple Providers** - Automatic fallback between OpenAI/GitHub/Anthropic
✅ **Convenience Endpoints** - Specialized for blog posts, property descriptions, etc.
✅ **No Extra Costs** - One server, one deployment

---

## Production URLs

Once deployed, your endpoints will be at:

```
https://your-production-domain.com/api/copilot/generate
https://your-production-domain.com/api/copilot/chat
https://your-production-domain.com/api/copilot/blog-post
etc.
```

Use these URLs from any application that needs AI content generation!
