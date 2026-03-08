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
11. [Meta/Facebook Account Issues & Restrictions](#11-metafacebook-account-issues--restrictions)
    - 11.1 Account Flagged or Restricted
    - 11.2 Marketing Messages Not Delivering (US Restriction)
    - 11.3 Template Paused by Meta
    - 11.4 Facebook Business Manager Restrictions
    - 11.5 Phone Number Quality Rating
    - 11.6 Access Token Issues
    - 11.7 Meta's Daily Messaging Limits & Tier Recovery
12. [Troubleshooting](#12-troubleshooting)

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

## 11. Meta/Facebook Account Issues & Restrictions

Understanding how Meta monitors and restricts WhatsApp Business accounts is critical to maintaining your messaging ability. This section covers common account flags, marketing restrictions, and what you can do about each.

---

### 11.1 Account Flagged or Restricted

Meta actively monitors all WhatsApp Business accounts for policy compliance. If your account gets flagged, you may experience:

- **Reduced messaging limits** — Your tier may be downgraded (e.g., from TIER_10K back to TIER_1K or TIER_250)
- **Messaging paused entirely** — Meta temporarily blocks all outbound messages
- **Account banned** — Permanent restriction on the phone number (rare, but possible for severe violations)

**Common reasons accounts get flagged:**
- High block/report rate from recipients
- Sending to users who haven't opted in (no prior consent)
- Sending marketing content disguised as UTILITY messages
- Rapidly scaling volume without building up quality history
- Using language that violates Meta's Commerce or Community policies
- Multiple template rejections in a short period

**What to do if your account is flagged:**
1. **Stop all sending immediately** — Continuing to send while flagged will make it worse
2. **Check your quality rating** in Meta Business Manager > WhatsApp Manager > Phone Numbers
3. **Review your recent templates** — Were any rejected or paused? This is a signal
4. **Wait 7 days** — Quality ratings typically reset on a rolling 7-day window. If you stop sending, your rating should recover
5. **Submit an appeal** via Meta Business Help Center if you believe the flag is a mistake
6. **Clean your contact list** — Remove anyone who blocked you or reported your messages
7. **When resuming**, start with very small batches (50-100) and gradually scale back up

---

### 11.2 Marketing Messages Not Delivering (US Restriction)

Since **April 2025**, Meta has imposed significant restrictions on MARKETING template messages sent to US (+1) phone numbers. This is one of the most impactful changes for US-based businesses.

**What's happening:**
- Messages sent using MARKETING templates to US numbers are **silently dropped** by Meta
- The API returns a "success" response (message accepted), but Meta never delivers the message
- There is no error code — the message simply vanishes
- This affects ALL WhatsApp Business API accounts sending to US numbers, not just yours

**How to tell if you're affected:**
- Check your analytics — if "Delivered" is significantly lower than "Sent" for US contacts, this is why
- Messages to international numbers (non-US) from the same template may deliver normally
- UTILITY templates to the same US numbers deliver fine

**What to do:**
1. **Switch to UTILITY templates** for all US (+1) audiences — these deliver reliably
2. Frame your message as transactional: appointment reminders, booking confirmations, order updates, account notifications
3. Avoid promotional language like "exclusive offer," "limited time," "discount," "free" in UTILITY templates — Meta may reclassify them as MARKETING
4. For genuine marketing messages, consider alternative channels (SMS, email, social media posts)
5. For international audiences (non-US), MARKETING templates still work normally

**UTILITY Template Examples That Work for US:**
- "Hi! Your reservation at [Business] is confirmed for [Date] at [Time]. Reply CHANGE to modify."
- "Thank you for visiting [Business]! Your receipt has been sent to your email."
- "Reminder: Your appointment with [Business] is tomorrow at [Time]. Reply YES to confirm."

---

### 11.3 Template Paused by Meta

Meta can **pause** your approved template at any time if it receives poor engagement or high complaint rates.

**Signs your template was paused:**
- Bulk sends suddenly fail with error codes **132015**, **132016**, or **132001**
- The template status changes from APPROVED to PAUSED in Meta Business Manager
- iMakePage automatically detects this and pauses your queue

**Why templates get paused:**
- Low read rates (recipients ignoring your messages)
- High block rates (recipients blocking your number after receiving the message)
- Report rates above Meta's threshold
- Content that Meta's automated systems flag as low quality
- Sending the same template too frequently to the same audience

**What to do:**
1. **Don't try to resend** with the same template — it will keep failing
2. Go to **Meta Business Manager > WhatsApp Manager > Message Templates**
3. Check the template's quality rating and status
4. You have two options:
   - **Appeal the pause** — If you believe the template is fine, click "Appeal" in Meta's template manager
   - **Create a new template** — Write a different version with improved content, then submit for approval
5. **Analyze what went wrong** — Was the content too promotional? Was the audience unengaged?
6. In iMakePage, cancel the failed queue and start a new one with an approved template

---

### 11.4 Facebook Business Manager Restrictions

Your WhatsApp Business account is tied to your Facebook Business Manager. Issues at the Business Manager level affect WhatsApp.

**Business Manager can be restricted for:**
- Advertising policy violations (even if unrelated to WhatsApp)
- Unusual payment activity on ad accounts
- Multiple rejected ads or ad accounts
- Business verification not completed or expired
- Suspicious login activity

**How Business Manager restrictions affect WhatsApp:**
- New template submissions may be blocked
- Existing templates may be paused
- Phone number verification may fail
- API access tokens may stop working
- Your WABA (WhatsApp Business Account) may be suspended

**What to do:**
1. **Go to business.facebook.com** and check for any notifications or restrictions
2. **Complete Business Verification** if you haven't already — this is required for full API access
3. **Resolve any ad account issues** — Even if you don't run ads, disabled ad accounts can affect your overall Business Manager health
4. **Check your System User** — Make sure the System User that generated your access token is still active
5. **Submit an appeal** through Meta's Business Help Center for any restrictions you believe are incorrect
6. **Keep your business information updated** — Name, address, website, and phone number must match your actual business

---

### 11.5 Phone Number Quality Rating

Meta assigns a quality rating to each WhatsApp phone number: **GREEN**, **YELLOW**, or **RED**.

| Rating | Meaning | Impact |
|---|---|---|
| GREEN | Good quality | Full messaging capacity, eligible for tier upgrades |
| YELLOW | Medium quality | Warning — if it drops further, your tier may decrease |
| RED | Low quality | Tier will be reduced; continued issues may lead to account ban |

**What affects your quality rating:**
- **Block rate** — How many recipients block your number after receiving a message
- **Report rate** — How many recipients report your messages as spam
- **Template quality** — Read rates and engagement with your templates

**How to maintain GREEN quality:**
- Only message people who have opted in
- Keep messages relevant and valuable to recipients
- Don't send too frequently to the same contacts
- Respond promptly to customer replies (improves engagement signals)
- Use personalization when possible (business name, customer details)
- Remove consistently unresponsive contacts from your lists

---

### 11.6 Access Token Issues

Your WhatsApp API access depends on a valid access token from Meta.

**Common token problems:**
- **Token expired** — If you used a temporary token instead of a permanent System User token
- **Token revoked** — Someone in your organization removed the System User or changed permissions
- **Permissions changed** — The token no longer has `whatsapp_business_messaging` permission

**How to fix:**
1. Go to **Meta Business Settings > System Users**
2. Select your System User (or create one if it was deleted)
3. Assign the following permissions:
   - `whatsapp_business_messaging` (required)
   - `whatsapp_business_management` (recommended)
4. Generate a new permanent token
5. Update the token in **iMakePage Settings > WhatsApp Settings**

**Best practices for tokens:**
- Always use a **System User** token, never a personal user token
- Use **permanent tokens** — they don't expire
- Store your token securely and don't share it
- If you suspect your token was compromised, revoke it immediately and generate a new one

---

### 11.7 Meta's Daily Messaging Limits & Tier Recovery

If your messaging tier gets downgraded due to quality issues, here's how to recover:

**Recovery timeline:**
1. **Stop sending for 7 days** — Let your quality rating reset
2. **Verify your quality** — It should return to GREEN after the cool-down period
3. **Start small** — Begin with 50-100 messages per day
4. **Monitor your quality rating** daily for the first week
5. **Gradually increase** — Double your volume every few days if quality stays GREEN
6. **Tier upgrades** — Meta automatically upgrades your tier when you consistently send at high quality

**Tips to accelerate tier recovery:**
- Send only to highly engaged contacts first
- Use UTILITY templates (higher delivery rates = better quality signals)
- Ensure every message provides clear value
- Maintain a block rate below 1%

---

## 12. Troubleshooting

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
