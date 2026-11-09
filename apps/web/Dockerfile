FROM oven/bun:canary AS base
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

RUN bun run build

FROM oven/bun:canary AS runner
WORKDIR /app

# The server reads NEXT_PUBLIC_* at runtime too (Next.js only inlined them at build time).
# Bake the build args in, so a deploy that sets them only as build variables still starts.
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_SOURCE_COMMIT
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_AXIOM_DATASET
ARG NEXT_PUBLIC_AXIOM_TOKEN
ARG NEXT_PUBLIC_BETA

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_PUBLIC_CDN_URL=${NEXT_PUBLIC_CDN_URL} \
    NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL} \
    NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    NEXT_PUBLIC_SOURCE_COMMIT=${NEXT_PUBLIC_SOURCE_COMMIT} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NEXT_PUBLIC_AXIOM_DATASET=${NEXT_PUBLIC_AXIOM_DATASET} \
    NEXT_PUBLIC_AXIOM_TOKEN=${NEXT_PUBLIC_AXIOM_TOKEN} \
    NEXT_PUBLIC_BETA=${NEXT_PUBLIC_BETA}

RUN groupadd -r -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs -d /app -s /sbin/nologin app

COPY --from=builder --chown=app:nodejs /app/apps/web/.output ./apps/web/.output

USER app

EXPOSE 3000

CMD ["bun", "--smol", "--no-orphans", "apps/web/.output/server/index.mjs"]
