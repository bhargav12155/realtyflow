-- Add gen_context column to board_assets so failed image/video tiles can
-- be retried using the original prompt/refs/genMode/forceModel snapshot
-- (Task #263).
ALTER TABLE "board_assets" ADD COLUMN IF NOT EXISTS "gen_context" jsonb;
