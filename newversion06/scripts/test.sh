#!/usr/bin/env bash
# Standard test command for the project.
# Runs backend tests via node:test (with tsx loader) then frontend tests via vitest.
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s globstar nullglob

# Backend tests (node:test + tsx loader, files under tests/).
#
# WebSocket-using files are run serially in a separate node:test invocation
# AFTER the rest of the suite. When they're mixed in with the other files,
# node:test's worker IPC channel intermittently fails to parse a final
# message and reports the file as
#   Error: Unable to deserialize cloned data due to invalid or unsupported version.
# from `node:internal/test_runner/runner` — even though every individual
# `it(...)` inside the file passes. Splitting them out and running them
# with --test-concurrency=1 avoids the flake without slowing the broader
# suite (which still runs at the default concurrency).
files=(tests/**/*.test.ts)
if [ ${#files[@]} -eq 0 ]; then
  echo "No backend tests found under tests/"
else
  ws_files=()
  other_files=()
  for f in "${files[@]}"; do
    case "$f" in
      *websocket*|*board-presence*) ws_files+=("$f") ;;
      *) other_files+=("$f") ;;
    esac
  done
  if [ ${#other_files[@]} -gt 0 ]; then
    node --import tsx --test "${other_files[@]}"
  fi
  if [ ${#ws_files[@]} -gt 0 ]; then
    node --import tsx --test --test-concurrency=1 "${ws_files[@]}"
  fi
fi

# Frontend component tests (vitest, files under client/)
client_tests=(client/**/*.test.ts client/**/*.test.tsx)
if [ ${#client_tests[@]} -gt 0 ]; then
  npx vitest run
else
  echo "No frontend tests found under client/"
fi
