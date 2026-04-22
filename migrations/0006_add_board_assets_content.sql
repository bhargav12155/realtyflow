-- Add content column to board_assets for non-media tool kinds
-- (sticky notes, text, frame labels, drawings).
ALTER TABLE "board_assets" ADD COLUMN IF NOT EXISTS "content" text;
