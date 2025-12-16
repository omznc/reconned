FROM oven/bun:1.3.4 AS base

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl curl wget && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
RUN bun install --no-save --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend
RUN bun run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME="0.0.0.0"

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

EXPOSE 3001

CMD ["bun", "run", "apps/backend/dist/index.js"]
