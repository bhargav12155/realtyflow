-- Migration: Update photo_avatar_groups table with missing columns
-- Adds support for image hashing and S3 storage URLs

ALTER TABLE "photo_avatar_groups"
  ADD COLUMN IF NOT EXISTS "image_hash" text,
  ADD COLUMN IF NOT EXISTS "heygen_image_key" text,
  ADD COLUMN IF NOT EXISTS "s3_image_url" text;
