#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${EB_SSL_DOMAIN:-}"
EMAIL="${EB_SSL_EMAIL:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "[letsencrypt] Skipping certificate setup; set EB_SSL_DOMAIN and EB_SSL_EMAIL to enable."
  exit 0
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "[letsencrypt] certbot not installed on this instance; skipping automatic certificate setup."
  echo "[letsencrypt] Install certbot on the EB platform image or run it manually once before enabling HTTPS."
  exit 0
fi

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
  echo "[letsencrypt] Existing certificate found for ${DOMAIN}; attempting renew."
  sudo certbot renew --quiet --deploy-hook "sudo systemctl reload nginx" || true
  exit 0
fi

echo "[letsencrypt] Requesting certificate for ${DOMAIN} and www.${DOMAIN}"
sudo certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  --redirect || true

sudo systemctl reload nginx || true
