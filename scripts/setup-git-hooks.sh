#!/usr/bin/env bash
set -euo pipefail

chmod +x .githooks/pre-commit .githooks/pre-push scripts/scan-secrets.sh
git config core.hooksPath .githooks

echo "Git hooks installed with core.hooksPath=.githooks"
