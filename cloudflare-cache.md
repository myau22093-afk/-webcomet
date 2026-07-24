# Cloudflare cache for WebComet

Чтобы статика не тормозила с одного VPS (белый экран при медленном `/_next/static`):

## Cache Rules (Cloudflare Dashboard)

1. **Rules → Cache Rules → Create rule**
2. Name: `Next static immutable`
3. If: URI Path starts with `/_next/static`
4. Then:
   - Cache eligibility: **Eligible for cache**
   - Edge TTL: **1 month** (or "Ignore cache-control header and use this TTL")
   - Browser TTL: **Respect origin** (origin already sends `immutable`)

## Optional second rule

- If: URI Path contains `hero-bg` OR ends with `.ico`
- Cache: Eligible, Edge TTL **1 day**

## After deploy

Purge cache once: **Caching → Configuration → Purge Everything** (or purge by URL prefix `/_next/static`).
