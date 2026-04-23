-- Per-board owner toggle for collaborator join/leave transactional emails.
-- When false, the server skips board_shared / board_unshared / board_left
-- emails for this board; in-app notifications still fire so the bell
-- remains useful. Existing boards keep the historical opt-in behavior.
ALTER TABLE "boards"
  ADD COLUMN IF NOT EXISTS "notify_on_collaborator_change" boolean NOT NULL DEFAULT true;
