#!/bin/bash
# Upgrade to 3-instance scale stack (needs >= 8 GB RAM).
set -euo pipefail
cd /opt/webcomet

FREE_MB=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
if [ "$FREE_MB" -lt 6000 ]; then
  echo "WARNING: available RAM ~${FREE_MB} MB. Scale needs ~8 GB total."
  echo "Upgrade the Reg.ru plan first (8–12 GB / 4 vCPU), then re-run."
  exit 1
fi

git fetch origin main
git reset --hard origin/main

# Ensure AI concurrency for scale
grep -q '^AI_MAX_CONCURRENT=' .env 2>/dev/null \
  && sed -i 's/^AI_MAX_CONCURRENT=.*/AI_MAX_CONCURRENT=6/' .env \
  || echo 'AI_MAX_CONCURRENT=6' >> .env

docker compose down || true
docker compose -f docker-compose.scale.yml up -d --build
docker compose -f docker-compose.scale.yml ps
curl -sS -o /dev/null -w "http_local=%{http_code}\n" http://127.0.0.1/ || true
echo "Scale stack is up. Check https://webcomet.ru"
