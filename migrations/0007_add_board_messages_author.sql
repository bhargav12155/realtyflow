-- Track which user authored each board chat turn so owners of a shared board
-- can tell collaborator contributions apart from their own. Existing rows are
-- left NULL on purpose: the persistence layer used to be owner-only, so
-- legacy rows are implicitly owner-authored and the API treats NULL that way.
ALTER TABLE "board_messages"
  ADD COLUMN IF NOT EXISTS "author_user_id" varchar
  REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "IDX_board_messages_author"
  ON "board_messages" ("author_user_id");
