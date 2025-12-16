FROM oven/bun:1.3.4 AS base

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl curl wget adduser nodejs && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/
COPY apps/backend/package.json ./apps/backend/

WORKDIR /app
RUN bun install --no-save --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY package.json bun.lock* ./
COPY apps/web ./apps/web
COPY apps/backend ./apps/backend

ENV NEXT_TELEMETRY_DISABLED=1

ARG CI
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_SOURCE_COMMIT
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_AXIOM_DATASET
ARG NEXT_PUBLIC_AXIOM_TOKEN
ARG NEXT_PUBLIC_BETA

ENV CI=${CI:-false} \
    NEXT_PUBLIC_CDN_URL=${NEXT_PUBLIC_CDN_URL:-http://localhost:3000} \
    NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL:-http://localhost:3000} \
    NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL:-http://localhost:3002} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-local-google-client-id} \
    NEXT_PUBLIC_SOURCE_COMMIT=${NEXT_PUBLIC_SOURCE_COMMIT:-local-build} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-local-turnstile-key} \
    NEXT_PUBLIC_AXIOM_DATASET=${NEXT_PUBLIC_AXIOM_DATASET:-local} \
    NEXT_PUBLIC_AXIOM_TOKEN=${NEXT_PUBLIC_AXIOM_TOKEN:-local} \
    NEXT_PUBLIC_BETA=${NEXT_PUBLIC_BETA:-false}

WORKDIR /app/apps/web
RUN node node_modules/next/dist/bin/next build --turbo

FROM base AS runner
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["bun", "apps/web/server.js"]
