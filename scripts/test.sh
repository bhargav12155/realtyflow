#!/usr/bin/env bash
# Standard test command for the project.
# Runs backend tests via tsx + node:test, then frontend component tests via vitest.
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s globstar nullglob

# Backend tests (tsx + node:test, files under tests/)
files=(tests/**/*.test.ts)
if [ ${#files[@]} -eq 0 ]; then
  echo "No backend tests found under tests/"
else
  npx tsx --test "${files[@]}"
fi

# Frontend component tests (vitest, files under client/)
client_tests=(client/**/*.test.ts client/**/*.test.tsx)
if [ ${#client_tests[@]} -gt 0 ]; then
  npx vitest run
else
  echo "No frontend tests found under client/"
fi
