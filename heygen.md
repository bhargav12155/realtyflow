# HeyGen API Reference & Integration Guide

**Last Updated:** December 12, 2025

---

## Credit System & Pricing

### Your Investment & Credits

| Item | Amount |
|------|--------|
| **HeyGen Plan Cost** | $25,000 USD |
| **API Credits Received** | 2,987,232 credits |
| **Cost per Credit** | $0.00837 |
| **Video Type** | Avatar IV (`/video/av4/generate`) |
| **Discount vs Standard** | 98.3% OFF (60x more credits than Scale plan) |

### Standard HeyGen Pricing (For Comparison)

- **Pro Plan:** $99/mo = 100 credits → $0.99/credit
- **Scale Plan:** $330/mo = 660 credits → $0.50/credit
- **Your Deal:** $25,000 = 2,987,232 credits → **$0.00837/credit** 🔥

### Current Credit Balance

| Credit Type | Remaining | Type | Description |
|-------------|-----------|------|-------------|
| **API Credits** | 2,987,232 | ✅ PAID | Avatar IV video generation (premium) |
| **Generative Credits** | 3,358 | ✅ PAID | For AI features (Generate Look) |
| **Plan Credits** | 137 | ✅ PAID | Monthly credits from subscription |
| **Avatar IV Free** | 896 | 🆓 FREE | Bonus Avatar IV credits |
| **Instant Avatars** | 500 | 🆓 FREE | For creating instant avatars |
| **Video Agent Credits** | 600 | 🆓 FREE | For video agent features |
| **Generative Image** | 15 | 🆓 FREE | Trial credits for image generation |
| **Generative Video** | 3 | 🆓 FREE | Trial credits for video generation |
| **Concept Engine** | 20 | 🆓 FREE | Trial credits for concept engine |

---

## Two Video Generation Flows

### Flow 1: Avatar IV (Instant Photo-to-Video) - PREMIUM

- **App Endpoint:** `/api/heygen/videos`
- **HeyGen API:** `/v2/video/av4/generate`
- **Credit Rate:** 1 credit = **10 seconds**
- **When Used:** Upload photo → instant video (no training)
- **Quality:** Premium realistic with natural motion

| Video Length | Credits | Your Cost | Standard Cost | Processing Time |
|--------------|---------|-----------|---------------|-----------------|
| 10 sec | 1 | $0.008 | $0.50 | ~30-60 sec |
| 30 sec | 3 | $0.025 | $1.50 | ~1-2 min |
| 1 min | 6 | $0.050 | $3.00 | ~2-4 min |
| 5 min | 30 | $0.251 | $15.00 | ~10-15 min |

### Flow 2: Motion Video (Trained Avatar) - STANDARD

- **App Endpoint:** `/api/heygen/videos/motion`
- **HeyGen API:** `/v1/video/generate`
- **Credit Rate:** 1 credit = **1 minute** (6x cheaper!)
- **When Used:** Trained avatar with group_id + look_id + motion_id
- **Quality:** Standard with selectable motion styles

| Video Length | Credits | Your Cost | Standard Cost | Processing Time |
|--------------|---------|-----------|---------------|-----------------|
| 10 sec | 0.17 | $0.001 | $0.08 | ~30-60 sec |
| 30 sec | 0.5 | $0.004 | $0.25 | ~1-2 min |
| 1 min | 1 | $0.008 | $0.50 | ~2-3 min |
| 5 min | 5 | $0.042 | $2.50 | ~8-12 min |

### Flow Comparison

| Feature | Avatar IV | Motion Video |
|---------|-----------|--------------|
| **App Route** | `/api/heygen/videos` | `/api/heygen/videos/motion` |
| **HeyGen API** | `/v2/video/av4/generate` | `/v1/video/generate` |
| **Credit Rate** | 1 credit = 10 sec | 1 credit = 1 min |
| **Cost per 1-min** | $0.050 (6 credits) | $0.008 (1 credit) |
| **Training** | ❌ Not needed | ✅ Needs training first |
| **Requires** | `image_key` | `group_id` + `look_id` + `motion_id` |
| **Quality** | Premium/Realistic | Standard with motion |
| **Best For** | Quick instant videos | Trained avatar campaigns |
| **Processing** | ~2-4 min per 1-min video | ~2-3 min per 1-min video |

**💡 Motion videos are 6x cheaper per minute!**

---

## Avatar IV Video Generation Workflow

### Step 1: Upload Photo

Upload an image to get the `image_key` required for video generation.

```bash
curl --request POST \
     --url https://upload.heygen.com/v1/asset \
     --header 'Content-Type: image/jpeg' \
     --header 'X-API-KEY: YOUR_API_KEY' \
     --header 'accept: application/json' \
     --data-binary '@/path/to/your/photo.jpg'
```

**Response:**
```json
{
  "code": 100,
  "data": {
    "id": "a05f5cb344a94f1ba296b05d4db9b9ef",
    "name": "a05f5cb344a94f1ba296b05d4db9b9ef",
    "file_type": "image",
    "url": "https://resource2.heygen.ai/image/a05f5cb344a94f1ba296b05d4db9b9ef/original",
    "image_key": "image/a05f5cb344a94f1ba296b05d4db9b9ef/original"
  }
}
```

### Step 2: Generate Avatar IV Video

Use the `image_key` from Step 1 to create the video.

```bash
curl --request POST \
     --url https://api.heygen.com/v2/video/av4/generate \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --header 'x-api-key: YOUR_API_KEY' \
     --data '{
  "image_key": "image/a05f5cb344a94f1ba296b05d4db9b9ef/original",
  "video_title": "test from portal",
  "script": "Hello! Welcome to my video. This is a demonstration of HeyGen AI avatar technology",
  "voice_id": "119caed25533477ba63822d5d1552d25",
  "video_orientation": "landscape",
  "fit": "cover",
  "custom_motion_prompt": "nodding and smiling naturally while speaking, making gentle hand gestures",
  "enhance_custom_motion_prompt": true
}'
```

**Response:**
```json
{
  "error": null,
  "data": {
    "video_id": "630e5300773c4639b6b278f10488294a"
  }
}
```

### Step 3: Check Video Status

Poll this endpoint to check if your video is ready.

```bash
curl --request GET \
     --url https://api.heygen.com/v1/video_status.get?video_id=VIDEO_ID \
     --header 'accept: application/json' \
     --header 'x-api-key: YOUR_API_KEY'
```

**Status Values:**
- `"pending"` - Video is queued
- `"processing"` - Video is being rendered
- `"completed"` - ✅ Video is ready! Response includes `video_url`
- `"failed"` - ❌ Generation failed

**Completed Response:**
```json
{
  "code": 100,
  "data": {
    "video_id": "630e5300773c4639b6b278f10488294a",
    "status": "completed",
    "video_url": "https://resource.heygen.com/video/...",
    "title": "test from portal",
    "duration": 8.5
  }
}
```

### Avatar IV Parameters

**Required:**
- `image_key` - From upload response (Step 1)
- `video_title` - Name for your video
- `script` - Text the avatar will speak (max 1500 chars)
- `voice_id` - Voice ID from HeyGen voice library

**Optional:**
- `video_orientation` - `"portrait"` or `"landscape"` (default: portrait)
- `fit` - `"cover"` or `"contain"` (how avatar fits in frame)
- `custom_motion_prompt` - Text describing desired motion/gestures
- `enhance_custom_motion_prompt` - `true` to let AI enhance motion

**Alternative Audio Options (instead of script + voice_id):**
- `audio_url` - URL to custom audio file
- `audio_asset_id` - HeyGen asset ID from uploaded audio

---

## Photo Avatar Workflow (Trained Avatars)

### Step 1: Upload Photo

```bash
curl --request POST \
  --url https://upload.heygen.com/v1/asset \
  --header 'Content-Type: image/jpeg' \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --header 'accept: application/json' \
  --data-binary '@/path/to/photo.jpg'
```

**Response:**
```json
{
  "code": 100,
  "data": {
    "id": "de91e8fedb1444669c597a8488d73f47",
    "file_type": "image",
    "url": "https://resource2.heygen.ai/image/de91e8fedb1444669c597a8488d73f47/original",
    "image_key": "image/de91e8fedb1444669c597a8488d73f47/original"
  }
}
```

**Save:** `asset_id`, `image_key`

### Step 2: Create Avatar Group

```bash
curl --request POST \
  --url https://api.heygen.com/v2/photo_avatar/avatar_group/create \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --header 'x-api-key: YOUR_API_KEY' \
  --data '{
  "name": "Test Avatar Group",
  "image_key": "image/de91e8fedb1444669c597a8488d73f47/original"
}'
```

**Response:**
```json
{
  "error": null,
  "data": {
    "id": "5b5566c8bba64376b154abdb565e0333",
    "name": "Test Avatar Group",
    "status": "pending",
    "group_id": "5b5566c8bba64376b154abdb565e0333",
    "is_motion": false
  }
}
```

**Save:** `group_id`, note `status: "pending"` means training needed

### Step 3: Train Avatar Group

```bash
curl --request POST \
  --url https://api.heygen.com/v2/photo_avatar/train \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --header 'x-api-key: YOUR_API_KEY' \
  --data '{
  "group_id": "5b5566c8bba64376b154abdb565e0333"
}'
```

**Response:**
```json
{
  "error": null,
  "data": {
    "code": 100,
    "data": {
      "num_of_photar": 1,
      "flow_id": "9cbccd9cd4e14b7294bbac00e23f8bfc"
    }
  }
}
```

⏳ **Wait ~30 seconds before proceeding**

### Step 4: Check Training Status

```bash
curl --request GET \
  --url https://api.heygen.com/v2/photo_avatar/train/status/GROUP_ID \
  --header 'accept: application/json' \
  --header 'x-api-key: YOUR_API_KEY'
```

**Response:**
```json
{
  "error": null,
  "data": {
    "status": "ready",
    "error_msg": null
  }
}
```

**Status Values:** `"pending"`, `"processing"`, `"ready"`, `"failed"`

### Step 5: Generate Photo Avatar Look

```bash
curl --request POST \
  --url https://api.heygen.com/v2/photo_avatar/look/generate \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --header 'x-api-key: YOUR_API_KEY' \
  --data '{
  "group_id": "5b5566c8bba64376b154abdb565e0333",
  "prompt": "wearing a professional blue business suit, confident smile, office background with natural lighting",
  "orientation": "square",
  "pose": "half_body",
  "style": "Realistic"
}'
```

**Parameters:**
- `group_id`: Your avatar group ID
- `prompt`: Description of the look (max 1000 chars)
- `orientation`: `"square"`, `"horizontal"`, or `"vertical"`
- `pose`: `"half_body"`, `"close_up"`, or `"full_body"`
- `style`: `"Realistic"`, `"Pixar"`, `"Cinematic"`, `"Vintage"`, `"Noir"`, `"Cyberpunk"`, etc.

**Response:**
```json
{
  "error": null,
  "data": {
    "generation_id": "8395c80a38514de784c51b9efd365c4d"
  }
}
```

⏳ **Wait ~1-2 minutes**

### Step 6: Check Look Generation Status

```bash
curl --request GET \
  --url https://api.heygen.com/v2/photo_avatar/look/status/GENERATION_ID \
  --header 'accept: application/json' \
  --header 'x-api-key: YOUR_API_KEY'
```

### Step 7: Add Motion to Avatar

```bash
curl --request POST \
  --url https://api.heygen.com/v2/photo_avatar/add_motion \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --header 'x-api-key: YOUR_API_KEY' \
  --data '{
  "id": "5b5566c8bba64376b154abdb565e0333"
}'
```

**Important:** Use `id` parameter (NOT `group_id`)

**Response:**
```json
{
  "error": null,
  "data": {
    "id": "2e75cb6622b548f3bdfa6c04b1d7544f"
  }
}
```

⏳ **Wait ~30 seconds**

### Step 8: Check Avatar Status

```bash
curl --request GET \
  --url https://api.heygen.com/v2/photo_avatar/GROUP_ID \
  --header 'accept: application/json' \
  --header 'x-api-key: YOUR_API_KEY'
```

Verify `is_motion: true` before using for video generation.

---

## Motion Prompt Examples

- `"nodding and smiling naturally while speaking, making gentle hand gestures"`
- `"professional business presenter with confident posture"`
- `"enthusiastic and energetic with expressive hand gestures"`
- `"calm and thoughtful, speaking slowly"`
- `"friendly customer service representative"`

---

## Processing Times Summary

| Flow/Action | What Happens | Processing Time |
|-------------|--------------|-----------------|
| **Upload Photo** | Upload to HeyGen `/v1/asset` | ~2-5 seconds |
| **Avatar IV Video** | Photo → Video (no training) | ~2-4 min per 1-min video |
| **Avatar Training** | Train photo avatar | ~5-15 minutes |
| **Generate Look** | Create styled look | ~30-90 seconds |
| **Motion Video** | Trained avatar → Video | ~2-3 min per 1-min video |
| **Video Status Check** | Poll for completion | Instant (API call) |

### Complete User Journey Times

#### Path A: Quick Video (Avatar IV)
| Step | Action | Time |
|------|--------|------|
| 1 | Upload photo | ~3 sec |
| 2 | Generate 1-min video | ~2-4 min |
| **Total** | | **~2-5 minutes** |

#### Path B: Trained Avatar (Motion Video)
| Step | Action | Time |
|------|--------|------|
| 1 | Upload photo | ~3 sec |
| 2 | Train avatar | ~5-15 min |
| 3 | Generate Look | ~30-90 sec |
| 4 | Generate 1-min video | ~2-3 min |
| **Total (first video)** | | **~8-20 minutes** |
| **Subsequent videos** | | **~2-3 minutes each** |

---

## Total Capacity (2,987,232 Credits)

### If Using Avatar IV Only (1 credit = 10 sec)
| Metric | Value |
|--------|-------|
| 10-second videos | 2,987,232 videos |
| 1-minute videos | 497,872 videos |
| Total minutes | 497,872 min (~8,298 hours) |
| Your cost per min | $0.050 |

### If Using Motion Video Only (1 credit = 1 min)
| Metric | Value |
|--------|-------|
| 1-minute videos | 2,987,232 videos |
| Total minutes | 2,987,232 min (~49,787 hours) |
| Your cost per min | $0.008 |

**💡 Motion videos give you 6x more video minutes!**

---

## Recommended User Pricing

| Package | What User Gets | Price | Your Cost | Profit | Margin |
|---------|----------------|-------|-----------|--------|--------|
| **⚡ Quick Video** | 30-sec instant video (Avatar IV) | $0.99 | $0.025 | $0.965 | 3,860% |
| **🎬 Standard Video** | 1-min instant video (Avatar IV) | $1.99 | $0.050 | $1.94 | 3,880% |
| **🎨 Look Pack** | 4 AI-generated looks | $1.99 | ~$0 | ~$1.99 | ~100% |
| **🏃 Motion Video** | 30-sec trained avatar video | $0.79 | $0.004 | $0.786 | 19,650% |
| **🎥 Motion Video+** | 1-min trained avatar video | $1.49 | $0.008 | $1.48 | 18,500% |
| **🚀 Creator Bundle** | Training + 4 looks + 1 video | $4.99 | $0.05 | $4.94 | 9,880% |

### Best Margins = Motion Videos! 🔥

Motion videos have the **highest profit margins** (18,000-19,000%) because they use the standard avatar API (1 credit = 1 min) instead of Avatar IV (1 credit = 10 sec).

**Strategy:** Encourage users to train avatars → Use motion videos → Higher profits!

---

## App Implementation Status

### ✅ Implemented
- Photo upload to HeyGen
- Avatar group creation
- Avatar training
- Training status check
- Add motion to avatar
- Video status polling
- Look generation (backend only)

### ❌ Missing Features
1. **Avatar IV (AV4) Video Generation** - `/v2/video/av4/generate` endpoint
   - Simpler instant photo-to-video workflow
   - Supports `custom_motion_prompt` and `enhance_custom_motion_prompt`
   
2. **Look Status Polling** - `/v2/photo_avatar/look/status/{generation_id}`
   - Need to poll until look generation completes
   
3. **Full Edit Look UI** - Frontend form with:
   - Prompt input (clothing, mood, background)
   - Orientation dropdown (square, horizontal, vertical)
   - Pose dropdown (half_body, close_up, full_body)
   - Style dropdown (Realistic, Pixar, Cinematic, etc.)

---

## Key Notes

✅ **Upload endpoint:** `https://upload.heygen.com/v1/asset` (NOT api.heygen.com)
✅ **Use binary upload:** `--data-binary '@/path/to/file'` (NOT `--form`)
✅ **Set proper Content-Type:** `image/jpeg`, `image/png`, etc.
✅ **Video generation typically takes 1-3 minutes**
✅ **Poll status every 10-30 seconds until completed**
