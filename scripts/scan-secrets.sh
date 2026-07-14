#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-staged}"

# Skip binary-like files and noisy lock/assets paths.
EXCLUDE_PATTERN='(^|/)(node_modules|dist|uploads|attached_assets|github/attached_assets|\.git)/|\.(png|jpg|jpeg|gif|webp|pdf|zip|tar|gz|mp4|mov|avi|woff2?)$|package-lock\.json$'

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

collect_staged() {
  git diff --cached --unified=0 --no-color --diff-filter=ACMRT
}

collect_push_range() {
  local range=""
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    range="origin/main...HEAD"
  else
    local root_commit
    root_commit="$(git rev-list --max-parents=0 HEAD | head -n 1)"
    range="${root_commit}...HEAD"
  fi

  git diff --unified=0 --no-color --diff-filter=ACMRT "$range"
}

if [[ "$MODE" == "push" ]]; then
  collect_push_range > "$TMP_FILE"
else
  collect_staged > "$TMP_FILE"
fi

# Restrict to added lines and ignore obvious non-source paths.
ADDED_LINES="$(grep -E '^\+' "$TMP_FILE" | grep -Ev '^\+\+\+' | grep -Eiv "$EXCLUDE_PATTERN" || true)"

if [[ -z "$ADDED_LINES" ]]; then
  exit 0
fi

PATTERN='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws(.{0,20})?(secret|access)[^\n]{0,50}[=:][^\n]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk_[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z._-]+|-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----|postgres(ql)?:\/\/[^\s]+:[^\s]+@|bearer[[:space:]]+[A-Za-z0-9._-]{20,}|token["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9._-]{20,})'

MATCHES="$(printf '%s\n' "$ADDED_LINES" | grep -Ein "$PATTERN" || true)"

if [[ -n "$MATCHES" ]]; then
  echo ""
  echo "Secret scan failed: potential credentials detected in added lines."
  echo "Remove secrets from code and use environment variables or secret manager instead."
  echo ""
  echo "Matched lines:"
  echo "$MATCHES" | sed 's/^/  /'
  echo ""
  echo "If this is a false positive, rotate-safe placeholder values are recommended."
  exit 1
fi

exit 0