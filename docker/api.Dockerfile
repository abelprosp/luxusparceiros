FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @luxus/types build \
 && pnpm --filter @luxus/utils build \
 && pnpm --filter @luxus/api prisma generate \
 && pnpm --filter @luxus/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs

# Copia monorepo completo para preservar symlinks do pnpm e dependências de runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY docker/api-entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh \
 && mkdir -p /app/apps/api/uploads \
 && chown -R nestjs:nodejs /app

USER nestjs
WORKDIR /app/apps/api
EXPOSE 3001

ENTRYPOINT ["/app/entrypoint.sh"]
