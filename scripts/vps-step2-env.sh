#!/bin/bash
set -euo pipefail
cd /opt/webcomet

echo "=== before ==="
grep -E '^(YOOKASSA_STUB|YOOKASSA_SHOP_ID|YOOKASSA_SECRET_KEY|CRON_SECRET)=' .env | sed 's/=.*/=***/' || true

if grep -q '^YOOKASSA_STUB=' .env; then
  echo "Removing YOOKASSA_STUB from .env (prod must use real YooKassa)"
  sed -i '/^YOOKASSA_STUB=/d' .env
fi

SECRET=$(openssl rand -hex 24)
if grep -q '^CRON_SECRET=' .env; then
  sed -i "s|^CRON_SECRET=.*|CRON_SECRET=${SECRET}|" .env
else
  printf '\n# Hourly expire publishes\nCRON_SECRET=%s\n' "$SECRET" >> .env
fi

echo "=== after ==="
grep -E '^(YOOKASSA_STUB|YOOKASSA_SHOP_ID|YOOKASSA_SECRET_KEY|CRON_SECRET)=' .env | sed 's/=.*/=***/' || true

docker compose -f docker-compose.scale.yml up -d
sleep 3
docker compose -f docker-compose.scale.yml exec -T webcomet1 sh -c 'if [ -n "$CRON_SECRET" ]; then echo container_CRON=ok; else echo container_CRON=missing; fi; if [ -z "$YOOKASSA_STUB" ]; then echo container_STUB=ok_unset; else echo "container_STUB=$YOOKASSA_STUB"; fi'

echo "DONE"
