#!/usr/bin/env bash
# Image-related backend tests.
#
# Each test file is run in its OWN separate `node --test` invocation so that
# the parent runner's per-file IPC channel is never reused across files.
# In addition, each invocation is wrapped in a retry loop that ONLY retries
# the known Node 20 node:test worker-IPC flake:
#   Error: Unable to deserialize cloned data due to invalid or unsupported
#   version.
#     at #proccessRawBuffer (node:internal/test_runner/runner:...)
# This error is emitted by the parent runner when it fails to parse a final
# IPC message from the per-file worker subprocess; every individual `it(...)`
# inside the file still passes. Splitting into one-file-per-invocation and
# `--test-concurrency=1` reduces the flake but does NOT eliminate it (the
# error can also fire on a single-file invocation when the worker exits).
# A real test failure (any other error / "fail N" with N > 0 from a real
# assertion) is NOT retried and fails the script immediately.
#
# Background mirrors the split-invocation pattern used by `scripts/test.sh`
# for the WebSocket files.
set -uo pipefail
cd "$(dirname "$0")/.."

files=(
  server/services/__tests__/heygenUploadContentType.integration.test.ts
  server/services/__tests__/imageProcessor.test.ts
  server/services/__tests__/luma.test.ts
)

MAX_ATTEMPTS=4
IPC_FLAKE_PATTERN='Unable to deserialize cloned data due to invalid or unsupported version'

run_file() {
  local file="$1"
  local attempt=1
  local out exit_code
  while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    echo "=== Running ${file} (attempt ${attempt}/${MAX_ATTEMPTS}) ==="
    out="$(node --import tsx --test --test-concurrency=1 --test-force-exit "$file" 2>&1)"
    exit_code=$?
    printf '%s\n' "$out"
    if [ "$exit_code" -eq 0 ]; then
      return 0
    fi
    # Only retry the specific node:test worker-IPC flake. Any other failure
    # (real assertion failure, missing file, etc.) bubbles up immediately.
    if printf '%s' "$out" | grep -qF "$IPC_FLAKE_PATTERN"; then
      echo ">>> Detected node:test worker-IPC flake on ${file}; retrying..."
      attempt=$((attempt + 1))
      continue
    fi
    echo ">>> ${file} failed with a non-flake error; not retrying."
    return "$exit_code"
  done
  echo ">>> ${file} still hit the node:test IPC flake after ${MAX_ATTEMPTS} attempts."
  return 1
}

status=0
for f in "${files[@]}"; do
  if ! run_file "$f"; then
    status=1
  fi
done

exit "$status"
