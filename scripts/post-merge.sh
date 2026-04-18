#!/bin/bash
set -e
npm install

# Schema sync notes:
# The engagement_leads table in the live DB has long-standing column drift
# (legacy columns like email/phone/source vs. the current schema's
# agent_id/engagement_reason/etc.). drizzle-kit push tries to interactively
# disambiguate add-vs-rename for those columns and blocks post-merge setup.
#
# Until that drift is resolved with a deliberate migration, run db:push but
# do not fail the post-merge step on it - schema changes that actually need
# to land are applied via direct SQL in the relevant feature branches.
timeout 10 npm run db:push -- --force < /dev/null \
  || echo "[post-merge] db:push skipped (interactive drift on engagement_leads - needs a manual migration)"
