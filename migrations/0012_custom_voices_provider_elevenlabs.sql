-- Migration: Add provider, elevenlabs_voice_id, and is_default to custom_voices
-- Supports multi-provider voice cloning (HeyGen + ElevenLabs)

ALTER TABLE "custom_voices"
  ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'heygen',
  ADD COLUMN IF NOT EXISTS "elevenlabs_voice_id" text,
  ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false;
