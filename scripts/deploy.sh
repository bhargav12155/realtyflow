#!/usr/bin/env bash
# deploy.sh — Build and deploy RealtyFlow to EC2 via S3 + SSM
# Usage: ./scripts/deploy.sh [--skip-build] [--skip-upload]
#
# Requirements:
#   - AWS CLI configured (or env vars AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY set)
#   - aws ssm send-command permissions on the target instance
#   - zip, rsync available locally

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
INSTANCE_ID="i-0187309b88564b78f"
AWS_REGION="us-east-2"
S3_BUCKET="elasticbeanstalk-us-east-2-117984642146"
S3_PREFIX="realtyflow"
APP_DIR="/app"
SERVICE_NAME="realtyflow"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Flags ───────────────────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_UPLOAD=false
for arg in "$@"; do
  case $arg in
    --skip-build)  SKIP_BUILD=true ;;
    --skip-upload) SKIP_UPLOAD=true ;;
  esac
done

# ─── Helpers ─────────────────────────────────────────────────────────────────
log()  { echo "[deploy] $*"; }
err()  { echo "[deploy] ERROR: $*" >&2; exit 1; }

ssm_run() {
  local description="$1"
  shift
  local commands_json="$1"

  log "SSM: $description"
  local cmd_id
  cmd_id=$(aws ssm send-command \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --document-name AWS-RunShellScript \
    --parameters "commands=$commands_json" \
    --query 'Command.CommandId' \
    --output text)

  log "  command ID: $cmd_id — waiting..."
  local elapsed=0
  while true; do
    sleep 5
    elapsed=$((elapsed + 5))
    local status
    status=$(aws ssm get-command-invocation \
      --region "$AWS_REGION" \
      --command-id "$cmd_id" \
      --instance-id "$INSTANCE_ID" \
      --query 'Status' --output text 2>/dev/null || echo "Pending")

    if [[ "$status" == "Success" ]]; then
      aws ssm get-command-invocation \
        --region "$AWS_REGION" \
        --command-id "$cmd_id" \
        --instance-id "$INSTANCE_ID" \
        --query 'StandardOutputContent' --output text
      return 0
    elif [[ "$status" == "Failed" || "$status" == "TimedOut" || "$status" == "Cancelled" ]]; then
      aws ssm get-command-invocation \
        --region "$AWS_REGION" \
        --command-id "$cmd_id" \
        --instance-id "$INSTANCE_ID" \
        --query '{Out:StandardOutputContent,Err:StandardErrorContent}' --output json
      err "SSM command failed with status: $status"
    fi

    if [[ $elapsed -ge 300 ]]; then
      err "SSM command timed out after 5 minutes (command ID: $cmd_id)"
    fi
  done
}

# ─── Step 1: Build ───────────────────────────────────────────────────────────
cd "$ROOT_DIR"

if [[ "$SKIP_BUILD" == false ]]; then
  log "Building (vite + esbuild)..."
  NODE_ENV=production npm run build
  log "Build complete."
else
  log "Skipping build (--skip-build)."
fi

# ─── Step 2: Package ─────────────────────────────────────────────────────────
VERSION="v$(date +%Y%m%d%H%M%S)"
ZIPFILE="realtyflow-${VERSION}.zip"

if [[ "$SKIP_UPLOAD" == false ]]; then
  log "Creating archive $ZIPFILE (dist only)..."
  zip -r "$ZIPFILE" \
    dist/ \
    package.json \
    Procfile \
    .platform/ \
    uploads/.gitkeep \
    2>&1 | tail -3

  ZIPSIZE=$(du -sh "$ZIPFILE" | cut -f1)
  log "Archive size: $ZIPSIZE"

  # ─── Step 3: Upload to S3 ────────────────────────────────────────────────
  S3_KEY="${S3_PREFIX}/${ZIPFILE}"
  log "Uploading to s3://${S3_BUCKET}/${S3_KEY}..."
  aws s3 cp "$ZIPFILE" "s3://${S3_BUCKET}/${S3_KEY}" --region "$AWS_REGION"
  log "Upload complete."

  # Clean up local zip
  rm -f "$ZIPFILE"
  log "Local archive removed."
else
  # If skipping upload, we need the latest zip already on S3
  log "Skipping upload (--skip-upload). Will use most recent S3 bundle."
  ZIPFILE=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --region "$AWS_REGION" \
    | awk '{print $4}' | grep '^realtyflow-v' | sort | tail -1)
  [[ -z "$ZIPFILE" ]] && err "No existing bundle found in S3 — cannot skip upload."
  S3_KEY="${S3_PREFIX}/${ZIPFILE}"
  log "Using existing bundle: $S3_KEY"
fi

# ─── Step 4: Deploy on EC2 via SSM ───────────────────────────────────────────
log "Deploying to instance $INSTANCE_ID..."

ssm_run "Download, extract, and restart" \
  "[\"set -e\",
    \"aws s3 cp s3://${S3_BUCKET}/${S3_KEY} /tmp/app-new.zip --region ${AWS_REGION}\",
    \"rm -rf /app-new && unzip -o /tmp/app-new.zip -d /app-new\",
    \"rsync -a --delete /app-new/dist/ ${APP_DIR}/dist/\",
    \"rm -rf /tmp/app-new.zip /app-new\",
    \"systemctl restart ${SERVICE_NAME}\",
    \"sleep 3\",
    \"systemctl status ${SERVICE_NAME} --no-pager | head -8\"]"

log "Deployment complete — $VERSION is live."
