#!/bin/bash
# API Endpoints Test Script
# Tests all major RealtyFlow API endpoints

echo "🌐 Testing RealtyFlow API Endpoints..."
echo "======================================"

BASE_URL="http://localhost:5000"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  
  echo ""
  echo "Testing: $description"
  echo "  $method $endpoint"
  
  response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint")
  
  if [ "$response" -eq 200 ] || [ "$response" -eq 201 ]; then
    echo -e "  ${GREEN}✓ Status: $response${NC}"
  elif [ "$response" -eq 401 ]; then
    echo -e "  ${RED}⚠ Status: $response (Requires auth)${NC}"
  else
    echo -e "  ${RED}✗ Status: $response${NC}"
  fi
}

# Health Check
test_endpoint "GET" "/health" "Health Check"

# Authentication
test_endpoint "GET" "/api/auth/check" "Auth Status Check"

# Social Media
test_endpoint "GET" "/api/social/accounts" "Social Media Accounts"
test_endpoint "GET" "/api/twitter/validate" "Twitter Validation"

# Dashboard
test_endpoint "GET" "/api/dashboard/overview" "Dashboard Overview"

# Properties
test_endpoint "GET" "/api/properties" "Properties List"

# Market Data
test_endpoint "GET" "/api/market/data" "Market Data"

# SEO
test_endpoint "GET" "/api/seo/keywords" "SEO Keywords"
test_endpoint "GET" "/api/seo/site-health" "Site Health"

# Videos & Avatars
test_endpoint "GET" "/api/videos" "Videos List"
test_endpoint "GET" "/api/avatars" "Avatars List"

# Scheduled Posts
test_endpoint "GET" "/api/scheduled-posts" "Scheduled Posts"

echo ""
echo "======================================"
echo "✅ API endpoint testing complete!"
echo ""
echo "📝 Note: Endpoints showing 401 require authentication"
echo "   Login at $BASE_URL to test authenticated endpoints"
echo ""
