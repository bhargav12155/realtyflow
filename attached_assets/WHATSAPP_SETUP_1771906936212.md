# WhatsApp Business API Integration Setup

## Overview

This integration uses the **WhatsApp Business Cloud API** (hosted by Meta) to send text messages to phone numbers directly from the app. It supports sending to a single recipient or bulk-sending to up to 5,000 recipients at once.

---

## Prerequisites

1. A **Meta Business Account** — [Create one here](https://business.facebook.com/)
2. A **WhatsApp Business App** — Created in the [Meta Developer Portal](https://developers.facebook.com/)
3. A verified **WhatsApp Business Phone Number**

---

## Step 1: Create a Meta App

1. Go to [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/)
2. Click **Create App**
3. Select **Business** as the app type
4. Fill in your app name and select your Meta Business Account
5. Once created, go to **Add Products** and add **WhatsApp**

---

## Step 2: Get Your Credentials

From the Meta Developer Portal, navigate to **WhatsApp > API Setup**:

### Phone Number ID

- Found under **From** phone number section
- It's a numeric ID (e.g., `903894596150748`), **not** your actual phone number
- Save this as the `WHATSAPP_PHONE_NUMBER_ID` secret/environment variable

### Access Token

- Click **Generate** under "Temporary access token" (valid for 24 hours)
- For production, create a **System User** token (see Step 4)
- The token is a long string starting with `EAAL...`
- Save this as the `WHATSAPP_ACCESS_TOKEN` secret/environment variable

---

## Step 3: Environment Variables

Set these two secrets in your project:

| Variable | Description | Example |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp Business phone number ID | `903894596150748` |
| `WHATSAPP_ACCESS_TOKEN` | Your API access token | `EAALxxxxxxx...` |

---

## Step 4: Production Token (Permanent)

Temporary tokens expire after 24 hours. For a permanent token:

1. Go to [Meta Business Settings](https://business.facebook.com/settings/)
2. Navigate to **Users > System Users**
3. Click **Add** and create a System User (Admin role)
4. Click **Generate New Token** on the System User
5. Select your WhatsApp app
6. Grant these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
7. Click **Generate Token** and save it as `WHATSAPP_ACCESS_TOKEN`

This token does **not** expire.

---

## Step 5: Verify Recipient Numbers (Test Mode)

While in test mode, you must add recipient phone numbers to your allowlist:

1. In Meta Developer Portal, go to **WhatsApp > API Setup**
2. Under **To** field, click **Manage phone number list**
3. Add the phone numbers you want to message
4. Each number will receive a verification code via WhatsApp

Once your app is approved for production, you can message any number.

---

## API Details

### Endpoint

```
POST https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages
```

### Headers

```
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

### Send a Text Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15185459592",
  "type": "text",
  "text": {
    "body": "Hello from MarketingFlow!"
  }
}
```

### Send a Template Message

```json
{
  "messaging_product": "whatsapp",
  "to": "15185459592",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "en_US"
    }
  }
}
```

### Successful Response

```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    { "input": "15185459592", "wa_id": "15185459592" }
  ],
  "messages": [
    { "id": "wamid.HBgLMTUxODU0NTk1OTIVAgA...", "message_status": "accepted" }
  ]
}
```

---

## Phone Number Format

- Include the **country code** (e.g., `1` for US, `44` for UK, `91` for India)
- **No** `+` sign, spaces, dashes, or parentheses
- Examples:
  - US: `15185459592`
  - UK: `447911123456`
  - India: `919876543210`

---

## Bulk Sending (Up to 5,000)

The app supports sending the same message to multiple recipients:

- Enter phone numbers in the textarea, one per line or comma-separated
- Messages are sent in parallel batches of 10 for performance
- Results show delivery stats: "Sent to X of Y (Z failed)"
- The limit is 5,000 numbers per publish action

---

## Rate Limits

WhatsApp Business API has tier-based rate limits:

| Tier | Messages per 24 hours |
|---|---|
| Unverified (test) | 250 |
| Tier 1 | 1,000 |
| Tier 2 | 10,000 |
| Tier 3 | 100,000 |
| Tier 4 | Unlimited |

Your tier increases as you send more messages and maintain good quality ratings.

---

## Troubleshooting

| Error | Solution |
|---|---|
| `Invalid OAuth access token` | Token is expired or malformed. Regenerate it in Meta Developer Portal |
| `Recipient phone number not in allowed list` | Add the number to your test allowlist (Step 5) |
| `Message failed to send` | Check phone number format — must include country code, digits only |
| `WhatsApp Phone Number ID not configured` | Set the `WHATSAPP_PHONE_NUMBER_ID` environment variable |
| `WhatsApp access token not configured` | Set the `WHATSAPP_ACCESS_TOKEN` environment variable |

---

## Useful Links

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Meta Developer Portal](https://developers.facebook.com/)
- [Meta Business Settings](https://business.facebook.com/settings/)
- [WhatsApp Message Templates](https://developers.facebook.com/docs/whatsapp/api/messages/message-templates)
