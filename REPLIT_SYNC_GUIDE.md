# RealtyFlow Social Posting – Replit Sync Guide

This document lists every file we modified to bring YouTube + X posting online, plus the exact behaviors you need to replicate inside Replit. Hand this file to whoever deploys the Replit instance so it stays in parity with local dev.

## ✅ Summary
- **YouTube OAuth**: ✅ **IMPLEMENTED** - OAuth callback endpoint handles Google token exchange, stores access/refresh tokens, and shows success page with auto-close
- **Twitter/X OAuth**: ✅ **IMPLEMENTED** - OAuth callback with PKCE (S256) security, token exchange, and account management  
- **YouTube Video Upload**: ✅ **IMPLEMENTED** - API endpoints `/api/youtube/post` and `/api/youtube/upload-video` with video file upload, sample video fallback, watch/studio URLs
- **Video Multer Config**: ✅ **IMPLEMENTED** - 100MB file size limit, video-only file filter, dedicated uploads/videos/ directory
- **User Resolution**: ✅ **IMPLEMENTED** - Automatic user lookup/creation from OIDC tokens, YouTube token retrieval from social accounts
- **Dashboard UI**: ⏳ **PENDING** - YouTube Quick Test card with file input (optional - backend is ready)
- **Env hygiene**: The committed `.env` only contains placeholders. Real secrets live in your local/Replit environment variables.

---

## 📁 File-by-file changes

| File | Purpose | Key notes |
| --- | --- | --- |
| `.env` | Replace secrets with placeholders | Keeps repo-safe template. Copy to `.env.local` locally and map every key into Replit Secrets. |
| `server/services/socialMedia.ts` | Core YouTube service | - Falls back to `uploads/videos/demo-property-tour.mp4` (or `YOUTUBE_SAMPLE_VIDEO_PATH`).<br>- Builds a raw `multipart/related` request manually and sends it with `Authorization: Bearer <accessToken>`.<br>- Returns `{ postId, watchUrl, studioUrl }` and logs helpful diagnostics. |
| `server/routes.ts` | HTTP endpoints | - `/api/youtube/post` now resolves the authenticated session user ➜ storage user ➜ stored YouTube token.<br>- Accepts `multipart/form-data` with optional `video` file; cleans up temp uploads.<br>- Includes `watchUrl`, `studioUrl`, and `usedSampleVideo` in the JSON response.<br>- `/api/youtube/upload-video` shares the same logic for standalone uploads. |
| `client/src/components/dashboard/youtube-test-posts.tsx` | Dashboard tester | - Added file input + clear button.<br>- Mutation sends `credentials: "include"` so the backend sees cookies.<br>- Shows "Last upload" with direct Watch/Studio links so testers can click through instantly. |

> **Note:** No schema or DB migrations were required; everything plugs into the existing storage/social account model.

---

## 🔐 Environment variables to mirror on Replit
Copy every key from your private `.env` (Twitter, YouTube, session, DB, AWS, etc.) into Replit's **Secrets** tab. Pay special attention to:

- `SESSION_SECRET`, `JWT_SECRET`, `BASE_URL`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
- Any other social tokens already in use (Facebook, LinkedIn, etc.)

Also upload the sample clip (or set `YOUTUBE_SAMPLE_VIDEO_PATH`):
```
/uploads/videos/demo-property-tour.mp4
```
If you skip this file, the fallback will log a warning and only attempt a text-only auth test.

---

## 🌐 OAuth redirect checklist
Update provider dashboards so they know about the Replit hostname (replace `<app>` with your actual Replit slug):

| Provider | Needed redirect/URL |
| --- | --- |
| YouTube (Google Cloud) | `https://<app>.repl.co/api/social/callback/youtube` (and any other environments). |
| Twitter / X | `https://<app>.repl.co/api/social/callback/twitter` (plus the PKCE authorize callback if you're using one). |

Make sure the same host is stored in `BASE_URL` when the server runs on Replit, otherwise cookies + OAuth state can break.

---

## 🧪 Verification steps
1. **Restart the server** on Replit after syncing files/environment.
2. Log into the dashboard ➜ open *YouTube Quick Test Posts*.
3. (Optional) Choose a small `.mp4` using the new file picker.
4. Click **Post to YouTube**.
5. Wait for the toast ➜ click the "Watch on YouTube" link that appears under "Last upload".
6. Confirm the clip appears in **YouTube Studio → Content → Videos**.
7. Repeat for Twitter Quick Test Posts to ensure X tokens are working with the new environment values.

If anything fails, grab the server logs— each stage now logs the token source, user resolution, and upload payload so you can see exactly where the flow stopped.

---

## ⚠️ Known follow-ups
- `npm run check` still flags pre-existing TypeScript errors (content calendar, AI tools, etc.). These weren't part of the YouTube/X work but will need cleanup before a strict CI/CD gate.
- Ensure Replit's file persistence strategy keeps `uploads/videos` if you rely on the bundled sample clip. If not, set `YOUTUBE_SAMPLE_VIDEO_PATH` to a cloud URL the server can reach.

Let me know if you want this converted into a GitHub issue template or synced automatically—happy to help.
