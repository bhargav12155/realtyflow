-- Migration: Add notifications table for in-app notifications
-- Used initially for "board shared with you" events but kept generic
-- (type + jsonb data) so future notification kinds can reuse it.

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "type" varchar NOT NULL,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_notifications_user" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_notifications_user_unread" ON "notifications" ("user_id", "is_read");
