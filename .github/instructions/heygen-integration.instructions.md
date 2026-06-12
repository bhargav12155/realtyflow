---
description: "Use when working on HeyGen integration, photo avatars, video generation, avatar looks, streaming avatars, or HeyGen templates. Covers service files, route endpoints, auth patterns, and what is/isn't integrated."
---

# HeyGen Integration — RealtyFlow

## Service Files (external/server/services/)

| File | Purpose |
|------|---------|
| `heygen.ts` | Generic video generation — builds `video_inputs` payload, POSTs to `/v2/video/generate`. Supports `avatar`, `talking_photo`, `audio_asset_id`, `audio_url`, text voice. |
| `heygen-avatar-iv.ts` | Avatar IV (upload-based photo avatars) — `uploadPhoto()` → `https://upload.heygen.com/v1/asset`, `generateVideo()` → `/v2/video/av4/generate` |
| `heygen-photo-avatar.ts` | Photo avatar group creation, look generation, AI photo generation. `generateAIPhotos()` sends `num_images: 3`. `generateNewLooks(groupId, numLooks = 3)` default is 3. |
| `heygen-template.ts` | **Active** template service used by routes — `/templates`, `/template/:templateId/generate`, `from_video`, duplicate, update, delete. |
| `heygen-templates.ts` | Alternate template file — appears **unused** by routes. Do not modify expecting it to affect anything. |
| `heygen-streaming.ts` | Streaming avatar sessions. |

## Active UI Components (external/client/src/components/dashboard/)

- **`avatar-iv-studio.tsx`** — The primary Photo Avatars / Avatar & Video dashboard surface. Uses `/api/avatar-iv/photos`, `/api/avatar-iv/generate`, `/api/avatar-iv/status/*`. This is the active flow.
- **`photo-avatars/`** folder (GenerateTab, hooks, etc.) — Older tabbed photo-avatar manager. Still present but secondary. Copy/labels match the active flow.

## Key Route Endpoints (external/server/routes.ts)

- `POST /api/photo-avatars/generate-photos` — Generates 3 AI photos (was 5, reduced). Notifies via `realtimeService.notifyPhotoGenerated(..., 3)`.
- `POST /api/photo-avatars/create-with-looks` — Creates avatar group with 3 looks.
- `GET /api/avatar-iv/photos` — Returns photo library.
- `POST /api/avatar-iv/generate` — Generates video from `imageKey`.
- `GET /api/avatar-iv/status/:id` — Polls video generation status.
- `GET /api/templates` — Lists HeyGen templates.
- `POST /api/templates/:id/generate` — Generates from template.

## Auth Pattern

All HeyGen API calls use:
```
x-api-key: ${process.env.HEYGEN_API_KEY}
```
Base URL: `https://api.heygen.com`
Upload URL: `https://upload.heygen.com`

## HeyGen Studio API — Integration Status

**Partial** — Not a full Studio scene composer. What IS integrated:
- Avatar video generation (Avatar IV)
- Template list + generate
- Streaming avatar sessions
- Single-scene video generation via `heygen.ts`

What is NOT integrated:
- Multi-scene Studio composer
- Studio scene editor API
- Studio-specific scene CRUD (`/v2/studio/scene/*`)

## Important Quirks

- After deleting a selected photo in `avatar-iv-studio.tsx`, the delete `onSuccess` handler resets: `imageKey`, `imagePreview`, `uploadedImage`, `currentStep` (back to 1), `videoTitle`, `script`, `audioBlob`, `audioUrl`, and clears input refs. This prevents stale deleted image state poisoning later actions.
- Generation count is 3 (not 5) across server payload, toast copy, and button label.
