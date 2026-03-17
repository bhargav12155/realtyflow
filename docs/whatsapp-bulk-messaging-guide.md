# WhatsApp Bulk Messaging Guide

Complete guide for sending bulk WhatsApp messages, creating templates, managing queues, and maximizing delivery through iMakePage.

---

## Table of Contents

1. [Prerequisites — Setting Up on Facebook/Meta](#1-prerequisites--setting-up-on-facebookmeta)
    - 1.1 What You Need Before Starting
    - 1.2 Step 1: Create a Facebook Business Account (Meta Business Suite)
    - 1.3 Step 2: Verify Your Business
    - 1.4 Step 3: Create a Meta App (Facebook Developers)
    - 1.5 Step 4: Add WhatsApp to Your Meta App
    - 1.6 Step 5: Register a Phone Number
    - 1.7 Step 6: Find Your Phone Number ID and WABA ID
    - 1.8 Step 7: Create a System User & Permanent Access Token
    - 1.9 Summary of What You Need
2. [Connecting WhatsApp in iMakePage](#2-connecting-whatsapp-in-imakepage)
3. [Creating Message Templates](#3-creating-message-templates)
4. [Sending a Single WhatsApp Message](#4-sending-a-single-whatsapp-message)
5. [Sending Bulk Messages](#5-sending-bulk-messages)
6. [Understanding the Bulk Queue System](#6-understanding-the-bulk-queue-system)
7. [Managing Bulk Queues](#7-managing-bulk-queues)
8. [Downloading Reports](#8-downloading-reports)
9. [WhatsApp Analytics](#9-whatsapp-analytics)
10. [Multiple WhatsApp Accounts](#10-multiple-whatsapp-accounts)
11. [Tips for Maximum Delivery](#11-tips-for-maximum-delivery)
12. [Meta/Facebook Account Issues & Restrictions](#12-metafacebook-account-issues--restrictions)
    - 12.1 Account Flagged or Restricted
    - 12.2 Marketing Messages Not Delivering (US Restriction)
    - 12.3 Template Paused by Meta
    - 12.4 Facebook Business Manager Restrictions
    - 12.5 Phone Number Quality Rating
    - 12.6 Access Token Issues
    - 12.7 Meta's Daily Messaging Limits & Tier Recovery
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites — Setting Up on Facebook/Meta

Before you can use WhatsApp messaging through iMakePage, you need to set up a few things on Facebook/Meta's side. This is a one-time setup. Follow each step below in order.

**Video Walkthrough:** If you prefer watching over reading, this YouTube video walks through the entire Meta/Facebook setup process:
[How to Set Up WhatsApp Business API (Step by Step)](https://www.youtube.com/watch?v=4ty2t8EYZ6s)

### 1.1 What You Need Before Starting

- A **Facebook account** (your personal account is fine — it's only used to manage the business account)
- A **phone number** you want to use for WhatsApp Business (this number must NOT already be registered on regular WhatsApp or WhatsApp Business app — if it is, you'll need to delete that account first)
- Your **business name, address, and website** (for business verification)
- Access to your **business email** (for verification codes)

### 1.2 Step 1: Create a Facebook Business Account (Meta Business Suite)

If you already have a Meta Business account, skip to Step 2.

1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Create Account**
3. Enter your **business name**, **your name**, and **business email**
4. Follow the prompts to complete the setup
5. You'll land on Meta Business Suite — this is your central hub for managing everything

### 1.3 Step 2: Verify Your Business

Business verification is required to send WhatsApp messages at scale. Without it, you're limited to very low volumes.

1. In Meta Business Suite, go to **Settings** (gear icon, bottom left)
2. Click **Business Settings**
3. Under **Security Center**, find **Business Verification** (or go to **Settings > Business Info > Business Verification**)
4. Click **Start Verification**
5. Enter your **legal business name**, **address**, **phone number**, and **website**
6. Meta will ask you to verify by one of these methods:
   - **Domain verification** — Add a meta tag or DNS record to your website
   - **Phone call** — Meta calls your business number with a verification code
   - **Email** — Meta sends a code to an email address on your domain
   - **Document upload** — Upload a utility bill, bank statement, or business license
7. Submit and wait — verification usually takes **1-3 business days** but can take up to a week
8. You'll get a notification when approved

**Important:** You can proceed with the remaining steps while waiting for verification, but you won't be able to send messages at scale until verification is complete.

### 1.4 Step 3: Create a Meta App (Facebook Developers)

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. If prompted, register as a developer (it's free — just agree to the terms)
3. Click **My Apps** (top right) then **Create App**
4. Select **Business** as the app type (or "Other" > "Business" depending on the current UI)
5. Enter an **App Name** (e.g., "My WhatsApp Business") and select your **Business Account** from the dropdown
6. Click **Create App**
7. You'll see your App Dashboard — note the **App ID** at the top (you'll need this later)

### 1.5 Step 4: Add WhatsApp to Your Meta App

1. In your App Dashboard, scroll down to **Add Products**
2. Find **WhatsApp** and click **Set Up**
3. You'll see the WhatsApp Getting Started page
4. Select the **Business Account** you want to associate (from Step 1)
5. Meta will automatically create a **WhatsApp Business Account (WABA)** for you

### 1.6 Step 5: Register a Phone Number

1. In the App Dashboard, go to **WhatsApp > Getting Started** (left sidebar)
2. Under **Send and receive messages**, you'll see a section to add a phone number
3. Click **Add Phone Number**
4. Enter your **business display name** (this is what message recipients will see)
5. Select your **category** (e.g., Restaurant, Real Estate, etc.)
6. Enter the **phone number** you want to use
7. Choose verification method: **Text message (SMS)** or **Phone call**
8. Enter the **verification code** you receive
9. Your number is now registered for WhatsApp Business API

**Important notes about the phone number:**
- The number **cannot** be currently registered on the regular WhatsApp app or WhatsApp Business app
- If it is, open WhatsApp on that phone, go to **Settings > Account > Delete Account**, then wait a few minutes before registering it here
- You can use a landline number — just choose "Phone call" for verification
- Each phone number can only be linked to one WhatsApp Business Account

### 1.7 Step 6: Find Your Phone Number ID and WABA ID

These two values are what you'll enter into iMakePage.

**Finding the Phone Number ID:**
1. In the App Dashboard, go to **WhatsApp > Getting Started** (left sidebar)
2. Under **Send and receive messages**, you'll see your registered phone number
3. The **Phone Number ID** is displayed right below your phone number (it's a long number like `109933769892779`)
4. Copy this value

**Alternative way to find it:**
1. Go to [business.facebook.com](https://business.facebook.com)
2. Go to **Settings > Business Settings**
3. In the left sidebar, under **Accounts**, click **WhatsApp Accounts**
4. Click on your WhatsApp account
5. Click the **Phone Numbers** tab
6. You'll see your phone number listed with its **Phone Number ID**

**Finding the WABA ID (WhatsApp Business Account ID):**
1. In the same **WhatsApp Accounts** page in Business Settings
2. Click on your WhatsApp account name
3. The **WABA ID** is shown in the account details (it's a long number like `269043823800084`)
4. You can also find it in the App Dashboard URL — when you're on the WhatsApp section, look at the URL: `...whatsapp_business_account_id=XXXXXXXXXX`
5. Copy this value

### 1.8 Step 7: Create a System User & Permanent Access Token

A System User token is the recommended way to connect — it **never expires**, unlike temporary tokens.

**Step A: Create a System User**
1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Settings** (gear icon) > **Business Settings**
3. In the left sidebar, under **Users**, click **System Users**
4. Click **Add** to create a new System User
5. Enter a name (e.g., "iMakePage WhatsApp") and set the role to **Admin**
6. Click **Create System User**

**Step B: Assign Permissions**
1. Click on the System User you just created
2. Click **Add Assets**
3. In the popup, select **Apps** from the left
4. Find your Meta App (from Step 3) and check it
5. Toggle on **Full Control** (or at minimum: Manage App)
6. Click **Save Changes**
7. Now go back and click **Add Assets** again
8. Select **WhatsApp Accounts** from the left
9. Find your WhatsApp Business Account and check it
10. Toggle on **Full Control**
11. Click **Save Changes**

**Step C: Generate the Permanent Token**
1. Back on the System User page, click **Generate New Token**
2. Select the **App** you created (from Step 3)
3. Check these permissions:
   - `whatsapp_business_messaging` (required — lets you send and receive messages)
   - `whatsapp_business_management` (recommended — lets you manage templates and settings)
4. Set token expiration to **Never** (this creates a permanent token)
5. Click **Generate Token**
6. **Copy the token immediately** — you won't be able to see it again after closing the dialog
7. Store it somewhere safe

**Important:** If you accidentally used a temporary token (from the "Getting Started" page), it expires in 24 hours. Always use the System User token described above for a permanent connection.

### 1.9 Summary of What You Need

After completing all the steps above, you should have these three values ready:

| What | Where to Find It | Example |
|---|---|---|
| **Phone Number ID** | App Dashboard > WhatsApp > Getting Started (below your phone number) | `109933769892779` |
| **WABA ID** | Business Settings > WhatsApp Accounts > Account Details | `269043823800084` |
| **Permanent Access Token** | Business Settings > System Users > Generate Token | `EAAIe5s...` (very long string) |

Now you're ready to connect WhatsApp in iMakePage!

---

## 2. Connecting WhatsApp in iMakePage

Now that you have your credentials from Meta, connect them in iMakePage.

### Steps:
1. Go to **Settings** (gear icon in the sidebar)
2. Scroll down to the **WhatsApp Settings** section
3. Enter your credentials:
   - **Phone Number ID** — The Phone Number ID from Step 6 above
   - **WhatsApp Business Account ID (WABA ID)** — The WABA ID from Step 6 above
   - **Permanent Access Token** — The System User token from Step 7 above
4. Click **Save Settings**

Once saved, WhatsApp will appear as "Connected" in the Social Media Manager.

---

## 3. Creating Message Templates

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

## 4. Sending a Single WhatsApp Message

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

## 5. Sending Bulk Messages

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

## 6. Understanding the Bulk Queue System

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

## 7. Managing Bulk Queues

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

## 8. Downloading Reports

You can download Excel reports for any bulk queue to track results.

### Available Downloads:
Click the download icon on any queue to get:

- **All Numbers** — Complete list of every number in the queue with their status (sent, failed, remaining)
- **Sent Numbers** — Only successfully sent numbers
- **Failed Numbers** — Numbers that failed with error details
- **Remaining Numbers** — Numbers still waiting to be sent

Reports are downloaded as `.xlsx` Excel files that you can open in Excel, Google Sheets, or Numbers.

---

## 9. WhatsApp Analytics

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

## 10. Multiple WhatsApp Accounts

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

## 11. Tips for Maximum Delivery

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

## 12. Meta/Facebook Account Issues & Restrictions

Understanding how Meta monitors and restricts WhatsApp Business accounts is critical to maintaining your messaging ability. This section covers common account flags, marketing restrictions, and what you can do about each.

---

### 12.1 Account Flagged or Restricted

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

### 12.2 Marketing Messages Not Delivering (US Restriction)

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

### 12.3 Template Paused by Meta

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

### 12.4 Facebook Business Manager Restrictions

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

### 12.5 Phone Number Quality Rating

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

### 12.6 Access Token Issues

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

### 12.7 Meta's Daily Messaging Limits & Tier Recovery

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

## 13. Troubleshooting

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
