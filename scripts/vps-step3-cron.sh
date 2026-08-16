#!/bin/bash
set -euo pipefail

CRON_LINE='0 * * * * cd /opt/webcomet && curl -fsS -H "Authorization: Bearer $(grep ^CRON_SECRET= .env | cut -d= -f2-)" https://webcomet.ru/api/cron/expire-publishes >/dev/null 2>&1'

# Keep existing crontab, replace our job if present
TMP=$(mktemp)
crontab -l 2>/dev/null | grep -v 'api/cron/expire-publishes' > "$TMP" || true
echo "$CRON_LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "=== crontab installed ==="
crontab -l | grep expire-publishes | sed 's/Bearer .*/Bearer ***/'

# Smoke test now
SECRET=$(grep ^CRON_SECRET= /opt/webcomet/.env | cut -d= -f2-)
CODE=$(curl -sS -o /tmp/wc_cron_out.json -w "%{http_code}" -H "Authorization: Bearer $SECRET" https://webcomet.ru/api/cron/expire-publishes || true)
echo "smoke_http=$CODE"
head -c 200 /tmp/wc_cron_out.json; echo
rm -f /tmp/wc_cron_out.json
echo DONE
