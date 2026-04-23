-- Per-board cap on persisted chat messages. Owners pick how much chat
-- history their board keeps; the auto-trim path in
-- `createBoardMessageForUser` reads this column to decide when to drop
-- the oldest rows. Existing boards keep the historical 200 default so
-- behavior doesn't change for anyone who hasn't tuned the value yet.
ALTER TABLE "boards"
  ADD COLUMN IF NOT EXISTS "chat_history_cap" integer NOT NULL DEFAULT 200;
