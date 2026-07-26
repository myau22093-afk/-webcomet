# Публикация на *.webcomet.ru

## 1. Supabase
В SQL Editor выполни файл:
`supabase/migrate-published-sites.sql`

## 2. DNS (Cloudflare)
Добавь A-запись:
- Name: `*`
- Content: IP VPS (`92.242.61.24`)
- Proxy: лучше **DNS only (серое облако)** сначала, как у корня
  либо оранжевое — тогда TLS на стороне Cloudflare

Без `*` поддомены не откроются. Запасной URL всегда работает:
`https://webcomet.ru/s/{slug}`

## 3. .env на VPS
```
NEXT_PUBLIC_PUBLISH_BASE_DOMAIN=webcomet.ru
NEXT_PUBLIC_APP_URL=https://webcomet.ru
```

## 4. Деплой
```bash
cd /opt/webcomet && git fetch origin main && git reset --hard origin/main && docker compose up -d --build
```

Caddy уже слушает `*.webcomet.ru`. Если сертификат wildcard не выдаётся
(нужен DNS-challenge), сайты всё равно доступны по `/s/slug`.
