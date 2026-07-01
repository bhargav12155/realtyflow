# Objective
Audit the project's SEO posture from source code and produce prioritized, actionable findings.

# Relevant information
- Framework: Vite + React SPA served by Express
- Rendering model: Shared `client/index.html` shell; client-side routing via Wouter; Express/Vite catch-all serves index.html for unknown routes
- Public routes in scope: `/help`, `/login`, `/integration`
- Authenticated routes out of scope: `/`, `/dashboard`, `/social-media`, `/settings`, `/billing`, `/templates`, `/boards/**`, `/ai-assistant`, `/events`, `/calendar`, `/profile`, `/custom-voices`
- Admin routes out of scope: `/admin/**`
- Public content route identified: `/help` (Help & Guides, populated by `/api/whatsapp/guide/content`)
- Crawlability concern already observed: no `robots.txt`, `sitemap.xml`, or `llms.txt` found in source; Express static fallback likely returns SPA HTML for unknown asset URLs
- Shell concern already observed: `client/index.html` lacks title/description/canonical/OG/Twitter tags and loads a very large Google Fonts stylesheet synchronously
- Favicon concern already observed: no favicon declaration or conventional favicon file found

# Tasks

### T001: Crawlability and bot-files audit
- **Blocked By**: []
- **Details**:
  - Confirm behavior and source evidence for `robots.txt`, `sitemap.xml`, `llms.txt`, fallback handling, and public-route discoverability.
  - Files: `server/vite.ts`, `server/index.ts`, `client/public/**`, `client/src/App.tsx`, `client/src/pages/help-guides.tsx`
  - Acceptance: Concrete findings for bot files / discoverability, or category confirmed clean.

### T002: Shared shell metadata and favicon audit
- **Blocked By**: []
- **Details**:
  - Audit `client/index.html` for title, description, canonical, OG/Twitter, lang, favicon, and render-blocking head resources.
  - Files: `client/index.html`, `dist/public/index.html`, `client/public/**`
  - Acceptance: Shared-shell issues documented with file-level evidence and clear fixes.

### T003: Public-route rendering and content audit
- **Blocked By**: []
- **Details**:
  - Audit `/help`, `/login`, and `/integration` for SPA-vs-SSR SEO risk, heading/content behavior, structured data, and internal linking.
  - Files: `client/src/App.tsx`, `client/src/pages/help-guides.tsx`, `client/src/pages/login.tsx`, `client/src/pages/integration.tsx`, `client/src/pages/not-found.tsx`, `client/src/components/ProtectedRoute.tsx`
  - Acceptance: Every in-scope public route classified; public-content risks and route-specific gaps filed if warranted.
