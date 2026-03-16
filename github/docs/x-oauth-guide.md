# X / Twitter OAuth + Posting Deep-Dive

This guide captures everything required to bring the RealtyFlow X (Twitter) integration online in both local dev and Replit. Share it with anyone who needs to bootstrap the social connect + posting flow without digging through the codebase.

---

## ✅ What the flow does

1. **Dashboard → `/api/social/connect/x`** (see `client/src/components/dashboard/social-media-manager.tsx`). The UI calls this endpoint, expects an `authUrl`, and opens the provider popup.
2. **Server builds the authorize URL** inside `server/routes.ts`:
   - Resolves the authenticated user to a MemStorage UUID.
   - Generates PKCE verifier/challenge and caches it in `pkceStore` keyed by the encoded `state` blob `{ userId, platform }`.
   - Requires `TWITTER_CLIENT_ID`; if it is missing you get `OAuth not configured for x`.
3. **X redirects back to `/api/social/callback/twitter`** with `code` + `state`.
   - The callback fetches the PKCE verifier, exchanges the code for access + refresh tokens (`https://api.twitter.com/2/oauth2/token`).
   - Tokens are saved to `storage.createSocialMediaAccount` (platform stored as `x`).
   - Popup notifies the opener via `window.postMessage({ success: true, platform: 'x' })`.
4. **Posting endpoints reuse those tokens** via `socialMediaService`:
   - `/api/twitter/post` (multer upload) sends tweets with optional media.
   - `/api/twitter/validate` checks stored credentials.
   - `/api/twitter/post/:tweetId` deletes tweets when testing.

Once the connect flow succeeds, any UI card that includes `x` in its platform list will automatically use the stored account.

---

## 🔐 Required environment variables

Add these to `.env` locally and to **Replit → Secrets** when deploying there:

| Key                               | Purpose                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASE_URL`                        | Absolute origin the backend should use in OAuth redirects. `http://localhost:5000` locally, `https://<your-replit-slug>.repl.co` on Replit. |
| `TWITTER_CLIENT_ID`               | X OAuth 2.0 client ID (a.k.a. App ID). Needed at connect time.                                                                              |
| `TWITTER_CLIENT_SECRET`           | Secret used during token exchange.                                                                                                          |
| `SESSION_SECRET`, `JWT_SECRET`    | Already required for auth; without them cookies fail and OAuth endpoints return 401.                                                        |
| `REPLIT_DEV_DOMAIN` (Replit only) | Automatically injected; server falls back to this when `BASE_URL` is missing.                                                               |

Optional but recommended:

| Key                        | Why                                                                       |
| -------------------------- | ------------------------------------------------------------------------- |
| `SOCIAL_TEST_IMAGE_URL`    | Default media when you call `/api/twitter/post` without uploading a file. |
| `UPLOADED_ASSETS_BASE_URL` | Ensures uploaded images resolve to a public URL when tweeted.             |

> ⚠️ The committed `.env` is a template. Copy it to `.env.local` (or edit `.env` in Replit) with real secrets.

---

## 🧩 X Developer Portal setup

1. Create a **Project + App** at [developer.twitter.com](https://developer.twitter.com/).
2. In the **User authentication settings** section:
   - Enable **OAuth 2.0** with **Type: Web App**.
   - Redirect URL: `https://<your-host>/api/social/callback/twitter` (add localhost + Replit variants).
   - Add the same domain to **Website URL** and **Terms of Service / Privacy** if prompted.
3. Generate a **Client ID** and **Client Secret** from the Keys & Tokens tab (make sure to copy the secret once).
4. Under **App permissions**, choose **Read and write** (or read/write + DM if you need it later).
5. Save changes, then paste the client credentials into your environment.

---

## 🖥️ Local development checklist

1. Update `.env` (or `.env.local`):
   ```
   BASE_URL=http://localhost:5000
   TWITTER_CLIENT_ID=your-client-id
   TWITTER_CLIENT_SECRET=your-client-secret
   SESSION_SECRET=dev-session-secret
   JWT_SECRET=dev-jwt-secret
   ```
2. Restart the server (`npm run dev` at the repo root runs Vite + Express via `concurrently`).
3. Sign in to the dashboard, open **Social Media Manager**, and click **Connect** on the X card.
4. Approve the OAuth prompt → the popup should close automatically, and the UI toast “Connected Successfully!” should fire.
5. Use the **Twitter Test Posts** panel (`client/src/components/dashboard/twitter-test-posts.tsx`) to send a sample tweet. The toast will include the tweet ID returned by `/api/twitter/post`.

---

## ☁️ Replit-specific instructions

1. In the Replit workspace, open **Secrets** and add every key from the table above (plus existing Facebook/YouTube credentials).
2. Ensure `BASE_URL` matches the live repl URL (e.g., `https://realtyflow-main.ananya.repl.co`). Without this, OAuth callbacks will redirect to localhost and fail.
3. Upload any sample media you rely on to the Replit filesystem (e.g., `/uploads/images/sample-listing.jpg`). If persistence is an issue, host the asset externally and reference it via `SOCIAL_TEST_IMAGE_URL`.
4. Restart the repl so secrets refresh.
5. Re-run the connect flow from the dashboard inside the Replit-hosted app. If popups are blocked, the UI will throw “Popup blocked” — allow popups for the repl domain.
6. After connecting, run the “Twitter Quick Test” card. The server logs (visible in the Replit console) will print the payload and resulting tweet ID; copy it to verify directly at `https://x.com`.

---

## 🔁 Posting flow details

| Stage            | File                                                                                                             | Notes                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI connect       | `client/src/components/dashboard/social-media-manager.tsx`                                                       | Fetches `/api/social/connect/:platform` with `POST`. Shows `Failed to get OAuth URL for x` if the server returns non-200.                                                    |
| Connect endpoint | `server/routes.ts` (search for `app.post("/api/social/connect/:platform"`)                                       | Validates auth, resolves user, builds provider URLs, and returns `{ authUrl }`. Requires `requireAuth`.                                                                      |
| PKCE cache       | `pkceStore` inside `server/routes.ts`                                                                            | Stores `{ codeVerifier, expiresAt }` keyed by the encoded state string. Cleanup happens once the callback completes.                                                         |
| Callback         | `app.get("/api/social/callback/:platform"...)`                                                                   | Handles LinkedIn, Facebook, YouTube, and X. For X it uses Basic auth with `clientId:clientSecret` to grab tokens, then persists them via `storage.createSocialMediaAccount`. |
| Posting          | `app.post("/api/twitter/post"...)`                                                                               | Accepts multipart or JSON, uploads optional media through `socialMediaService.postToTwitter`. Returns `{ success, postId }`.                                                 |
| Client testers   | `client/src/components/dashboard/twitter-test-posts.tsx`, `social-media-manager.tsx`, `ai-content-generator.tsx` | Call `/api/twitter/post`; errors bubble up to toasts.                                                                                                                        |

---

## 🧪 How to verify end-to-end

1. **Connect** X via the dashboard (watch server logs for `✅ Twitter token exchange successful`).
2. Hit **/api/twitter/validate** in a new tab to confirm `{ "valid": true }`.
3. Use the **Twitter Test Posts** component to send a tweet with:
   - Text only.
   - Text + uploaded image.
4. Confirm tweets appear on the connected account. The response includes `postId`; open `https://x.com/anyuser/status/<postId>`.
5. (Optional) Delete the tweet using `DELETE /api/twitter/post/<postId>` to validate cleanup.

---

## 🐞 Troubleshooting matrix

| Symptom                                                      | Likely cause                                                               | Fix                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Toast: `Failed to get OAuth URL for x`                       | `TWITTER_CLIENT_ID` missing or request not authenticated.                  | Set the env var (and restart) or ensure you’re logged in before clicking Connect. |
| Redirect lands on `/ ?oauth_error=pkce_verifier_not_found`   | `pkceStore` lost state (server restarted mid-flow, or `state` tampered).   | Retry the connect flow; ensure the server stays alive until callback completes.   |
| `/api/twitter/post` returns `Failed to post to Twitter: 403` | App lacks “Read and write” permission or tokens expired.                   | Upgrade the app in the Twitter portal, then reconnect to refresh tokens.          |
| Popup stays blank with `missing_credentials`                 | Either `TWITTER_CLIENT_ID` or `TWITTER_CLIENT_SECRET` not set.             | Populate both secrets and restart.                                                |
| Replit works locally but not on hosted repl                  | `BASE_URL` still points to localhost so callbacks never hit Replit server. | Update `BASE_URL` in Secrets, restart, reconnect.                                 |

---

## 📌 Next steps / nice-to-haves

- Automate PKCE storage persistence so restarting the server mid-OAuth doesn’t force a retry.
- Add a health indicator to the dashboard that surfaces `/api/twitter/validate` so QA can spot credential issues before posting.
- Consider encrypting stored access tokens at rest if you move away from in-memory storage.

If you need the same level of detail for another provider, replicate this doc alongside `facebook-api-reference.md` in `docs/`.
