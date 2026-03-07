# WhatsApp Bulk Messaging Guide

Complete guide for sending bulk WhatsApp messages, creating templates, managing queues, and maximizing delivery through iMakePage.

---

## Table of Contents

1. [Setting Up WhatsApp](#1-setting-up-whatsapp)
2. [Creating Message Templates](#2-creating-message-templates)
3. [Sending a Single WhatsApp Message](#3-sending-a-single-whatsapp-message)
4. [Sending Bulk Messages](#4-sending-bulk-messages)
5. [Understanding the Bulk Queue System](#5-understanding-the-bulk-queue-system)
6. [Managing Bulk Queues](#6-managing-bulk-queues)
7. [Downloading Reports](#7-downloading-reports)
8. [WhatsApp Analytics](#8-whatsapp-analytics)
9. [Multiple WhatsApp Accounts](#9-multiple-whatsapp-accounts)
10. [Tips for Maximum Delivery](#10-tips-for-maximum-delivery)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Setting Up WhatsApp

Before sending any messages, you need to connect your WhatsApp Business account.

### Steps:
1. Go to **Settings** (gear icon in the sidebar)
2. Scroll down to the **WhatsApp Settings** section
3. Enter your credentials:
   - **Phone Number ID** — Found in Meta Business Suite under WhatsApp > Phone Numbers
   - **WhatsApp Business Account ID (WABA ID)** — Found in the same location
   - **Permanent Access Token** — A System User token from Meta Business Settings (never expires)
4. Click **Save Settings**

Once saved, WhatsApp will appear as "Connected" in the Social Media Manager.

---

## 2. Creating Message Templates

Meta requires all business-initiated messages to use pre-approved templates. You must create and get a template approved before bulk sending.

### How to Create a Template:

1. Go to the **Social Media Manager** in your dashboard
2. Select **only WhatsApp** as your platform (uncheck all others)
3. In the WhatsApp Message section, look for the **Template** dropdown
4. Click **"+ Create New Template"**

### Template Fields:
- **Template Name** — Lowercase letters, numbers, and underscores only (e.g., `anniversary_special_offer`)
- **Category** — Choose one:
  - **UTILITY** — For transactional messages (order confirmations, appointment reminders, delivery updates). These deliver reliably to all regions including the US.
  - **MARKETING** — For promotional messages (special offers, announcements). Note: Meta may limit delivery of marketing templates to US numbers.
- **Header** (Optional) — Up to 60 characters. Appears in bold at the top of the message.
- **Body** (Required) — Up to 1024 characters. The main message content.
- **Footer** (Optional) — Up to 60 characters. Appears in small gray text at the bottom.

### Quick Templates:
The platform offers pre-built quick templates for common use cases:
- Anniversary/celebration messages
- Order confirmations
- Reservation confirmations
- Delivery status updates

Click a quick template to auto-fill the form, then customize it for your business.

### Template Approval:
- After submitting, Meta reviews your template (usually takes a few minutes to 24 hours)
- **PENDING** — Under review by Meta
- **APPROVED/ACTIVE** — Ready to use for sending
- **REJECTED** — Meta denied it (usually due to content policy violations; try rewording)

### Important Notes:
- Templates with the word "free," "discount," or promotional language are often classified as MARKETING
- UTILITY templates are recommended for US audiences due to Meta's marketing message restrictions
- You can view all your templates and their status in the template dropdown

---

## 3. Sending a Single WhatsApp Message

### Steps:
1. In the **Social Media Manager**, select **WhatsApp** as your only platform
2. Choose your WhatsApp account from the account switcher dropdown (if you have multiple)
3. In the **Recipient Phone Numbers** field, enter a single phone number (with country code, e.g., `14025551234`)
4. Either:
   - **Type a free-form message** in the text area (for customer service replies within 24-hour window), OR
   - **Select a template** from the dropdown (required for initiating new conversations)
5. Optionally attach an image or media
6. Click **Post**

---

## 4. Sending Bulk Messages

### Step 1: Prepare Your Contact List

You can add phone numbers in two ways:

**Option A: Paste Numbers Directly**
- In the **Recipient Phone Numbers** text area, paste your numbers
- Separate numbers with commas, spaces, or new lines
- Supports up to 30,000 numbers at once
- Example: `14025551234, 14025555678, 14025559012`

**Option B: Import from a File**
- Click the **"Import File"** button
- Supported file formats: `.csv`, `.txt`, `.xlsx`, `.xls`, `.numbers`, `.pdf`, `.docx`
- The system automatically extracts valid phone numbers from your file
- After import, you'll see a **File Analysis** breakdown:
  - Total rows found
  - Valid phone numbers extracted
  - Invalid numbers skipped
  - Duplicates removed

### Step 2: Select a Template
- Choose an **APPROVED** template from the dropdown
- The template preview will show you exactly what recipients will see
- If your template has variables (like `{{1}}`, `{{2}}`), fill in the values

### Step 3: Send
- Click **Post** to begin sending
- A progress bar appears showing:
  - Number of messages sent vs. total
  - Delivered count and failed count
  - Estimated cost (based on Meta's per-message pricing)
  - Estimated time remaining

### What Happens Behind the Scenes:
- Messages are sent in small batches (8 at a time) with short delays between them to avoid rate limiting
- If Meta's daily quota is reached, remaining numbers are automatically queued for the next day
- The system tracks every sent, failed, and remaining phone number

---

## 5. Understanding the Bulk Queue System

When sending to large lists, the system intelligently manages delivery through a queue system.

### How It Works:
1. **Initial Send** — The system starts sending immediately when you click Post
2. **Quota Detection** — If Meta returns quota limit errors (you've hit your daily limit), sending automatically pauses
3. **Auto-Queue** — Remaining unsent numbers are saved to a queue with a scheduled retry time (typically 24 hours later)
4. **Background Scheduler** — A background process checks every 60 seconds for queues that are ready to resume
5. **Automatic Resume** — When the scheduled time arrives, the system automatically starts sending the next batch

### Queue Statuses:
- **Active** — Currently sending or waiting for its scheduled time
- **Paused** — Manually paused by you; won't send until you resume it
- **Completed** — All numbers in the queue have been processed
- **Cancelled** — You cancelled the queue; remaining numbers won't be sent

### Meta Messaging Tiers:
Meta limits how many unique contacts you can message per day based on your account tier:
- **TIER_250** — 250 unique contacts/day (new accounts)
- **TIER_1K** — 1,000 unique contacts/day
- **TIER_10K** — 10,000 unique contacts/day
- **TIER_100K** — 100,000 unique contacts/day
- **UNLIMITED** — No daily limit

Your tier is displayed in the WhatsApp Message section (e.g., "Meta limit: 2,000/day"). The tier increases automatically as you send more messages with good quality ratings.

---

## 6. Managing Bulk Queues

The **Queued Messages** section (below the WhatsApp Message area) shows all your active and recent bulk sends.

### Queue Controls:

**Pause a Queue**
- Click the **Pause** button on any active queue
- Sending stops immediately; remaining numbers are preserved
- Useful if you need to update your template or wait for a better time

**Resume a Queue**
- Click the **Resume** button on a paused queue
- The scheduler will pick it up within 60 seconds and continue sending

**Send Next Batch Now**
- Click the **"Send Next Batch Now"** button on any active queue
- This bypasses the 24-hour wait period
- Useful when you know your Meta quota has reset (quotas reset on a rolling 24-hour basis)
- The system will attempt to send immediately on the next scheduler cycle (within 60 seconds)

**Cancel a Queue**
- Click **Cancel** to permanently stop a queue
- Remaining unsent numbers are preserved in the queue record for download

### Queue Information Displayed:
- Template name used
- Total recipients vs. sent vs. remaining
- Progress bar with percentage
- Next scheduled batch time
- Created date

---

## 7. Downloading Reports

You can download Excel reports for any bulk queue to track results.

### Available Downloads:
Click the download icon on any queue to get:

- **All Numbers** — Complete list of every number in the queue with their status (sent, failed, remaining)
- **Sent Numbers** — Only successfully sent numbers
- **Failed Numbers** — Numbers that failed with error details
- **Remaining Numbers** — Numbers still waiting to be sent

Reports are downloaded as `.xlsx` Excel files that you can open in Excel, Google Sheets, or Numbers.

---

## 8. WhatsApp Analytics

The **WhatsApp Analytics** section (below the messaging area) shows your account performance.

### Metrics Shown:
- **Messages Sent** — Total messages sent in the selected period
- **Delivered** — Successfully delivered messages with delivery rate percentage
- **Messages Read** — How many recipients opened your message (read receipts)
- **Pricing Breakdown** — Cost breakdown by message category (UTILITY, MARKETING, etc.)
- **Quality Rating** — Your phone number's quality score (GREEN = good, YELLOW = warning, RED = at risk)
- **Messaging Limit** — Your current Meta tier limit

### Time Periods:
Use the period selector to view analytics for:
- Last 7 days
- Last 14 days
- Last 30 days

### Important Note:
Meta's analytics data has a **24-48 hour delay**. The numbers you see in analytics may not reflect messages sent today. For real-time counts, refer to the bulk send progress bar during active sends.

---

## 9. Multiple WhatsApp Accounts

iMakePage supports multiple WhatsApp Business phone numbers under one login.

### Adding a New Account:
1. Go to **Settings > WhatsApp Settings**
2. Enter the new phone's **Phone Number ID** and **WABA ID**
3. Save — the new account is added to your account list

### Switching Between Accounts:
- In the **Social Media Manager**, use the account dropdown at the top of the WhatsApp Message section
- Select the account you want to send from (e.g., "Flavors Cuisine (+1 479-254-1035)")
- All actions (sending, templates, analytics) will use the selected account

### Account Information:
Each account shows:
- Display name (as approved by Meta)
- Phone number
- Quality rating and messaging tier

---

## 10. Tips for Maximum Delivery

### Use UTILITY Templates for US Numbers
Meta has restricted MARKETING template delivery to US (+1) numbers since April 2025. Use UTILITY category templates (order confirmations, appointment reminders, etc.) for reliable delivery to US contacts.

### Keep Your Quality Rating GREEN
- Avoid sending to numbers that haven't opted in
- If recipients report or block your messages, your quality score drops
- A RED quality score can result in Meta reducing your messaging tier

### Gradual Ramp-Up
- Start with smaller batches (100-250) when using a new phone number
- Increase volume gradually over days/weeks
- This helps build your messaging tier and keeps quality high

### Template Best Practices
- Keep messages concise and relevant
- Avoid excessive use of words like "FREE," "DISCOUNT," "OFFER" — these trigger MARKETING classification
- Include a clear business purpose in the message body
- Use the business name your recipients would recognize

### Timing
- Meta's daily quota resets on a rolling 24-hour basis
- The "Send Next Batch Now" button is useful after waiting 24 hours for quota reset
- The system automatically schedules the next batch, but you can trigger it manually

### Contact List Quality
- Remove invalid or disconnected numbers before importing
- Use the downloaded "Failed Numbers" report to clean your list for future sends
- Duplicate numbers are automatically removed during import

---

## 11. Troubleshooting

### "Template not found" Error
- Make sure the template is APPROVED (not PENDING or REJECTED)
- Check that you're using the correct WhatsApp account that owns the template
- Templates are per-WABA — a template created on one account won't appear on another

### Messages Accepted but Not Delivered
- Check your phone number's **name_status** — if DECLINED, messages won't deliver even though the API accepts them
- Go to Meta WhatsApp Manager and verify/resubmit the display name
- For US numbers, check if your template was reclassified as MARKETING by Meta

### Quota Limit Reached
- This is normal for large sends — Meta limits daily message volume based on your tier
- The system automatically queues remaining messages for the next day
- Use "Send Next Batch Now" after 24 hours to continue

### Common Meta Error Codes
| Error Code | Meaning | What to Do |
|---|---|---|
| 130429 | Rate limit / quota reached | Wait 24 hours, system auto-queues remaining |
| 131048 | Spam rate limit | Wait 24 hours, reduce sending speed |
| 131049 | Ecosystem health block | Meta chose not to deliver; number is re-queued automatically |
| 131056 | Ecosystem block (pair level) | Number is re-queued for retry |
| 131050 | User opted out | Remove from your contact list; do not retry |
| 132001 | Template not found | Check template name, language, and WABA match |
| 132000 | Parameter mismatch | Template expects variables — fill in all required values |

### Quality Score Dropped to YELLOW/RED
- Stop sending immediately and wait for quality to recover
- Review your contact list — remove numbers that have blocked you
- Ensure all recipients have opted in to receive your messages
- Consider reducing daily volume until quality improves

---

## Quick Reference: Complete Bulk Send Workflow

1. **Settings** — Connect your WhatsApp Business account (Phone Number ID, WABA ID, Access Token)
2. **Create Template** — Make a UTILITY template and wait for Meta approval
3. **Prepare Contacts** — Paste numbers or import from a file (CSV, Excel, etc.)
4. **Select Account** — Choose which WhatsApp number to send from
5. **Select Template** — Pick your approved template from the dropdown
6. **Click Post** — Sending begins immediately with real-time progress
7. **Monitor** — Watch the progress bar for delivery stats and errors
8. **Queue Management** — If quota is hit, the system auto-queues the rest for next day
9. **Resume** — Use "Send Next Batch Now" when ready, or let it auto-resume
10. **Download Reports** — Get Excel reports of sent, failed, and remaining numbers
