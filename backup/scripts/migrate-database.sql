-- Migration script to update database schema for RealtyFlow
-- Run this against your Neon PostgreSQL database

-- ============================================
-- 1. Analytics Table Updates
-- ============================================
ALTER TABLE analytics
  ADD COLUMN IF NOT EXISTS metric_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS metric_value VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dimension VARCHAR(255),
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP;

-- Copy data from old columns to new columns if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics' AND column_name='metric') THEN
    UPDATE analytics SET metric_type = metric WHERE metric_type IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics' AND column_name='value') THEN
    UPDATE analytics SET metric_value = value WHERE metric_value IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics' AND column_name='date') THEN
    UPDATE analytics SET timestamp = date WHERE timestamp IS NULL;
  END IF;
END $$;

-- Drop old columns if they exist
ALTER TABLE analytics DROP COLUMN IF EXISTS metric;
ALTER TABLE analytics DROP COLUMN IF EXISTS value;
ALTER TABLE analytics DROP COLUMN IF EXISTS date;

-- ============================================
-- 2. Social Media Accounts Table Updates
-- ============================================
ALTER TABLE social_media_accounts
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP;

-- Rename lastSync to last_synced if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_media_accounts' AND column_name='lastSync') THEN
    ALTER TABLE social_media_accounts RENAME COLUMN "lastSync" TO last_synced;
  END IF;
END $$;

-- ============================================
-- 3. Avatars Table Updates
-- ============================================
ALTER TABLE avatars
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS avatar_image_url,
  DROP COLUMN IF EXISTS voice_id,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS style,
  DROP COLUMN IF EXISTS is_active;

-- ============================================
-- 4. Content Pieces Table Updates
-- ============================================
ALTER TABLE content_pieces
  ALTER COLUMN social_platforms DROP DEFAULT,
  ALTER COLUMN social_platforms TYPE VARCHAR(255)[] USING
    CASE
      WHEN social_platforms IS NULL THEN NULL
      ELSE social_platforms
    END;

-- ============================================
-- 5. Media Assets Table Updates
-- ============================================
ALTER TABLE media_assets
  ALTER COLUMN avatar_id DROP DEFAULT;

-- ============================================
-- 6. Photo Avatars Table Updates (if it exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='photo_avatars') THEN
    -- Add missing columns if they don't exist
    ALTER TABLE photo_avatars
      ADD COLUMN IF NOT EXISTS heygen_avatar_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_photo_avatars_heygen_id ON photo_avatars(heygen_avatar_id);
    CREATE INDEX IF NOT EXISTS idx_photo_avatars_user_id ON photo_avatars(user_id);
  END IF;
END $$;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify the migration worked:

-- Check analytics table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'analytics' ORDER BY ordinal_position;

-- Check social_media_accounts table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'social_media_accounts' ORDER BY ordinal_position;

-- Check avatars table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'avatars' ORDER BY ordinal_position;

COMMIT;
