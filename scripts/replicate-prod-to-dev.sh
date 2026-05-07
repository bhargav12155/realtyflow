#!/bin/bash

# Script to replicate production database to development database
# This will dump prod schema and data, then restore to dev

set -e  # Exit on error

echo "🔄 Database Replication Script"
echo "================================"
echo ""

# Check if prod database URL is provided
if [ -z "$PROD_DATABASE_URL" ]; then
    echo "❌ Error: PROD_DATABASE_URL environment variable is required"
    echo "Usage: PROD_DATABASE_URL='postgresql://...' ./scripts/replicate-prod-to-dev.sh"
    exit 1
fi

# Load dev database URL from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env file"
    exit 1
fi

DEV_DATABASE_URL="$DATABASE_URL"

echo "📊 Source (Prod): ${PROD_DATABASE_URL:0:50}..."
echo "📊 Target (Dev):  ${DEV_DATABASE_URL:0:50}..."
echo ""

# Create temporary dump file
DUMP_FILE="/tmp/realtyflow_prod_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "1️⃣  Dumping production database..."
pg_dump "$PROD_DATABASE_URL" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    > "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Production database dumped to: $DUMP_FILE"
    echo "   Size: $(du -h "$DUMP_FILE" | cut -f1)"
else
    echo "❌ Failed to dump production database"
    exit 1
fi

echo ""
echo "2️⃣  Restoring to development database..."
echo "⚠️  This will DROP all existing tables in dev database!"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted by user"
    rm "$DUMP_FILE"
    exit 0
fi

psql "$DEV_DATABASE_URL" < "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Database successfully replicated to dev!"
else
    echo "❌ Failed to restore to development database"
    echo "Dump file saved at: $DUMP_FILE"
    exit 1
fi

# Clean up
echo ""
echo "3️⃣  Cleaning up..."
rm "$DUMP_FILE"
echo "✅ Temporary dump file removed"

echo ""
echo "🎉 Replication complete!"
echo "   Your dev database now matches production schema and data."
