# RealtyFlow — App Overview

## What is it?
RealtyFlow is an AI-powered content creation platform built for real estate agents. It lets agents generate social media posts, blog articles, images, and videos using AI — all from a single dashboard.

---

## Core Features

### Boards
A "Board" is like a project workspace. Each board has a canvas where generated assets (images, videos) appear as tiles, and a chat panel where you prompt the AI to create things.

- You type a prompt in the board chat (e.g. "create a video of a modern kitchen")
- The AI generates the asset and it appears as a tile on the canvas
- You can keep adding more assets to the board
- When you're done, you click **Compile** to stitch all the video tiles into one final MP4 video that downloads to your computer

### Image Generation
- Uses **Gemini Image** (Google's AI image model)
- Generates **3 variations** per prompt
- An AI judge automatically picks the best one
- You can override the winner by clicking any tile
- Can also **edit existing images** if you reference one in your prompt

### Video Generation
- Uses **Luma Ray 2** by default (best motion + camera control)
- Can also use **Google VEO** (say "veo" in your prompt or select it in the picker)
- Generates **1 video** per prompt
- Three generation modes:
  - **Text to Video** — describe a scene from scratch
  - **Image to Video** — click an image tile on the board, then prompt it to animate
  - **Video to Video** — click a video tile, then prompt it to restyle/transform

### Avatar Videos
- Uses **HeyGen** to create talking-head avatar videos
- Select HeyGen from the provider picker in the board

### Brainstorm / Chat Mode
- Ask the AI questions or get content ideas without generating anything
- Falls back across Gemini → Claude → ChatGPT automatically if one is unavailable

### Social Media Posts
- Generate captions for Instagram, LinkedIn, Facebook, Twitter/X
- Schedule posts via the Content Calendar

### Blog Articles
- AI-generated blog articles from a prompt
- Formatted and ready to publish

### Quick Posts
- Pre-built templates for common real estate post types (Just Listed, Open House, Market Update, etc.)

### Photo Avatars
- Upload a photo and create a branded AI avatar

---

## How Boards Work (Step by Step)

1. Create a new board or open an existing one
2. Type what you want in the chat box (e.g. "generate an image of a luxury living room")
3. Select the provider (Luma, VEO, Gemini Image, HeyGen) — defaults to the right one automatically
4. Asset tiles appear on the canvas instantly (as "queued"), then update live as they generate
5. For images: 3 variations are generated, AI picks the best one automatically
6. For video: 1 video is generated per prompt
7. To animate an image into a video: click the image tile (it gets attached to your message), then type "animate this" or describe the motion
8. When all your video tiles are ready, click **Compile** in the top bar → one MP4 downloaded

---

## Tech Stack (for context)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Neon serverless)
- **AI Providers**: Luma, Google VEO, Gemini Image, HeyGen, Claude, Gemini (chat), OpenAI (chat fallback)
- **Real-time**: WebSocket for live asset status updates on the canvas
- **Video compile**: ffmpeg (normalizes and concatenates clips)

---

## Current Provider Status
| Provider | Type | Status |
|----------|------|--------|
| Luma Ray 2 | Video (t2v, i2v, v2v) | ✅ Active — default |
| Google VEO | Video (i2v) | ✅ Active |
| Gemini Image | Image generation + editing | ✅ Active |
| HeyGen | Avatar video | ✅ Active |
| Runway, Sora 2, Seedance | Video | ⏸ Hidden (routing all video to Luma) |
