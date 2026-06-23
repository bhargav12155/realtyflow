---
name: Boards provider availability gating
description: How the Boards provider picker hides non-working providers, and why hiding is UI-only.
---

# Boards provider availability

`GET /api/boards/providers/availability` (in `server/routes/boards-chat.ts`)
returns a flat `{ providerId: boolean }` map. The Boards `PlatformPicker`
filters out any provider whose value is `false`.

Most providers are gated by API-key presence. A few are hard-coded `false`
because they have a key but cannot actually work in Boards:
- `heygen` — has a key but no Boards create-mode dispatch path (lives in Video Studio).
- `sora2` — third-party reseller domain (sora2api.ai) is dead / NXDOMAIN.
- `seedance` — configured key is rejected by BytePlus (HTTP 401 "API key format is incorrect").

**Why this matters / drift risk:** This availability gate is **UI-only**. The
create-mode dispatch (`dispatchOne`) and the brainstorm suggestion remap use a
*separate* runtime "provider health" system, NOT this endpoint. So hiding a
provider in the picker does NOT stop it being hit via direct API calls, stale
clients, or AI suggestion cards.

**How to apply:** If you need a provider to be truly unavailable end-to-end
(not just hidden), also add a server-side preflight in `POST /api/boards/:id/chat`
create mode and align the suggestion allow-list / health snapshot — otherwise
the picker and the dispatch can drift.

**User preference (observed):** the owner explicitly prefers the simple
key/availability auto-hide approach over hard-deleting tiles from the list, and
is sensitive to over-engineering — don't expand scope to backend guards unless asked.
