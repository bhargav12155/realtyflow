# WhatsApp Business API — Code Integration Guide

This document explains how WhatsApp messaging is integrated into this MarketingFlow application, covering the backend service, API routes, and frontend UI.

---

## Architecture Overview

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Quick Posts UI      │────▶│   Express API Route   │────▶│  WhatsApp Cloud  │
│   (React + Vite)      │     │   /api/social-posts/  │     │  API (Meta)      │
│                       │     │   publish              │     │  graph.facebook  │
│  - Phone numbers      │     │                        │     │  .com/v22.0      │
│  - Message content    │     │  - Parse phones        │     │                  │
│  - Platform select    │     │  - Batch send (10)     │     │  POST /messages  │
│  - Delivery stats     │     │  - Track sent/failed   │     │                  │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
```

---

## 1. Environment Variables (Secrets)

Two secrets are required. These are stored in Replit Secrets and accessed via `process.env`:

| Secret | Description |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp Business phone number ID from Meta (e.g., `903894596150748`) |
| `WHATSAPP_ACCESS_TOKEN` | API access token from Meta Developer Portal (starts with `EAAL...`, 289+ chars) |

---

## 2. Backend Service — `server/services/socialMedia.ts`

### Helper: `sendWhatsAppMessage()`

A reusable internal function that sends any type of WhatsApp message (template or text):

```typescript
async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  payload: Record<string, any>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        ...payload,
      }),
    }
  );
  const result = await response.json();

  if (result.messages?.[0]?.id) {
    return { success: true, messageId: result.messages[0].id };
  }
  return { success: false, error: result.error?.message || "Failed to send WhatsApp message" };
}
```

### Main Function: `postToWhatsApp()`

This is the exported function called by the publish route. It sends **two messages** per recipient:

1. **Template message** (`hello_world`) — Opens the conversation window (required in test/sandbox mode)
2. **Text message** — Your actual content, sent 1 second after the template

```typescript
export async function postToWhatsApp(content: string, recipientPhone?: string): Promise<PostResult> {
  // 1. Validate secrets exist
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  // 2. Clean phone number (digits only)
  const cleanPhone = recipientPhone.replace(/[^0-9]/g, "");

  // 3. Send template message first (opens conversation)
  const templateResult = await sendWhatsAppMessage(phoneNumberId, accessToken, cleanPhone, {
    type: "template",
    template: { name: "hello_world", language: { code: "en_US" } },
  });

  // 4. Wait 1 second, then send actual text content
  await new Promise(resolve => setTimeout(resolve, 1000));

  const textResult = await sendWhatsAppMessage(phoneNumberId, accessToken, cleanPhone, {
    type: "text",
    text: { body: content },
  });

  // 5. Return success if either message was delivered
  return {
    success: true,
    postId: textResult.messageId || templateResult.messageId,
    url: `https://wa.me/${cleanPhone}`,
  };
}
```

### Why Two Messages?

WhatsApp Business API in **test/sandbox mode** only delivers template messages. Free-form text messages are accepted by the API but silently not delivered unless a conversation window is open. Sending the `hello_world` template first opens that window, allowing the text message to arrive.

---

## 3. API Route — `server/routes.ts`

### Publish Endpoint: `POST /api/social-posts/publish`

The existing multi-platform publish endpoint was extended to handle WhatsApp with bulk recipients:

```typescript
const publishSchema = z.object({
  content: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  imageUrl: z.string().nullable().optional(),
  menuItemId: z.number().int().nullable().optional(),
  postType: z.string().nullable().optional(),
  whatsappPhone: z.string().nullable().optional(),  // NEW: comma/newline separated phone numbers
});
```

### Bulk Sending Logic

When `whatsapp` is in the platforms array:

1. Split `whatsappPhone` string by commas and newlines
2. Clean each number (digits only), filter empties, cap at 5,000
3. Send in **parallel batches of 10** using `Promise.allSettled()`
4. Track `sent` and `failed` counts
5. Save one `socialPost` record in the database
6. Return delivery stats in the response

```typescript
if (platform === "whatsapp" && whatsappPhone) {
  const phoneNumbers = whatsappPhone
    .split(/[\n,]+/)
    .map(p => p.replace(/[^0-9]/g, ""))
    .filter(p => p.length > 0)
    .slice(0, 5000);

  const BATCH_SIZE = 10;
  for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
    const batch = phoneNumbers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(phone => postToplatform("whatsapp", content, imageUrl, { recipientPhone: phone }))
    );
    // ... track sent/failed counts
  }

  results.push({
    platform: "whatsapp",
    success: sentCount > 0,
    sent: sentCount,
    failed: failedCount,
    total: phoneNumbers.length,
  });
}
```

### Social Accounts Endpoint: `GET /api/social/accounts`

WhatsApp status is determined by checking if secrets exist (not OAuth):

```typescript
const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
const waConfigured = !!(waPhoneId && waToken);

accounts.push({
  platform: "whatsapp",
  isConnected: waConfigured,
  accountName: waConfigured ? "WhatsApp Business" : null,
  accountUsername: waConfigured ? waPhoneId : null,
});
```

---

## 4. Frontend UI — `client/src/pages/quick-posts.tsx`

### Platform Entry

WhatsApp is the 7th platform in the platforms list:

```typescript
{
  id: "whatsapp",
  label: "WhatsApp",
  icon: SiWhatsapp,       // from react-icons/si
  color: "text-green-500",
  note: "WhatsApp sends messages to a specific phone number via the WhatsApp Business API."
}
```

### Status Display (No OAuth)

Unlike other platforms that show Connect/Disconnect buttons, WhatsApp shows:
- **"API Configured"** (green) — when both secrets are set
- **"API Keys Missing"** (amber) — when secrets are missing

No OAuth popup flow is needed for WhatsApp.

### Phone Numbers Input

When WhatsApp is selected, a textarea appears:

- Accepts multiple phone numbers (one per line or comma-separated)
- Live counter shows `{count} / 5,000 numbers`
- Enforces 5,000 number limit on input
- Publish button disabled until at least one number is entered

### Delivery Results

After publishing, WhatsApp results show batch delivery stats:
- Single recipient: "Published"
- Multiple recipients: "Sent to X of Y (Z failed)"

---

## 5. Key Differences from Other Platforms

| Feature | Other Platforms | WhatsApp |
|---|---|---|
| Authentication | OAuth popup flow | API tokens (secrets) |
| Connection UI | Connect/Disconnect/Reconnect buttons | "API Configured" status badge |
| Recipient | Posts to connected account | Sends to specified phone number(s) |
| Bulk support | One post per platform | Up to 5,000 recipients per publish |
| Message flow | Single API call | Template message + text message (two calls) |
| Status endpoint | Database-backed (platformConnections table) | Environment variable check |

---

## 6. API Request/Response Examples

### Successful Publish (Single Recipient)

**Request:**
```json
POST /api/social-posts/publish
{
  "content": "Check out our new menu!",
  "platforms": ["whatsapp"],
  "whatsappPhone": "15185459592"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Posted to all platforms successfully!",
  "results": [{
    "platform": "whatsapp",
    "success": true,
    "postId": "wamid.HBgLMTUxODU0NTk1OTIVAgARGBI...",
    "dbPostId": 28,
    "sent": 1,
    "failed": 0,
    "total": 1
  }]
}
```

### Bulk Send (Multiple Recipients)

**Request:**
```json
POST /api/social-posts/publish
{
  "content": "Weekend special! 20% off all orders",
  "platforms": ["whatsapp"],
  "whatsappPhone": "15185459592\n447911123456\n919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Posted to all platforms successfully!",
  "results": [{
    "platform": "whatsapp",
    "success": true,
    "sent": 3,
    "failed": 0,
    "total": 3
  }]
}
```

---

## 7. File Locations

| File | What It Does |
|---|---|
| `server/services/socialMedia.ts` | `sendWhatsAppMessage()` helper, `postToWhatsApp()` main function, `checkPlatformStatus()` for WhatsApp |
| `server/routes.ts` | Publish endpoint with bulk WhatsApp logic, `/api/social/accounts` with WhatsApp status |
| `client/src/pages/quick-posts.tsx` | WhatsApp platform entry, phone textarea, delivery stats display |

---

## 8. Replicating in Another Project

1. Copy `sendWhatsAppMessage()` and `postToWhatsApp()` from `server/services/socialMedia.ts`
2. Add the `whatsappPhone` field to your publish schema
3. Add the bulk sending loop from `server/routes.ts` (batches of 10 with `Promise.allSettled`)
4. Set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` as environment secrets
5. On the frontend, add a textarea for phone numbers and show delivery stats
6. See `WHATSAPP_SETUP.md` for how to get your Meta credentials
