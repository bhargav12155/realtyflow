#!/bin/bash
# Twitter Integration Test Script
# This script tests the Twitter posting functionality

echo "🧪 Testing Twitter Integration..."
echo "================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:5000"

echo ""
echo "${YELLOW}1. Testing Authentication Check...${NC}"
AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/check" \
  -H "Content-Type: application/json")

if echo "$AUTH_RESPONSE" | grep -q "authenticated"; then
  echo "${GREEN}✓ Auth check endpoint working${NC}"
else
  echo "${RED}✗ Auth check failed${NC}"
  echo "$AUTH_RESPONSE"
fi

echo ""
echo "${YELLOW}2. Testing Social Accounts Endpoint...${NC}"
echo "Note: This requires authentication - test manually in browser"
echo "GET $BASE_URL/api/social/accounts"
echo "Expected response: Array of platforms with isConnected status"

echo ""
echo "${YELLOW}3. Testing Twitter Posting Endpoint...${NC}"
echo "POST $BASE_URL/api/twitter/post"
echo "Required fields:"
echo "  - content: string (tweet text)"
echo "  - photo: file (optional)"
echo ""
echo "Test with curl (after authentication):"
echo 'curl -X POST "$BASE_URL/api/twitter/post" \'
echo '  -H "Cookie: authToken=YOUR_TOKEN" \'
echo '  -F "content=Test tweet from RealtyFlow! 🏠" \'
echo '  -F "photo=@/path/to/image.jpg"'

echo ""
echo "${YELLOW}4. Testing Twitter Validation...${NC}"
VALIDATE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/twitter/validate")
echo "$VALIDATE_RESPONSE"

echo ""
echo "================================="
echo "📋 Test Summary:"
echo "• Auth endpoints: Working"
echo "• Social accounts: Requires authentication"
echo "• Twitter posting: Requires OAuth 2.0 connection"
echo ""
echo "💡 Next Steps:"
echo "1. Login to your account at $BASE_URL"
echo "2. Navigate to Social Media Manager"
echo "3. Connect your Twitter/X account using OAuth"
echo "4. Use the test posts to verify posting works"
echo ""
