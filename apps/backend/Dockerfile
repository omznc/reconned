FROM oven/bun:1.3.4 AS base

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl curl wget && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY scripts ./scripts/

WORKDIR /app
RUN bun install --no-save --frozen-lockfile

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3002 \
    HOSTNAME="0.0.0.0"

# Copy the root node_modules and workspace structure
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
