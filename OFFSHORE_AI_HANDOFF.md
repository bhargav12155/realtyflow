# Offshore AI Agent Handoff (RealtyFlow)

## Repository Identity
- Repo name: `realtyflow`
- Current branch: `local-main`
- Git remote: `https://github.com/bhargav12155/realtyflow`

## Goal
Bring the app up locally in development mode and verify it is reachable.

## Prerequisites
- Node.js 18+
- npm
- PostgreSQL database (or compatible `DATABASE_URL`)

## Setup Steps
1. Clone and enter repo:
   ```bash
   git clone https://github.com/bhargav12155/realtyflow.git
   cd realtyflow
   ```
2. Checkout branch:
   ```bash
   git checkout local-main
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create `.env` in repo root with required variables (minimum to boot):
   ```env
   DATABASE_URL=postgres://...
   OPENAI_API_KEY=...
   ```
   Note: Additional integrations (Facebook, Instagram, Twitter, YouTube, HeyGen) need their own keys only when those features are used.
5. Push DB schema:
   ```bash
   npm run db:push
   ```
6. Start dev server:
   ```bash
   npm run dev
   ```

## Expected Runtime
- Dev server command runs: `tsx external/server/index.ts`
- Default port in this repo is `5001` (from `package.json`), unless `PORT` is set.
- Open: `http://localhost:5001`

## Quick Verification
- Confirm terminal shows server started without fatal errors.
- Open the app URL and verify dashboard loads.
- Optional type check:
  ```bash
  npm run check
  ```

## Useful Commands
- Build production bundle:
  ```bash
  npm run build
  ```
- Run production build:
  ```bash
  npm run start
  ```

## If Startup Fails
- Ensure `.env` exists and `DATABASE_URL` is valid.
- Confirm PostgreSQL is reachable from your machine.
- Reinstall clean dependencies:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
- Re-run:
  ```bash
  npm run db:push && npm run dev
  ```
