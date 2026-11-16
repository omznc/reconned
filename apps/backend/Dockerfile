FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY packages/router/package.json ./packages/router/
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
COPY --from=deps /app/packages/router/node_modules ./packages/router/node_modules
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/router ./packages/router
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

EXPOSE 3002

# Fails the deploy if the server isn't actually serving on the port the proxy targets
# (e.g. a platform-injected PORT env overriding the one above). Uses bun's fetch because
# the base image doesn't guarantee curl/wget.
# Only the database decides health: the app runs without Redis. Docker does not restart
# an unhealthy container, so a hung database check sends SIGTERM to the app, and the
# unless-stopped restart policy starts it again.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["bun", "-e", "fetch('http://localhost:3002/api/health', { signal: AbortSignal.timeout(8000) }).then((r) => r.json()).then((b) => process.exit(b.database === 'connected' ? 0 : 1)).catch((e) => { if (e.name === 'TimeoutError') process.kill(1, 'SIGTERM'); process.exit(1); })"]

CMD ["bun", "--no-orphans", "run", "src/index.ts"]
