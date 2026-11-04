#!/bin/sh
# Fails when apps/web/src/lib/api/api-types.ts does not match the backend's current OpenAPI spec.
# Boots the backend with the dummy test env on its own port; it serves the spec without Postgres or Redis.
set -eu

PORT=3302
TYPES_FILE=apps/web/src/lib/api/api-types.ts

cd "$(dirname "$0")/.."

(cd apps/backend && PORT=$PORT exec bun --env-file=.env.test src/index.ts) >/dev/null 2>&1 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

attempts=0
until curl -sf "http://localhost:$PORT/api/openapi.json" >/dev/null 2>&1; do
	attempts=$((attempts + 1))
	if [ "$attempts" -ge 120 ]; then
		echo "Backend did not serve /api/openapi.json on port $PORT within 60s" >&2
		exit 1
	fi
	sleep 0.5
done

(cd apps/web && NEXT_PUBLIC_BACKEND_URL="http://localhost:$PORT" bun run api:generate-types)
bunx biome check --write "$TYPES_FILE" >/dev/null

if ! git diff --exit-code -- "$TYPES_FILE"; then
	echo "$TYPES_FILE is out of date with the backend OpenAPI spec." >&2
	echo "Run 'bun run api:check-types' from the repo root and commit the result." >&2
	exit 1
fi

echo "$TYPES_FILE is up to date."
