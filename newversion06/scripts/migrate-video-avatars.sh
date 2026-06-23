#!/bin/bash

# Video Avatars Migration Script
# This script adds the video_avatars table to the database

echo "🎥 Video Avatars Migration Script"
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
echo "🚀 Running video avatars migration..."
echo ""

psql "$DATABASE_URL" -f migrations/0001_add_video_avatars_table.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Video avatars table created successfully!"
    echo ""
    echo "📋 Migration Details:"
    echo "   - Added video_avatars table"
    echo "   - Added indexes for user_id and status"
    echo "   - Ready for Enterprise HeyGen Video Avatar API"
    echo ""
    echo "Next steps:"
    echo "1. Restart your development server if running"
    echo "2. Video Avatar API endpoints are now available:"
    echo "   - POST /api/video-avatars (create from training footage)"
    echo "   - GET /api/video-avatars/:id/status (check status)"
    echo "   - GET /api/video-avatars (list all)"
    echo "   - DELETE /api/video-avatars/:id (delete)"
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
