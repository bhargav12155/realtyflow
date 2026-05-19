ALTER TABLE "event_sources"
ADD COLUMN IF NOT EXISTS "business_type" text NOT NULL DEFAULT 'real_estate';

ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "business_type" text NOT NULL DEFAULT 'real_estate';