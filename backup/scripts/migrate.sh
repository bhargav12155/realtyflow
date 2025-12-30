#!/bin/bash

# RealtyFlow Database Migration Script
# This script applies database schema changes to your Neon PostgreSQL database

echo "🔄 RealtyFlow Database Migration Script"
echo "========================================"
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep DATABASE_URL | xargs)
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env file"
    exit 1
fi

echo "✅ Found DATABASE_URL"
echo "📊 Connecting to database..."
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed"
    echo "   Install it with: brew install postgresql (macOS)"
    exit 1
fi

# Run the migration
echo "🚀 Running migration script..."
echo ""

psql "$DATABASE_URL" -f scripts/migrate-database.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Restart your development server: npm run dev"
    echo "2. Refresh your browser at http://localhost:5000"
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
