-- Persist admin alert snoozes across server restarts (task #200).
-- Adds a nullable timestamp column to the users table that holds the
-- per-admin "snooze admin alert notifications until" expiry. Null and
-- past values mean no active snooze. Only meaningful for admin users.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_alert_snoozed_until" timestamp;
