# Scale plan: 3k → 9k concurrent online users

**Concurrent online** = people browsing login/dashboard (CDN + app).  
**Not** 3k–9k parallel AI site generations — those go through a queue.

## Current VPS

Single `docker compose` service (host ~**12 vCPU / 11 GB**):

- Online browsing: thousands (UI/API without heavy AI)
- Parallel AI: `AI_MAX_CONCURRENT` (default **16**) per instance — rest wait in queue (`AI_QUEUE_WAIT_MS=0` = infinite wait)

## Target architecture

```
Users → Cloudflare CDN (/_next/static cached)
      → Load balancer (Caddy)
      → webcomet-1 … webcomet-N (Next standalone)
      → in-process AI queue per instance (AI_MAX_CONCURRENT)
      → Promptra / ProxyAPI
      → Supabase
```

### Hardware guide

| Goal | App instances | RAM each | AI slots / instance | Notes |
|------|---------------|----------|---------------------|-------|
| 3k online | 2–3 | 4 GB | 6–8 | + Cloudflare cache |
| 9k online | 4–6 | 4 GB | 6–8 | or 2× stronger hosts |
| AI peak | — | — | sum of slots ≈ 20–50 | rest wait in queue (no drop if AI_QUEUE_WAIT_MS=0) |

## How to run scaled stack on one stronger host

1. In Reg.ru Cloud: change tariff to **≥ 8 GB RAM / 4 vCPU** (лучше **12 GB**), wait until active.
2. SSH:

```bash
cd /opt/webcomet
bash scripts/scale-up-3k.sh
```

Or manually:

```bash
cd /opt/webcomet
git pull origin main
docker compose down
docker compose -f docker-compose.scale.yml up -d --build
```

See [`docker-compose.scale.yml`](docker-compose.scale.yml) + [`Caddyfile.scale`](Caddyfile.scale).

Origin stays on **HTTP :80** (HTTPS via Cloudflare).

Env (add to `.env`):

```bash
AI_MAX_CONCURRENT=16
AI_QUEUE_WAIT_MS=0
NEXT_PUBLIC_APP_URL=https://webcomet.ru
```

## Cloudflare (required for scale + white-screen fix)

Follow [`cloudflare-cache.md`](cloudflare-cache.md): cache `/_next/static` at the edge.

## Later (when one host is not enough)

1. Split app hosts behind Cloudflare Load Balancing or external LB
2. Replace in-process queue with **Redis + workers** (shared across instances)
3. Supabase Pro + connection pooler

## Pricing / margin

Token packs and model costs live in [`lib/tokenConfig.ts`](lib/tokenConfig.ts)  
(target ≈ **0.7–1.0 ₽/token**, expensive models cost more tokens).
