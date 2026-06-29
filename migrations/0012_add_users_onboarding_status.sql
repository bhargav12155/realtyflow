-- Add onboarding completion tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean NOT NULL DEFAULT false;

-- Create index for querying new users
CREATE INDEX IF NOT EXISTS IDX_users_onboarding_status ON users(has_completed_onboarding);
