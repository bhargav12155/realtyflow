# HeyGen Feature Implementation Template

## Overview

This document provides a comprehensive template for implementing HeyGen-like video generation features on your platform. Based on research of HeyGen's full API documentation and capabilities.

---

## 1. AVATAR MANAGEMENT

### 1.1 Avatar Types

| Avatar Type | Description | Implementation Status |
|-------------|-------------|----------------------|
| **Public Avatars** | Pre-made professional avatars from HeyGen library | ✅ Implemented |
| **Photo Avatars** | Custom avatars from static photos | ✅ Implemented |
| **Video Avatars** | Custom avatars from video recordings | ✅ Implemented |
| **Instant Avatars** | Quick avatar creation from photos | ✅ Implemented |
| **Streaming Avatars** | Real-time interactive avatars via WebRTC | ✅ Implemented |

### 1.2 Photo Avatar Workflow

```
Step 1: Upload Photos
└── Upload existing photos OR generate AI photos
└── Supported formats: JPG, PNG
└── Min resolution: 300px, Max: 4096px

Step 2: Create Avatar Group
└── Group photos of the same subject
└── API: POST /v2/photo_avatar/avatar_group/create

Step 3: Train Avatar Group (LoRA)
└── Train model to recognize unique features, expressions
└── API: POST /v2/photo_avatar/training/start
└── Status polling: GET /v2/photo_avatar/photo_avatar

Step 4: Create Looks
└── Generate variations with different clothing, scenes, poses
└── Uses text prompts for look generation
└── API: POST /v2/photo_avatar/generation/generate

Step 5: Add Motion
└── Transform static image into dynamic video
└── Motion engines: Kling, Runway Gen-3/4, Minimax Hailuo
└── API: POST /v2/photo_avatar/motion/add
```

### 1.3 Avatar Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/photo-avatars/groups` | GET | List all photo avatar groups |
| `/api/photo-avatars/group/:id` | GET | Get group details with looks |
| `/api/photo-avatars/upload` | POST | Upload new photos |
| `/api/photo-avatars/train` | POST | Start training |
| `/api/photo-avatars/generate-look` | POST | Generate new look |
| `/api/kling/generate-motion` | POST | Add motion to avatar |

---

## 2. VIDEO GENERATION

### 2.1 Video Creation Flow

```
Step 1: Select Avatar
└── Choose from public, photo, or video avatars
└── Preview avatar appearance

Step 2: Choose Voice
└── Professional voices (120+ languages)
└── Custom cloned voice
└── Upload audio file

Step 3: Write/Generate Script
└── Manual text input (max 5000 chars)
└── AI-generated script
└── Upload audio file

Step 4: Configure Settings
└── Video dimensions (720p, 1080p)
└── Background (color, image, video, transparent)
└── Caption settings

Step 5: Generate & Download
└── Poll for completion status
└── Download video URL (expires in 7 days)
└── Store in S3 for long-term access
```

### 2.2 Video Generation Request Structure (V2)

```json
{
  "caption": true,
  "title": "My Video",
  "dimension": {
    "width": 1280,
    "height": 720
  },
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "AVATAR_ID",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "voice_id": "VOICE_ID",
        "input_text": "Your script here",
        "speed": 1.0,
        "pitch": 0
      },
      "background": {
        "type": "color",
        "value": "#FFFFFF"
      }
    }
  ],
  "callback_url": "https://yoursite.com/webhook/heygen"
}
```

### 2.3 Video Status Tracking

| Status | Description |
|--------|-------------|
| `pending` | Video is queued |
| `waiting` | Video is in waiting state |
| `processing` | Video is rendering |
| `completed` | Video ready for download |
| `failed` | Error occurred |

---

## 3. VOICE CAPABILITIES

### 3.1 Voice Types

| Type | Description |
|------|-------------|
| **Text Input** | AI reads text with selected voice |
| **Audio Input** | Upload audio file for lip-sync |
| **Cloned Voice** | Use custom cloned voice |

### 3.2 Voice Settings

```json
{
  "voice": {
    "type": "text",
    "voice_id": "VOICE_ID",
    "input_text": "Script text",
    "speed": 1.0,
    "pitch": 0,
    "emotion": "Friendly"
  }
}
```

### 3.3 Voice Cloning Flow

```
Step 1: Record or Upload Audio
└── Minimum 30 seconds of clear speech
└── No background music/noise

Step 2: Create Voice Clone
└── API: POST /v2/voices/clone
└── Training takes 1-5 minutes

Step 3: Use in Videos
└── Reference voice_id in video generation
```

---

## 4. MOTION ENGINES

### 4.1 Supported Motion Engines

| Engine | Provider | Quality | Speed | Cost |
|--------|----------|---------|-------|------|
| **Kling** | Kuaishou | High | Medium | $$ |
| **Runway Gen-3** | Runway | High | Medium | $$$ |
| **Runway Gen-4** | Runway | Very High | Slow | $$$$ |
| **Minimax Hailuo 1** | Minimax | Medium | Fast | $ |
| **Minimax Hailuo 2** | Minimax | High | Medium | $$ |

### 4.2 Motion Templates (HeyGen-Style)

```javascript
const MOTION_TEMPLATES = [
  {
    id: "talking_naturally",
    name: "Talking Naturally",
    description: "Natural speaking motion with subtle head movements",
    prompt: "Person speaking naturally with subtle head movements..."
  },
  {
    id: "expert_presentation",
    name: "Expert Presentation",
    description: "Confident, authoritative presentation style",
    prompt: "Professional presenter speaking confidently..."
  },
  {
    id: "dynamic_announcement",
    name: "Dynamic Announcement",
    description: "Energetic, attention-grabbing delivery",
    prompt: "Energetic person making an exciting announcement..."
  },
  {
    id: "keynote_speaker",
    name: "Keynote Speaker",
    description: "Polished, inspiring speaker on stage",
    prompt: "Polished keynote speaker with measured movements..."
  },
  {
    id: "thoughtful_conversation",
    name: "Thoughtful Conversation",
    description: "Reflective, empathetic speaking style",
    prompt: "Person having a thoughtful conversation..."
  },
  {
    id: "telling_story",
    name: "Telling a Funny Story",
    description: "Animated storytelling with humor",
    prompt: "Animated storyteller with expressive face..."
  }
];
```

### 4.3 Motion API Request (Kling)

```javascript
// POST /api/kling/generate-motion
{
  "imageUrl": "https://example.com/avatar.jpg",
  "prompt": "Person nodding and speaking naturally",
  "duration": "5", // or "10"
  "mode": "pro" // or "std"
}
```

---

## 5. STREAMING/INTERACTIVE AVATARS

### 5.1 WebRTC Streaming Flow

```
Step 1: Create Streaming Session
└── API: POST /v1/streaming.new
└── Returns session_id and access_token

Step 2: Start Session
└── API: POST /v1/streaming.start
└── Initiates WebRTC connection

Step 3: Send Commands
└── streaming.task - Send text to speak
└── streaming.interrupt - Stop current speech

Step 4: Close Session
└── API: POST /v1/streaming.stop
```

### 5.2 Streaming SDK Integration

```javascript
import StreamingAvatar, { 
  AvatarQuality, 
  StreamingEvents 
} from "@heygen/streaming-avatar";

const avatar = new StreamingAvatar({ token: ACCESS_TOKEN });

avatar.on(StreamingEvents.STREAM_READY, (event) => {
  // Stream is ready
});

await avatar.createStartAvatar({
  quality: AvatarQuality.High,
  avatarName: "AVATAR_ID",
  language: "en"
});

await avatar.speak({
  text: "Hello, how can I help you today?",
  taskType: TaskType.TALK
});
```

---

## 6. VIDEO TRANSLATION

### 6.1 Translation Flow

```
Step 1: Upload Video
└── Original video with speech

Step 2: Select Target Languages
└── Multiple languages supported
└── Up to 5 languages per request

Step 3: Configure Options
└── Voice cloning (keep original voice)
└── Lip-sync accuracy level

Step 4: Generate Translated Videos
└── API: POST /v2/video_translate
└── Poll for completion
```

### 6.2 Translation API

```json
{
  "video_url": "https://example.com/original.mp4",
  "target_languages": ["es", "fr", "de"],
  "translate_audio_only": false,
  "speaker_num": 1
}
```

---

## 7. TEMPLATES

### 7.1 Template System

```
Template Structure:
├── Scenes (1-50)
│   ├── Avatar settings
│   ├── Voice settings
│   ├── Background
│   └── Variables (text, image)
├── Global settings
│   ├── Dimensions
│   ├── Caption settings
│   └── Branding
└── Variable definitions
```

### 7.2 Template Variables

| Variable Type | Description | Example |
|---------------|-------------|---------|
| **Text** | Dynamic text content | {{customer_name}} |
| **Image** | Replaceable images | {{product_image}} |
| **Audio** | Custom audio files | {{custom_audio}} |

### 7.3 Template API

```javascript
// Generate video from template
POST /v2/template/:template_id/generate
{
  "variables": {
    "customer_name": "John Doe",
    "product_name": "Premium Widget"
  }
}
```

---

## 8. PERSONALIZED VIDEO

### 8.1 Batch Personalization

```javascript
// Create personalized videos at scale
POST /v1/personalized_video/add_contact
{
  "campaign_id": "CAMPAIGN_ID",
  "variables": {
    "first_name": "John",
    "company": "Acme Corp",
    "custom_message": "Thanks for your interest!"
  }
}
```

---

## 9. WEBHOOKS

### 9.1 Webhook Events

| Event | Description |
|-------|-------------|
| `video.completed` | Video rendering finished |
| `video.failed` | Video rendering failed |
| `avatar.training.completed` | Avatar training done |
| `translation.completed` | Translation finished |

### 9.2 Webhook Payload

```json
{
  "event": "video.completed",
  "data": {
    "video_id": "VIDEO_ID",
    "status": "completed",
    "video_url": "https://...",
    "duration": 45.2,
    "thumbnail_url": "https://..."
  },
  "callback_id": "YOUR_CALLBACK_ID"
}
```

---

## 10. IMPLEMENTATION CHECKLIST

### Core Features (Priority 1)
- [x] Avatar listing and selection
- [x] Photo avatar upload and training
- [x] Video generation with text input
- [x] Voice selection (professional voices)
- [x] Motion generation (Kling integration)
- [x] Real-time progress tracking
- [x] Video download and storage

### Enhanced Features (Priority 2)
- [x] Motion templates (HeyGen-style)
- [x] Custom voice recording
- [x] Streaming avatars (WebRTC)
- [ ] Video translation
- [ ] Template system
- [ ] Personalized video campaigns

### Advanced Features (Priority 3)
- [ ] Multiple motion engines (Runway, Minimax)
- [ ] Batch video generation
- [ ] Advanced lip-sync
- [ ] Caption customization
- [ ] Webhook integration
- [ ] HeyGen OAuth (if using their API)

---

## 11. API KEY MANAGEMENT

### HeyGen API Key
```
Location: Settings > Subscriptions & API > HeyGen API
Header: X-API-KEY: your-api-key
```

### Kling API Keys
```
Environment secrets:
- KLING_ACCESS_KEY
- KLING_SECRET_KEY
Authentication: JWT tokens (HS256)
```

---

## 12. RATE LIMITS & PRICING

### HeyGen API Tiers

| Plan | Price | Credits/Month | Features |
|------|-------|---------------|----------|
| Free | $0 | 10 | Testing, watermarked |
| Pro | $99/mo | 100 | Custom branding |
| Scale | $330/mo | 500+ | Priority processing |
| Enterprise | Custom | Unlimited | Custom avatars, SLAs |

### Kling Pricing
- Standard mode: Lower cost, good quality
- Professional mode: Higher cost, best quality
- Duration: 5 or 10 seconds per video

---

## 13. NEXT STEPS

1. **Complete Kling Integration Testing**
   - Test motion generation with real avatars
   - Verify JWT authentication works

2. **Add Additional Motion Engines**
   - Research Runway Gen-3/Gen-4 API
   - Evaluate Minimax Hailuo pricing

3. **Implement Video Templates**
   - Create template builder UI
   - Variable replacement system
   - Template library

4. **Add Video Translation**
   - Multi-language support
   - Lip-sync integration

5. **Build Personalization System**
   - Campaign management
   - Contact/variable mapping
   - Bulk generation queue

---

## Reference Links

- [HeyGen API Docs](https://docs.heygen.com/)
- [HeyGen API Reference](https://docs.heygen.com/reference/)
- [Kling AI API](https://app.klingai.com/global/dev/document-api)
- [Streaming Avatar SDK](https://www.npmjs.com/package/@heygen/streaming-avatar)
