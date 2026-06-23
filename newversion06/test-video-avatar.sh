#!/bin/bash

# Test Video Avatar Creation API
# This script tests the video avatar creation endpoint

echo "🧪 Testing Video Avatar Creation API"
echo "======================================"

# Configuration
API_URL="http://localhost:5000/api/video-avatars"
TRAINING_VIDEO_URL="https://home-template-images.s3.us-east-2.amazonaws.com/user-1/photo-avatars/video-avatar-footage/training/7DdxmiCH8Ze_cUqNHNE4z_Movie%20on%2011-18-25%20at%2010.48%E2%80%AFPM_compressed.mp4"
CONSENT_VIDEO_URL="https://home-template-images.s3.us-east-2.amazonaws.com/user-1/photo-avatars/video-avatar-footage/consent/tiDM5HkRymL07_EcZ9Tty_Movie%20on%2011-18-25%20at%2010.48%E2%80%AFPM_compressed.mp4"
AVATAR_NAME="Test Avatar $(date +%s)"

# Get auth token (you'll need to update this with actual session cookie)
# For testing, we'll assume you're logged in and have a valid session
COOKIE_FILE=".test-cookies.txt"

echo ""
echo "📝 Test Details:"
echo "   Avatar Name: $AVATAR_NAME"
echo "   Training Video: $TRAINING_VIDEO_URL"
echo "   Consent Video: $CONSENT_VIDEO_URL"
echo ""

# Test 1: Create Video Avatar
echo "🎬 Test 1: Creating Video Avatar..."
echo "-----------------------------------"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d "{
    \"name\": \"$AVATAR_NAME\",
    \"trainingVideoUrl\": \"$TRAINING_VIDEO_URL\",
    \"consentVideoUrl\": \"$CONSENT_VIDEO_URL\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Video Avatar Creation: SUCCESS"
  AVATAR_ID=$(echo "$BODY" | jq -r '.avatarId' 2>/dev/null)
  echo "   Avatar ID: $AVATAR_ID"

  # Test 2: Check Status
  if [ ! -z "$AVATAR_ID" ] && [ "$AVATAR_ID" != "null" ]; then
    echo ""
    echo "📊 Test 2: Checking Avatar Status..."
    echo "-----------------------------------"

    STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/$AVATAR_ID" \
      -b "$COOKIE_FILE")

    STATUS_HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n 1)
    STATUS_BODY=$(echo "$STATUS_RESPONSE" | head -n -1)

    echo "HTTP Status: $STATUS_HTTP_CODE"
    echo "Response:"
    echo "$STATUS_BODY" | jq '.' 2>/dev/null || echo "$STATUS_BODY"
    echo ""

    if [ "$STATUS_HTTP_CODE" = "200" ]; then
      echo "✅ Status Check: SUCCESS"
    else
      echo "❌ Status Check: FAILED"
    fi
  fi

  # Test 3: List All Video Avatars
  echo ""
  echo "📋 Test 3: Listing All Video Avatars..."
  echo "-----------------------------------"

  LIST_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL" \
    -b "$COOKIE_FILE")

  LIST_HTTP_CODE=$(echo "$LIST_RESPONSE" | tail -n 1)
  LIST_BODY=$(echo "$LIST_RESPONSE" | head -n -1)

  echo "HTTP Status: $LIST_HTTP_CODE"
  echo "Response:"
  echo "$LIST_BODY" | jq '.' 2>/dev/null || echo "$LIST_BODY"
  echo ""

  if [ "$LIST_HTTP_CODE" = "200" ]; then
    echo "✅ List Avatars: SUCCESS"
    AVATAR_COUNT=$(echo "$LIST_BODY" | jq -r '.avatars | length' 2>/dev/null)
    echo "   Total Avatars: $AVATAR_COUNT"
  else
    echo "❌ List Avatars: FAILED"
  fi

else
  echo "❌ Video Avatar Creation: FAILED"
  echo "   Please check the error message above"
fi

echo ""
echo "======================================"
echo "🏁 Test Complete"
echo ""
echo "💡 Notes:"
echo "   • Video Avatar API is an Enterprise-only HeyGen feature"
echo "   • Requires Enterprise API plan access"
echo "   • Contact HeyGen support to enable this feature"
echo ""
echo "   If you see 401/403 errors, you may need to:"
echo "   1. Verify your HeyGen account has Enterprise API access"
echo "   2. Check your authentication cookies are valid"
echo "   3. Ensure URLs are publicly accessible"
