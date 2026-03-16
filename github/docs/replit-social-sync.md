# RealtyFlow Social Posting – Replit Sync Guide

This document lists every file we modified to bring YouTube + X posting online, plus the exact behaviors you need to replicate inside Replit. Hand this file to whoever deploys the Replit instance so it stays in parity with local dev.

## ✅ Summary

- **YouTube**: OAuth tokens are pulled from the logged-in user’s stored social account. The API uploads an actual video (user-provided or bundled sample) and returns both the public watch link and the Studio edit link.
- **Facebook & Instagram**: New quick-test flows hit the authenticated `/api/facebook/post` and `/api/instagram/post` routes, automatically reusing stored tokens/page IDs and falling back to the RealtyFlow sample image when no photo is attached.
- **Dashboard UI**: The Quick Test column now includes Facebook + Instagram cards with optional file pickers, page ID overrides, and “last post” receipts alongside the existing Twitter/YouTube testers.
- **Env hygiene**: The committed `.env` only contains placeholders. Real secrets live in your local/Replit environment variables.

---

## 📁 File-by-file changes

| File                                                       | Purpose                           | Key notes                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`                                                     | Replace secrets with placeholders | Keeps repo-safe template. Copy to `.env.local` locally and map every key into Replit Secrets.                                                                                                                                                                                                                                                                                         |
| `server/services/socialMedia.ts`                           | Core YouTube service              | - Falls back to `uploads/videos/demo-property-tour.mp4` (or `YOUTUBE_SAMPLE_VIDEO_PATH`).<br>- Builds a raw `multipart/related` request manually and sends it with `Authorization: Bearer <accessToken>`.<br>- Returns `{ postId, watchUrl, studioUrl }` and logs helpful diagnostics.                                                                                                |
| `server/routes.ts`                                         | HTTP endpoints                    | - `/api/youtube/post` resolves the authenticated session user ➜ storage user ➜ stored YouTube token.<br>- `/api/facebook/post` and `/api/instagram/post` are now protected by `requireAuth`, reuse stored social accounts/tokens, emit scheduled-post telemetry, and support the shared fallback listing photo.<br>- `/api/facebook/pages` now requires auth so tokens stay per-user. |
| `client/src/components/dashboard/youtube-test-posts.tsx`   | YouTube tester                    | - Added file input + clear button.<br>- Mutation sends `credentials: "include"` so the backend sees cookies.<br>- Shows “Last upload” with direct Watch/Studio links so testers can click through instantly.                                                                                                                                                                          |
| `client/src/components/dashboard/facebook-test-posts.tsx`  | Facebook tester                   | - Provides page-ID override, optional photo upload, and sample-image toggle.<br>- Surfaces the last post ID + whether the fallback media was used so QA can cross-check the Page feed quickly.                                                                                                                                                                                        |
| `client/src/components/dashboard/instagram-test-posts.tsx` | Instagram tester                  | - Requires either an uploaded image or the sample toggle, matching Graph API constraints.<br>- Shows the caption preview, image selection status, and the resulting post ID returned by the API.                                                                                                                                                                                      |

> **Note:** No schema or DB migrations were required; everything plugs into the existing storage/social account model.

---

## 🔐 Environment variables to mirror on Replit

Copy every key from your private `.env` (Twitter, YouTube, session, DB, AWS, etc.) into Replit’s **Secrets** tab. Pay special attention to:

- `SESSION_SECRET`, `JWT_SECRET`, `BASE_URL`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
- Any other social tokens already in use (Facebook, LinkedIn, etc.)

🎯 **New for Facebook/Instagram quick tests**

- `FACEBOOK_PAGE_ID` (or per-user metadata), `FACEBOOK_USER_TOKEN`, and/or `FACEBOOK_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID` (Business/Creator) and `INSTAGRAM_ACCESS_TOKEN`
- `SOCIAL_TEST_IMAGE_URL` (optional override for the RealtyFlow sample listing photo)

Also upload the sample clip (or set `YOUTUBE_SAMPLE_VIDEO_PATH`):

```
/uploads/videos/demo-property-tour.mp4
```

If you skip this file, the fallback will log a warning and only attempt a text-only auth test.

---

## 🌐 OAuth redirect checklist

Update provider dashboards so they know about the Replit hostname (replace `<app>` with your actual Replit slug):

| Provider               | Needed redirect/URL                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| YouTube (Google Cloud) | `https://<app>.repl.co/api/social/callback/youtube` (and any other environments).                           |
| Twitter / X            | `https://<app>.repl.co/api/social/callback/twitter` (plus the PKCE authorize callback if you’re using one). |

Make sure the same host is stored in `BASE_URL` when the server runs on Replit, otherwise cookies + OAuth state can break.

---

## 🧪 Verification steps

1. **Restart the server** on Replit after syncing files/environment.
2. Log into the dashboard ➜ open _YouTube Quick Test Posts_.
3. (Optional) Choose a small `.mp4` using the new file picker.
4. Click **Post to YouTube**.
5. Wait for the toast ➜ click the “Watch on YouTube” link that appears under “Last upload”.
6. Confirm the clip appears in **YouTube Studio → Content → Videos**.
7. Repeat for Twitter Quick Test Posts to ensure X tokens are working with the new environment values.
8. Open the **Facebook Quick Test Posts** card ➜ send one of the mock updates (with or without the sample photo) ➜ confirm it lands on the connected Facebook Page.
9. Run the **Instagram Quick Test Posts** card ➜ leave the sample image enabled (or upload your own square photo) ➜ confirm the post finishes within a couple of minutes in the Instagram app.

If anything fails, grab the server logs— each stage now logs the token source, user resolution, and upload payload so you can see exactly where the flow stopped.

---

## ⚠️ Known follow-ups

- `npm run check` still flags pre-existing TypeScript errors (content calendar, AI tools, etc.). These weren’t part of the YouTube/X work but will need cleanup before a strict CI/CD gate.
- Ensure Replit’s file persistence strategy keeps `uploads/videos` if you rely on the bundled sample clip. If not, set `YOUTUBE_SAMPLE_VIDEO_PATH` to a cloud URL the server can reach.

Let me know if you want this converted into a GitHub issue template or synced automatically—happy to help.
