---
description: "Use when working on AI content generation, image generation, video generation, chat AI, boards generation, Gemini, Luma, HeyGen providers, API keys, or switching/adding AI providers."
---

# Content Providers — RealtyFlow

## Provider Map

| Provider | What it does | Service file |
|----------|-------------|--------------|
| **Gemini** | Board chat AI AND image/video generation on boards | `external/server/services/gemini.ts` |
| **Luma** | Video generation (Dream Machine) | `external/server/services/luma.ts` |
| **HeyGen** | Photo avatars, avatar video generation, templates, streaming | See `heygen-integration.instructions.md` |

## Gemini

- **Auth**: `x-goog-api-key: ${process.env.GEMINI_API_KEY}` (or via `@google/generative-ai` SDK)
- **Roles**: Primary chat AI for boards AND generates images/videos on boards canvas — not just chat.
- **Boards**: Gemini is the default provider for board asset generation (set as primary in boards flow).
- **Key**: Verified working (`HTTP 200`). Key lives in `.env` as `GEMINI_API_KEY`.

## Luma

- **Auth**: `Authorization: Bearer ${process.env.LUMA_API_KEY}`
- **Base URL**: `https://api.lumalabs.ai/dream-machine/v1`
- **Role**: Video generation for boards and standalone video creation.
- **Key**: Verified working (`HTTP 200`). Key lives in `.env` as `LUMA_API_KEY`.
- **Common failure**: `403 Not authenticated` = invalid/expired key, not a code issue. Regenerate key at lumalabs.ai.

## HeyGen

- **Auth**: `x-api-key: ${process.env.HEYGEN_API_KEY}`
- **Role**: Photo avatars, avatar-based video, templates, streaming sessions.
- **Key**: Lives in `.env` as `HEYGEN_API_KEY`.

## Boards Generation Flow

1. User types prompt in `BoardsHomeView.tsx` → creates board via `POST /api/boards`
2. Board detail page (`board-detail.tsx`) opens → triggers asset batch generation
3. Assets generate via Gemini (images/video) or Luma (video) depending on asset type
4. `BoardCanvas.tsx` shows provider-aware generating UI:
   - Spinner + "Generating" label + provider name while in-flight
   - Animated progress stripe on generating tiles
   - Provider/model label shown in batch header
5. WebSocket `board_asset_status` events patch assets live with `provider` and `modelLabel`

## Environment Variables

```
GEMINI_API_KEY=      # Google Gemini — chat + image/video generation
LUMA_API_KEY=        # Luma Dream Machine — video generation
HEYGEN_API_KEY=      # HeyGen — avatars, templates, streaming
```

## Dev Server

- Runs at `http://localhost:5001`
- Start: `cd realtyflow && npm run dev`
- TLS bypass needed for Neon DB: `NODE_TLS_REJECT_UNAUTHORIZED=0`
- Boards API requires authenticated session — can't curl without cookie.
