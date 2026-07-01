# SEO Strategy

## In scope
- Public help content at `/help`
- Public utility pages at `/login` and `/integration`
- Site-wide crawler-facing assets and metadata shared by all public routes (`client/index.html`, `robots.txt`, `sitemap.xml`, favicon, `llms.txt`)

## Out of scope
- Authenticated dashboard routes (`/`, `/dashboard`, `/social-media`, `/settings`, `/billing`, `/templates`, `/boards/**`, `/ai-assistant`, `/events`, `/calendar`, `/profile`, `/custom-voices`)
- Admin routes (`/admin/**`)
- API endpoints except where they affect crawlability or power public content
- Standalone test/demo HTML files in `client/public/` unless later confirmed to be intentional public landing pages

## Target audience
- Real estate agents and related users evaluating or using iMakePage / RealtyFlow features

## Primary keywords
- Unknown — no dedicated public marketing pages were found in source during this scan.

## Notes
- The application is a Vite + React SPA served by Express.
- Public routes currently appear to share one static HTML shell from `client/index.html`.
- The main public content page identified in source is `/help`.

## Dismissed categories
- (None yet)
