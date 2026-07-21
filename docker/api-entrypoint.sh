#!/bin/sh
set -e

echo "[entrypoint] DATABASE_URL set: $( [ -n "$DATABASE_URL" ] && echo yes || echo NO )"
echo "[entrypoint] PORT=${PORT:-not set}"

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERRO: configure DATABASE_URL (referência ao PostgreSQL na Railway)"
  exit 1
fi

echo "[entrypoint] Running prisma migrate deploy..."
prisma migrate deploy --schema=./prisma/schema.prisma

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "[entrypoint] Running idempotent database seed..."
  prisma db seed --schema=./prisma/schema.prisma
fi

echo "[entrypoint] Starting API on port ${PORT:-3001}..."
exec node dist/src/main.js
