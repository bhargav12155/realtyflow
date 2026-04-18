#!/usr/bin/env bash
# Standard test command for the project.
# Runs backend tests via node:test (with tsx loader) then frontend tests via vitest.
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s globstar nullglob

# Backend tests (node:test + tsx loader, files under tests/)
files=(tests/**/*.test.ts)
if [ ${#files[@]} -eq 0 ]; then
  echo "No backend tests found under tests/"
else
  node --import tsx --test "${files[@]}"
fi

# Frontend component tests (vitest, files under client/)
client_tests=(client/**/*.test.ts client/**/*.test.tsx)
if [ ${#client_tests[@]} -gt 0 ]; then
  npx vitest run
else
  echo "No frontend tests found under client/"
fi
