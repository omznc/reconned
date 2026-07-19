FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/
COPY apps/backend/package.json ./apps/backend/
COPY packages/router/package.json ./packages/router/
COPY scripts ./scripts/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --no-save --frozen-lockfile

COPY apps/web ./apps/web
COPY apps/backend ./apps/backend
COPY packages/router ./packages/router

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

RUN --mount=type=cache,target=/app/apps/web/.next/cache \
    bun node_modules/next/dist/bin/next build --turbo

FROM oven/bun:1.3.14 AS runner
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN groupadd -r -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs -d /app -s /sbin/nologin nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["bun", "--smol", "--no-orphans", "apps/web/server.js"]
