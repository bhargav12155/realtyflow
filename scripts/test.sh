#!/usr/bin/env bash
# Standard test command for the project.
# Runs the automated test suite via tsx + node:test.
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s globstar nullglob
files=(tests/**/*.test.ts)
if [ ${#files[@]} -eq 0 ]; then
  echo "No tests found under tests/"
  exit 0
fi
exec npx tsx --test "${files[@]}"
