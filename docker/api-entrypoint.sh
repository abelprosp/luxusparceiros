#!/bin/sh
set -e

cd /app/apps/api

echo "[entrypoint] DATABASE_URL set: $( [ -n "$DATABASE_URL" ] && echo yes || echo NO )"
echo "[entrypoint] PORT=${PORT:-not set}"

if [ -f /app/node_modules/.bin/prisma ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  /app/node_modules/.bin/prisma migrate deploy
else
  echo "[entrypoint] prisma CLI not found, using npx prisma@6.19.3..."
  npx --yes prisma@6.19.3 migrate deploy
fi

echo "[entrypoint] Starting API..."
exec node dist/src/main.js
