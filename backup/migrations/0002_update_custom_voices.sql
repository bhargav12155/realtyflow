-- Migration: Update custom_voices table with missing columns
-- Adds support for audio file uploads and processing status

ALTER TABLE "custom_voices"
  ADD COLUMN IF NOT EXISTS "audio_url" text,
  ADD COLUMN IF NOT EXISTS "file_size" integer,
  ADD COLUMN IF NOT EXISTS "heygen_audio_asset_id" text,
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending';

-- Remove unique constraint on heygen_voice_id since it can be null during processing
ALTER TABLE "custom_voices" DROP CONSTRAINT IF EXISTS "custom_voices_heygen_voice_id_unique";
