#!/bin/bash
# Run on the VPS after SSH login:
#   bash scripts/deploy-vps.sh
set -euo pipefail
cd /opt/webcomet
git fetch origin main
git reset --hard origin/main
docker compose up -d --build
docker compose ps
curl -sS -o /dev/null -w "http_local=%{http_code}\n" http://127.0.0.1/ || true
echo "Done. Check https://webcomet.ru and Cloudflare cache rules (cloudflare-cache.md)."
