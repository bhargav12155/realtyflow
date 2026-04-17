#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx --test \
  server/services/__tests__/imageProcessor.test.ts \
  server/services/__tests__/heygenUploadContentType.integration.test.ts
