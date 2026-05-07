-- Migration: Add eval_history column to board_assets
-- Adds an auditable JSON history of auto-eval and manual override decisions
-- per generated board variation. See Task #62.

ALTER TABLE "board_assets"
  ADD COLUMN IF NOT EXISTS "eval_history" jsonb DEFAULT '[]'::jsonb;
