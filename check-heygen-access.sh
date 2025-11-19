#!/bin/bash

# Check HeyGen API Access and Features
# This script tests what HeyGen API features are available with your API key

echo "🔍 Checking HeyGen API Access"
echo "======================================"

# Load API key from .env
if [ -f .env ]; then
  export $(grep "^HEYGEN_API_KEY=" .env | xargs)
fi

if [ -z "$HEYGEN_API_KEY" ]; then
  echo "❌ HEYGEN_API_KEY not found in .env file"
  exit 1
fi

echo "✅ API Key found: ${HEYGEN_API_KEY:0:10}..."
echo ""

# Test 1: Check Photo Avatar API (Standard feature)
echo "📸 Test 1: Photo Avatar API (Standard feature)"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "https://api.heygen.com/v2/avatars" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Photo Avatar API: ACCESS GRANTED"
  AVATAR_COUNT=$(echo "$BODY" | jq -r '.data.avatars | length' 2>/dev/null || echo "?")
  echo "   Found $AVATAR_COUNT avatars"
else
  echo "❌ Photo Avatar API: ACCESS DENIED (Status: $HTTP_CODE)"
fi
echo ""

# Test 2: Check Video Avatar API (Enterprise feature)
echo "🎥 Test 2: Video Avatar API (Enterprise feature)"
echo "-----------------------------------"

# Try to call the video avatar endpoint
VIDEO_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://api.heygen.com/v2/video_avatar" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "avatar_name": "Test Avatar",
    "training_footage_url": "https://example.com/test.mp4",
    "video_consent_url": "https://example.com/consent.mp4"
  }')

VIDEO_HTTP_CODE=$(echo "$VIDEO_RESPONSE" | tail -n 1)
VIDEO_BODY=$(echo "$VIDEO_RESPONSE" | head -n -1)

if [ "$VIDEO_HTTP_CODE" = "200" ]; then
  echo "✅ Video Avatar API: ACCESS GRANTED (Enterprise enabled)"
elif [ "$VIDEO_HTTP_CODE" = "403" ]; then
  echo "❌ Video Avatar API: ACCESS DENIED (Status: 403 Forbidden)"
  echo "   This is an Enterprise-only feature"
  echo "   Error: $VIDEO_BODY"
else
  echo "⚠️  Video Avatar API: Unexpected status $VIDEO_HTTP_CODE"
  echo "   Response: $VIDEO_BODY"
fi
echo ""

# Test 3: Check Template API (Standard feature)
echo "📺 Test 3: Template API (Standard feature)"
echo "-----------------------------------"
TEMPLATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "https://api.heygen.com/v2/templates" \
  -H "X-Api-Key: $HEYGEN_API_KEY" \
  -H "Content-Type: application/json")

TEMPLATE_HTTP_CODE=$(echo "$TEMPLATE_RESPONSE" | tail -n 1)
TEMPLATE_BODY=$(echo "$TEMPLATE_RESPONSE" | head -n -1)

if [ "$TEMPLATE_HTTP_CODE" = "200" ]; then
  echo "✅ Template API: ACCESS GRANTED"
  TEMPLATE_COUNT=$(echo "$TEMPLATE_BODY" | jq -r '.data.templates | length' 2>/dev/null || echo "?")
  echo "   Found $TEMPLATE_COUNT templates"
else
  echo "❌ Template API: ACCESS DENIED (Status: $TEMPLATE_HTTP_CODE)"
fi
echo ""

# Summary
echo "======================================"
echo "📊 Access Summary"
echo "======================================"
echo ""
echo "Available Features:"
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✅ Photo Avatar API (Standard)"
else
  echo "  ❌ Photo Avatar API"
fi

if [ "$TEMPLATE_HTTP_CODE" = "200" ]; then
  echo "  ✅ Template API (Standard)"
else
  echo "  ❌ Template API"
fi

if [ "$VIDEO_HTTP_CODE" = "200" ]; then
  echo "  ✅ Video Avatar API (Enterprise)"
else
  echo "  ❌ Video Avatar API (Enterprise - Not Available)"
fi

echo ""
echo "📘 To enable Enterprise features:"
echo "   1. Contact HeyGen support: support@heygen.com"
echo "   2. Request Enterprise API plan upgrade"
echo "   3. Ask specifically about Video Avatar API access"
echo ""
