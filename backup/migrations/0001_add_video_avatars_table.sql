-- Migration: Add video_avatars table for Enterprise HeyGen Video Avatar API
-- This table stores video avatars created from training footage

CREATE TABLE "video_avatars" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"avatar_name" text NOT NULL,
	"heygen_avatar_id" text NOT NULL,
	"training_video_url" text NOT NULL,
	"consent_video_url" text NOT NULL,
	"voice_id" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "video_avatars_heygen_avatar_id_unique" UNIQUE("heygen_avatar_id")
);
--> statement-breakpoint

-- Add index on user_id for faster queries
CREATE INDEX "video_avatars_user_id_idx" ON "video_avatars" ("user_id");
--> statement-breakpoint

-- Add index on status for filtering
CREATE INDEX "video_avatars_status_idx" ON "video_avatars" ("status");
