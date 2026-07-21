FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY . .
RUN pnpm --filter @luxus/types build \
 && pnpm --filter @luxus/utils build \
 && pnpm --filter @luxus/api prisma generate \
 && pnpm --filter @luxus/api build \
 && pnpm deploy --filter=@luxus/api --prod /prod

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs \
 && npm install -g prisma@6.19.3

COPY --from=builder --chown=nestjs:nodejs /prod ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --chown=nestjs:nodejs docker/api-entrypoint.sh /app/entrypoint.sh

RUN prisma generate --schema=./prisma/schema.prisma \
 && sed -i 's/\r$//' /app/entrypoint.sh \
 && chmod +x /app/entrypoint.sh \
 && mkdir -p uploads \
 && chown nestjs:nodejs uploads

USER nestjs
EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
