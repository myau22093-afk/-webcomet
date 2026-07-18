#!/bin/sh
set -e

export PORT="${PORT:-8080}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export NODE_ENV=production

echo "[webcomet] PORT=$PORT HOSTNAME=$HOSTNAME"

if [ -f /app/server.js ]; then
  cd /app
  echo "[webcomet] using /app/server.js"
  exec node server.js
fi

if [ -f /app/webcomet/server.js ]; then
  echo "[webcomet] using nested standalone at /app/webcomet"
  mkdir -p /app/webcomet/.next
  if [ -d /app/.next/static ] && [ ! -d /app/webcomet/.next/static ]; then
    cp -a /app/.next/static /app/webcomet/.next/static
  fi
  if [ -d /app/public ] && [ ! -d /app/webcomet/public ]; then
    cp -a /app/public /app/webcomet/public
  fi
  cd /app/webcomet
  exec node server.js
fi

echo "[webcomet] server.js not found"
ls -la /app
ls -la /app/webcomet 2>/dev/null || true
exit 1
