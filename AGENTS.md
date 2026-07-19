# RECONNED — Agent Instructions

RECONNED is an airsoft club/event platform: a Bun-workspaces monorepo.

- **`apps/web`** — Next.js 16 App Router, port 3000. Tailwind CSS v4, shadcn/ui, next-intl, React Query, nuqs, next-safe-action.
- **`apps/backend`** — Bun HTTP server, port 3002. Built on `@reconned/router`, Drizzle ORM + PostgreSQL, Redis, better-auth, OpenAPI/Scalar docs.
- **`packages/router`** — `@reconned/router`, the routing/OpenAPI/rate-limit/cache framework the backend is built on.

The `backend` package is a dep of `web` (`"backend": "workspace:*"`); web imports backend code directly via `transpilePackages`.

## Commands

Root-level (docker Postgres/Redis are auto-started by the `test*` scripts):

- `bun dev` — Postgres container → backend → (wait for OpenAPI at :3002) → web. Web's `predev` regenerates API types first. `bun run kill` frees :3000/:3002.
- `bun run test` — backend integration tests (prefer running from `apps/backend`, see below)
- `bun run test:e2e` / `test:e2e:ui` — Playwright E2E (isolated stack: web 3100, backend 3202, DB `reconned_e2e`, redis /2)
- `bun run typecheck` — all three workspaces; web's runs `next typegen` first (required — `PageProps`/`LayoutProps` and `@public/*` image types are generated into `.next/types`)
- `bun check` — Biome lint+format with `--write`; CI runs `bunx biome ci .`. Always run Biome from the repo root.
- `bun run knip` — dead code detection

Backend (`cd apps/backend`):

- `bun test` — full integration suite (~2 min). Single file: `bun test tests/clubs/core.test.ts`. Filter: `bun test -t "deletes the club"`. `--coverage` gives real line coverage (tests boot the server in-process).
- `bun db:push` / `db:generate` / `db:migrate` / `db:studio` / `db:seed` — Drizzle; ask the user before pushing schema changes
- `bun run task <name>` / `task:list` — run background tasks manually

Web (`cd apps/web`):

- `bun run api:generate-types` — regenerate `src/lib/api/api-types.ts` from the running backend's OpenAPI spec. This file is **committed**; regenerate + `bunx biome check --write` it whenever backend route schemas change.

The web build ignores tsc errors (`typescript: { ignoreBuildErrors: true }`) — typecheck separately. A pre-commit hook (installed via `postinstall`) runs checks.

## Hard constraints

- NEVER use `forEach` — always `for...of`.
- ALWAYS use block statements with curly braces, even for single-line conditions.
- ALWAYS use absolute imports in the web app (`@/components/...`; aliases: `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/ui/*`).
- Zod import style: `import * as z from "zod";` (never `import { z } from "zod";`).
- NEVER use `any` or `never`. Prefer type inference over manual re-typing.
- No redundant comments; code should be self-explanatory.
- NEVER create markdown files (REVIEW.md, SUMMARY.md, etc.) to explain your work unless explicitly asked — explain in the conversation.
- Biome exclusively (no ESLint/Prettier): tabs, 120 line width, double quotes, `noNonNullAssertion` enforced (use a guarded const instead of `!`). shadcn `src/components/ui` files, Drizzle meta JSONs, `apps/web/messages`, and generated files are excluded — don't hand-format them.

## Frontend (apps/web)

### Components & data fetching

- Favor React Server Components; `"use client"` only for interactivity. Keep logic on the backend unless it must run on the Next.js server.
- Server-side fetches: `apiServer` from `@/lib/api/api.ts` (forwards cookies + rate-limit bypass secret).
- Client-side fetches: `apiClient` from `@/lib/api/api.client.ts` with `@tanstack/react-query`.
- Server actions: `next-safe-action`.
- Types: import shared entities (`User`, `Club`, `Event`, `ClubMember`, `Role`, …) from `@/lib/api/api-type-helpers.ts`; extract any endpoint's type with `ApiResponse<Path, Method>`:
  ```typescript
  type Entity = ApiResponse<"/api/admin/entities/{id}", "get">["entity"];
  ```

### i18n

- `useExtracted()` (client) / `await getExtracted()` (server); calls must be statically analyzable literal strings: `t("My Heading")`.
- Write English strings in code; `bun dev` extracts keys into `apps/web/messages/*.json`, then populate `bs.json` and `sr.json` (Serbian uses Cyrillic) from the English values.
- Locales: en/bs/sr, default `bs`, `localePrefix: "as-needed"`.

### Forms

- File naming: `[feature].form.tsx`. Related components live in `_components/` folders next to their pages.
- Define zod schemas **inside** form components (not separate files) so error messages can use `t()`.
- Standard CRUD form shape: `react-hook-form` + `zodResolver`; edit-vs-create driven by a `useQueryState("entityId", { shallow: false, clearOnDefault: true, history: "replace" })` nuqs param; on success `toast.success(t(...))`, `setEntityId(null)`, `form.reset()`, `router.refresh()`; on `{ error }` from apiClient, `toast.error(t(...))` and return.

### Tables, modals, deletes

- Use `GenericDataTable` (`@/components/generic-data-table.tsx`) — column configs support custom components, badge variants, dot-notation nested access.
- Modal/sheet state: local `useState<Entity | null>` — entity set means open; render conditionally and pass `onClose` to reset. Sheets use `Credenza` with `open={Boolean(selectedEntity)}`.
- Deletes: `useConfirm()` from `@/components/ui/alert-dialog-provider`, then `apiClient.DELETE`, toast, `router.refresh()`.
- Notifications: `sonner` toasts with translated messages.

### Feature flags

- Names are `SCREAMING_SNAKE_CASE` (validated `/^[A-Z][A-Z0-9_]*$/`). Admin CRUD at `/dashboard/admin/feature-flags`.
- Client: `useFeatureFlag("FLAG")`; server components: `await getFeatureFlag("FLAG")`; backend routes: `await isFeatureEnabled("FLAG")` (Redis cache ~5 min, DB fallback).
- Current flags: `CLUBS_SPENDING`, `REVIEWS`, `EVENT_REGISTRATION`.

### SEO / providers

- `constructCanonicalUrl(baseUrl, pathname, locale)` and `generatePageLanguages(...)` from `@/lib/utils.ts`; for sluggable entities use `generateHreflangAlternatesForSluggableEntity`.
- Provider order (root layout): `Providers > ThemeProvider > FontProvider > StyleProvider > FeatureFlagsProvider > TooltipProvider > AlertDialogProvider`.

## Backend (apps/backend)

### Router (`@reconned/router`, in packages/router)

- `router.get/post/put/delete(path, handler, { auth, rateLimit, cache, bustCache, schema })`; compose domain routers with `parentRouter.use(childRouter)`. Routes live in `src/routes/**`, one `Router` per domain.
- Always define `params`/`body`/`query`/`response` zod schemas in `schema` — they generate OpenAPI docs, strip undeclared response fields, and (with `mcpTool: true`) expose the route as an MCP tool. Registering the same method+path twice throws at boot (`onDuplicateRoute: "throw"`).
- Response helpers: `response.json(data, statusCode?)`, `response.redirect(url, 301 | 302)`.
- Request flow in `src/index.ts`: better-auth (`/api/auth/*`, handled *before* the router, so no router rate limit) → MCP (`/api/mcp`) → OpenAPI routes → `mainRouter`. Port from `process.env.PORT`, default 3002.

### Errors

- Throw `apiError.*` from `@reconned/router` (`unauthorized`, `forbidden`, `notFound`, `validation`, `conflict`, `rateLimited`, `internal`, `database`) — thrown `AppError`s are formatted automatically with the right status.
- A plain thrown `Error` becomes a 500. Lib-level client-input validation should throw `apiError.validation(...)` directly (see `src/lib/storage.ts`).
- In catch blocks that wrap errors into `apiError.internal`, rethrow `AppError` first so 4xx errors aren't converted to 500s.

### Rate limiting

- Global default: 600 req/min per IP, Redis-backed (`redisRateLimitStore` + `rateLimitKey` from `src/lib/cache.ts`), configured on `mainRouter` in `src/index.ts`.
- Requests with header `x-internal-api-secret: $INTERNAL_API_SECRET` (the web SSR layer) map to a bypass key the store short-circuits.
- Per-route `rateLimit` configs must pass `store: redisRateLimitStore, keyGenerator: rateLimitKey`, otherwise they silently fall back to a per-process Map keyed on `x-forwarded-for`.

### Drizzle

- Schema in `src/drizzle/schema.ts`; quoted PascalCase table names (`"User"`, `"Club"`, `"ClubAuditLog"`, …). Use `createSelectSchema` from `drizzle-zod` for response schemas.
- JSONB fields must be cast when querying: `mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"]`. JSONB lives on `Event.mapData` (GeoJSON), `Event.gearRequirements`, `User.gear`, `ClubAuditLog.actionData`.
- Schema changes: `bun db:push` (dev) — prompt the user to run it rather than running it yourself.
- `ClubAuditLog` has an `onDelete: cascade` FK to `Club` — never insert an audit row after deleting its club.
- `src/lib/db.ts` binds `DATABASE_URL` at module import; `src/lib/env.ts` validates env at import. Order matters for anything that overrides env (tests do this).

### Auth (better-auth, `src/lib/auth.ts`)

- Plugins: passkey, twoFactor, admin, emailHarmony, captcha (Turnstile), lastLoginMethod, openAPI.
- Custom user fields: `callsign`, `language` (bs/en/sr), `font` (sans/mono), `theme` (dark/light), `style` (relaxed/compact).
- `/api/admin/*` requires the admin role, re-read from the DB per request — session cookies cache the role claim, so after changing a role, re-sign-in.
- Web client: `authClient` from `@/lib/auth-client.ts`; `useIsAuthenticated()` for current user + loading state.
- DB hook: verifying an email auto-accepts pending club invites.

### Storage (S3, `src/lib/storage.ts`)

- `getS3UploadUrl(key, type, size, userId?)` presigns PUT URLs (local crypto — works without network); throws `apiError.validation` for bad type/size. Allowed: jpeg/png/webp/gif, max 5MB. `deleteS3Files(keys, userId?)` for deletes.
- Web upload hook: `useFileUpload` from `@/hooks/use-file-upload.ts`; cache-bust rendered images with `addImageVersion(url)` from `@/lib/utils.ts`.

### Logging

- PostHog + OpenTelemetry via `logger.emit(...)` from `src/lib/posthog.ts`; async, structured attributes. Zod response stripping logs which fields were removed.

## Backend test harness (non-obvious)

- `apps/backend/bunfig.toml` preloads `tests/helpers/global-setup.ts`: resets DB → migrates → seeds → flushes redis → force-overrides `process.env` from `.env.test` → imports `src/index.ts` **in-process**. Tests hit `http://localhost:3102`.
- Config in `tests/helpers/env.ts` / `.env.test`: DB `reconned_test`, redis db /1, port 3102. **Never kill port 3102 during a test run.** Set `TEST_SHARD=N` (N≥1) for a parallel run on port 3102+N / DB `reconned_test_shN` / redis 1+N.
- The test client (`tests/helpers/client.ts`) sends the internal-secret header on every request to bypass the global rate limiter. Reviews tests use distinct `x-forwarded-for` values per request for the per-route limiter.
- `tests/helpers/auth.ts`: `createUser()` (captcha always-pass test keys), `makeAdmin(user)` (DB role update + re-sign-in), `testDb` (raw SQL handle).
- Root `bun test` is blocked by a preload guard (`scripts/test-root-guard.ts`) — run backend tests from `apps/backend`, router tests from `packages/router`.
- Known unreachable coverage: better-auth internals, Instagram/Facebook Graph API, MCP OAuth flow, S3 network deletes, email sending (`EMAIL_DISABLED=true`).

## E2E (Playwright)

- `playwright.config.ts` at root; specs in `e2e/`. Playwright's `webServer` boots both the backend (`tests/helpers/e2e-serve.ts` — resets/migrates/seeds `reconned_e2e`, serves on 3202) and web (`next dev` on 3100 with the dummy `webEnv`).
- Locally `reuseExistingServer: !CI` piggybacks on your dev servers — reproduce CI behavior with `CI=true bunx playwright test`.
- Every var in `env.ts`'s `client` block must be present in `webEnv` (dummy values fine): the browser bundle validates `NEXT_PUBLIC_*` and cannot see `CI=true`, so a missing var crashes every page.
- Ports/URLs in `playwright.config.ts` must stay in sync with `apps/backend/tests/helpers/e2e-prepare.ts`.

## CI (.github/workflows/ci.yml)

Three jobs on PRs and pushes to main/dev: `checks` (biome ci, workspace typecheck, e2e-suite typecheck, router unit tests), `backend-tests` (Postgres+Redis service containers, `bun test` in apps/backend), `e2e` (Playwright with browser cache). PRs target `dev`.

## Production architecture

- Nginx proxies public traffic. API requests go directly to the backend (`localhost:3002`), not through Next.js — the `rewrites()` for `/api/:path*` are dev-only. Next.js serves HTML/static only in production (`output: "standalone"`).
- All services run in Docker on a single Hetzner box via Coolify.

## Project-specific patterns

- **Sluggable entities**: clubs, events, users accept either UUID or slug in `/{id}` routes; the backend resolves which.
- **Privacy flags**: users have `isPrivate`, `isPrivateEmail`, `isPrivatePhone`, `isPrivateStats`; clubs have `isPrivate`, `isPrivateStats`. Respect them in every read path.
- **Club roles**: `ClubMembership.role` is `USER | MANAGER | CLUB_OWNER`; manager-or-owner gates most club mutations, owner-only for destructive ones.
- **Instagram integration**: club tokens (`instagramAccessToken` etc.) are sensitive — response schemas must omit them (zod stripping enforces this).
