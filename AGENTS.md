# RECONNED — Agent Instructions

## Monorepo

Bun workspaces at `apps/*`. Two packages:

- **`apps/web`** — Next.js 16 App Router, port 3000. Tailwind CSS v4, shadcn/ui, next-intl, React Query, nuqs, next-safe-action, framer-motion.
- **`apps/backend`** — Bun HTTP server, port 3002. Custom `@reconned/router`, Drizzle ORM + PostgreSQL, better-auth, OpenAPI/Scalar docs.

The `backend` package is a dep of `web` (`"backend": "workspace:*"`). Web imports backend code directly and transpiles it via `transpilePackages`.

## Dev Setup & Commands

```sh
cp apps/web/.env.example apps/web/.env
cp apps/backend/.env.example apps/backend/.env
bun install
```

**Run everything** (starts Postgres container → backend → waits for OpenAPI → web):
```
bun dev
```

**Run individually:**
```
bun run dev:backend   # apps/backend --hot
bun run dev:web       # apps/web (next dev --turbo)
```

**`bun dev` order matters**: Postgres → backend → (wait for OpenAPI at :3002) → web. The web `predev` script auto-generates API types from the backend OpenAPI spec before starting.

Port kill shortcut: `bun run kill` (frees :3000 and :3002).

## Lint / Typecheck / Build

| Command | What |
|---|---|
| `bun check` | Biome lint + format + organize imports (write mode) |
| `bun run typecheck` | `tsc --noEmit` for all workspaces |
| `bun run build` | Builds backend then web (needs backend running) |
| `bun run --filter web build` | Next.js Turbopack build |
| `bun run --filter backend build` | Bun bundler to `dist/` |
| `bun run knip` | Dead code detection |

**Pre-commit hook** runs `bun run --filter web build` (a full Next.js build).

**Web build ignores tsc errors** (`next.config.ts`: `typescript: { ignoreBuildErrors: true }`). Typecheck separately.

## Biome Config Quirks

- `indentWidth: 4` (not default 2), `lineWidth: 120`
- Double quotes (`quoteStyle: "double"`)
- shadcn UI files excluded from linting (`!**/src/components/ui`)
- `organizeImports: "on"` (auto-fix)
- No ESLint or Prettier in this repo

## Database

PostgreSQL 16 via Docker (`scripts/start-postgres.sh`). Container name: `reconned-postgres-dev`. Schema: `apps/backend/src/drizzle/schema.ts`.

Drizzle commands (run from `apps/backend`):
```
bun run db:push        # Push schema to DB (dev)
bun run db:migrate     # Run migrations
bun run db:generate    # Generate migration files
bun run db:studio      # Drizzle Studio GUI
bun run db:seed        # Seed database
```

## Database Schema

Core entities and relationships:

- **User**: id, email, name, slug, callsign, language, font, theme, style, role, gear (jsonb[])
- **Club**: id, name, slug, location, latitude, longitude, countryId, isPrivate, isAllied
- **Event**: id, name, slug, clubId, dateStart, dateEnd, location, mapData (jsonb), gearRequirements (jsonb[])
- **Memberships**: ClubMembership (userId, clubId, role), ClubInvite (email, clubId, status)
- **Registrations**: EventRegistration (eventId, createdById, type, paymentMethod, attended)
- **Audit**: ClubAuditLog (clubId, userId, actionType, actionData jsonb, ipAddress, userAgent)

## API Types

Auto-generated from backend OpenAPI spec. Regenerate: `bun run api:generate-types` (in `apps/web`). Runs automatically in `predev`.

## Import Conventions

- **Zod**: Always `import * as z from "zod"` (never named import)
- **No `forEach`**: Use `for...of` instead
- **Absolute imports only**: `@/components/...`, not relative
- **Block statements required**: Always use `{}` even for single-line conditions
- **No `any` or `never`**: Prefer type inference
- **No redundant comments**: Code should be self-explanatory

## Documentation Rules

- Never create markdown files (REVIEW.md, SUMMARY.md, CHANGES.md, etc.) unless explicitly requested. Provide explanations in conversation instead.

## File & Path Conventions

- Form components: `[feature].form.tsx`
- Related components: Group in `_components/` folders next to their pages
- Define Zod schemas **inside** form components (not separate files) so they can use `t()` for translated error messages
- Path aliases: `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/ui/*`

## i18n

- next-intl with automatic extraction via `useExtracted()` (client) or `getExtracted()` (server)
- Pass literal English strings: `t("Made by awesome people")`
- Run `bun dev` → numeric keys auto-generate in `apps/web/messages/*.json` for all locales
- To translate: grep the English key name from `en.json`, then set the same key's value in `sr.json` (Cyrillic) and `bs.json`
- **Note**: Serbian uses Cyrillic script
- Translation files: `apps/web/messages/`

## Frontend Patterns

- **Components**: Favor React Server Components. Use `"use client"` only for interactivity.
- **Data fetching**:
  - Server: `next-safe-action` for type-safe actions; `apiServer` from `@/lib/api/api.ts` for fetches (cookie forwarding, rate-limit bypass)
  - Client: `apiClient` from `@/lib/api/api.client.ts` with `@tanstack/react-query`
- **Forms**: `useForm` from react-hook-form with `zodResolver`. Use `useQueryState("entityId")` for modal/drawer open state.
- **Error feedback**: `sonner` toast for user notifications
- **SEO**: `constructCanonicalUrl()`, `generatePageLanguages()` from `@/lib/utils.ts`
- **API response types**: `type Entity = ApiResponse<"/api/.../{id}", "get">["entity"]`

## Backend Patterns

- **Router**: Custom router at `src/lib/router.ts` with `.get()`, `.post()`, `.put()`, `.delete()` methods. Compose sub-routers with `router.use(subRouter)`.
- **Route schema**: Always define `body`, `query`, and `response` Zod schemas per route — auto-generates OpenAPI docs.
- **Response helpers**: `response.json(data, status?)`, `response.error(data, status?)`, `response.redirect(url, code)`
- **Error factories**: `apiError.unauthorized()`, `.forbidden()`, `.notFound()`, `.validation()`, `.conflict()`, `.rateLimited()`, `.internal()`, `.database()` from `src/lib/errors.ts`

## Feature Flags

- `SCREAMING_SNAKE_CASE` naming required
- Server: `getFeatureFlag('FLAG_NAME')` / `isFeatureEnabled('FLAG_NAME')`
- Client: `useFeatureFlag('FLAG_NAME')` hook
- Redis-backed with DB fallback
- Admin UI at `/dashboard/admin/feature-flags`

## Authentication

- Config: `apps/backend/src/lib/auth.ts` (plugins: passkey, twoFactor, admin, emailHarmony, captcha)
- Client: `authClient` from `@/lib/auth-client.ts`
- Hook: `useIsAuthenticated()` for current user and loading state
- Custom user fields: callsign, language, font, theme, style

## Storage

- Backend S3 utilities in `src/lib/storage.ts`: `getS3UploadUrl()`, `deleteS3Files()`
- Frontend: `useFileUpload` from `@/hooks/use-file-upload.ts` (multiple files, progress tracking)
- Allowed: image/jpeg, image/png, image/webp, image/gif, max 5MB

## Project-Specific Patterns

- **Sluggable entities**: Clubs, Events, Users accept both UUID and slug in routes (`/clubs/{id}`)
- **JSONB fields**: Always cast when querying — `e.mapData as z.infer<typeof schema>["mapData"]`
- **Privacy**: Users and Clubs have `isPrivate` flags; users also have `isPrivateEmail`, `isPrivatePhone`, `isPrivateStats`
- **Instagram**: Clubs can connect Instagram; tokens auto-stripped from public API responses via Zod schema validation

## Testing

No tests exist yet. Test scaffolding is in `apps/backend/tests/` with empty domain directories (admin, clubs, events, reviews, users). Would use `bun test` if added.

## Notables

- `next.config.ts` has `output: "standalone"` — Docker builds produce a standalone server
- Backend `tsconfig.json` uses `noUnusedLocals` + `noUnusedParameters` (stricter than root)
- `reactCompiler: true` is enabled in next.config
- Rate limiting: 100 req/min per IP globally. Internal bypass via `x-internal-api-secret` header
