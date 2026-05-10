-- Persist the per-user "auto-generate first suggestion" toggle for the
-- Boards Think→Build hand-off. Default false so existing users opt in
-- explicitly. Read/written by /api/user/preferences.
ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "boards_auto_generate_first" boolean NOT NULL DEFAULT false;
