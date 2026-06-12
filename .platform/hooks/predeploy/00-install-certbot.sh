#!/usr/bin/env bash
set -euo pipefail

if command -v certbot >/dev/null 2>&1; then
  echo "[certbot-install] certbot already available"
  exit 0
fi

echo "[certbot-install] certbot not found; attempting package install"

if command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y certbot python3-certbot-nginx || true
elif command -v yum >/dev/null 2>&1; then
  sudo yum install -y certbot python3-certbot-nginx || true
else
  echo "[certbot-install] No supported package manager found; skipping certbot install"
fi

if command -v certbot >/dev/null 2>&1; then
  echo "[certbot-install] certbot installed successfully"
else
  echo "[certbot-install] certbot still unavailable; postdeploy hook will skip TLS automation"
fi