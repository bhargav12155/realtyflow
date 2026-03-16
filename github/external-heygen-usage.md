# Automated Workflow APIs

## API 1: Create Avatar with Looks

**Endpoint:** `POST /api/photo-avatars/create-with-looks`

Upload an image and automatically get a trained avatar with 4 professional looks.

### Request

```bash
curl --request POST \
  --url http://localhost:3001/api/photo-avatars/create-with-looks \
  --form 'image=@/path/to/photo.jpg' \
  --form 'name=John Doe' \
  --form 'prompt=professional business attire, confident smile' \
  --form 'orientation=square' \
  --form 'pose=half_body' \
  --form 'style=Realistic'
```

### Parameters

- `image` (required): Image file (JPEG, PNG, WebP)
- `name` (optional): Avatar name (default: "Avatar {timestamp}")
- `prompt` (optional): Custom look description for first look
- `orientation` (optional): "square", "horizontal", or "vertical" (default: "square")
- `pose` (optional): "half_body", "close_up", or "full_body" (default: "half_body")
- `style` (optional): "Realistic", "Pixar", "Cinematic", etc. (default: "Realistic")

### Response

```json
{
  "success": true,
  "group_id": "5b5566c8bba64376b154abdb565e0333",
  "avatar_name": "John Doe",
  "training_status": "ready",
  "looks": [
    {
      "index": 1,
      "generation_id": "8395c80a38514de784c51b9efd365c4d",
      "prompt": "professional business attire, confident smile"
    },
    {
      "index": 2,
      "generation_id": "f234a90b12c34ef896d78e1abcd234ef",
      "prompt": "casual smart outfit, friendly expression, outdoor setting"
    },
    {
      "index": 3,
      "generation_id": "a789b12c34d56ef789012abc345def67",
      "prompt": "formal suit, professional headshot, studio lighting"
    },
    {
      "index": 4,
      "generation_id": "c456d78e90f12abc345678def901234",
      "prompt": "business casual, approachable demeanor, modern workspace"
    }
  ],
  "message": "Avatar created and trained successfully. Looks are being generated (1-2 minutes).",
  "check_status_url": "/api/heygen/avatars/5b5566c8bba64376b154abdb565e0333"
}
```

### Timeline

- Image upload: ~2 seconds
- Avatar creation: ~1 second
- Image processing wait: 30 seconds
- Training: 2-5 minutes
- Look generation: 1-2 minutes (happens in background)

**Total wait time:** ~6-8 minutes for fully trained avatar with looks

---

## API 2: Generate Video from Image

**Endpoint:** `POST /api/photo-avatars/generate-video-from-image`

Upload an image, provide a script, and get a complete video link.

### Request

```bash
curl --request POST \
  --url http://localhost:3001/api/photo-avatars/generate-video-from-image \
  --form 'image=@/path/to/photo.jpg' \
  --form 'name=Sarah Johnson' \
  --form 'script=Welcome to our company! We are excited to help you find your dream home.' \
  --form 'voice_id=1c7c897eeb2d4b5fb17d3c6c70250b24'
```

### Parameters

- `image` (required): Image file (JPEG, PNG, WebP)
- `script` (required): Text for the avatar to speak
- `name` (optional): Avatar name (default: "Video Avatar {timestamp}")
- `voice_id` (optional): HeyGen voice ID (default: professional female voice)

### Response

```json
{
  "success": true,
  "group_id": "5b5566c8bba64376b154abdb565e0333",
  "avatar_id": "5b5566c8bba64376b154abdb565e0333",
  "video_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "message": "Avatar created, trained, and video generation started. Video will be ready in 2-5 minutes.",
  "check_video_url": "/api/heygen/videos/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

---

## API 3: Check Avatar Workflow Status

**Endpoint:** `GET /api/photo-avatars/status/:groupId`

Check the complete status of avatar training, looks, and motion.

### Request

```bash
curl --request GET \
  --url http://localhost:3001/api/photo-avatars/status/5b5566c8bba64376b154abdb565e0333
```

### Response

```json
{
  "group_id": "5b5566c8bba64376b154abdb565e0333",
  "training": {
    "status": "ready",
    "is_complete": true
  },
  "avatar": {
    "name": "John Doe",
    "status": "completed"
  },
  "looks": {
    "count": 4,
    "list": [...]
  },
  "workflow_status": {
    "ready_for_video": true,
    "percent_complete": 100
  }
}
```

---

## API 4: Check Video Generation Status

**Endpoint:** `GET /api/photo-avatars/video-status/:videoId`

### Response (Completed)

```json
{
  "video_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "status": "completed",
  "is_complete": true,
  "video_url": "https://heygen.ai/videos/abc123.mp4",
  "thumbnail_url": "https://heygen.ai/thumbnails/abc123.jpg",
  "duration": 15.5
}
```

---

## Common Voice IDs

```
92c93dc0dff2428ab0bea258ba68f173 - Professional Male - Confident
f577da968446491289b53bceb77e5092 - Professional Male - Warm
73c0b6a2e29d4d38aca41454bf58c955 - Professional Female - Clear
1c7c897eeb2d4b5fb17d3c6c70250b24 - Professional Female - Friendly (default)
119caed25533477ba63822d5d1552d25 - Neutral - Balanced
```

---

## Complete Workflow Example

```bash
# Step 1: Create avatar with looks
curl -X POST http://localhost:3001/api/photo-avatars/create-with-looks \
  -F "image=@photo.jpg" \
  -F "name=John Smith"

# Step 2: Poll status every 30 seconds
curl http://localhost:3001/api/photo-avatars/status/abc123

# Step 3: Generate video from trained avatar
curl -X POST http://localhost:3001/api/photo-avatars/generate-video-from-image \
  -F "image=@photo.jpg" \
  -F "script=Hello world!"

# Step 4: Poll video status
curl http://localhost:3001/api/photo-avatars/video-status/xyz789
```
