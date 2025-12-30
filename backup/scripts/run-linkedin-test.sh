#!/bin/bash

# LinkedIn OAuth & Posting Test Runner
# Simple wrapper script to run the LinkedIn integration test

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║         LinkedIn OAuth & Posting Test - Quick Launcher               ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if LIVE_MODE is set
if [ "$LIVE_MODE" = "true" ]; then
    echo "🚀 Running in LIVE mode (real LinkedIn API calls)"
    echo ""
    npx tsx scripts/test-linkedin-flow.ts
else
    echo "🧪 Running in MOCK mode (no real LinkedIn API calls)"
    echo ""
    echo "💡 To run in LIVE mode, use:"
    echo "   LIVE_MODE=true ./scripts/run-linkedin-test.sh"
    echo ""
    npx tsx scripts/test-linkedin-flow.ts
fi
