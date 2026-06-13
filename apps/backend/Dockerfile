FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY scripts ./scripts/

WORKDIR /app
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --no-save --frozen-lockfile

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3002 \
    HOSTNAME="0.0.0.0"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

EXPOSE 3002

CMD ["bun", "--no-orphans", "run", "src/index.ts"]
