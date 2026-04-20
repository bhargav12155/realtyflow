#!/bin/bash
set -e
npm install

# Sync the live database schema with shared/schema.ts.
#
# drizzle-kit push always re-prompts on the public_users
# (agent_slug, email) composite UNIQUE because of a known drizzle-kit quirk
# with anonymous composite uniques. The supervisor below answers the default
# ("No, add the constraint without truncating") and lets drizzle continue.
# Real schema errors still surface as a non-zero exit and fail post-merge.
node scripts/db-push-supervisor.mjs
