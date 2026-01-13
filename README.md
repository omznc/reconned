![Image](logo.svg)


A monorepo application for managing airsoft events, clubs, and player profiles with view tracking capabilities.

## Architecture

RECONNED is a monorepo built with Bun workspaces, consisting of:

- **Frontend (`apps/web`)**: Next.js 16+ application with App Router
  - Runs on port **3000** by default
  - Server-side rendering with React Server Components

- **Backend (`apps/backend`)**: Bun HTTP server
  - Runs on port **3002** by default
  - Uses Drizzle ORM for database access
  - Provides authentication endpoints via better-auth
  - OpenAPI documentation available at `/api/docs`

Both applications share the same PostgreSQL database but use different ORMs optimized for their respective use cases.

## Tech Stack

### Frontend
- **Framework:** Next.js 16+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Authentication:** better-auth
- **Form Handling:** react-hook-form + zod
- **State Management:**
  - Server Actions with next-safe-action
  - Client state with React Query
  - URL State with nuqs
  - Feature flags with context providers
- **i18n:** next-intl

### Backend
- **Framework:** Bun's built-in HTTP server
- **Database:** Drizzle ORM + PostgreSQL
- **Authentication:** better-auth
- **API Docs:** OpenAPI/Swagger

### Shared
- **Package Manager:** Bun
- **Language:** TypeScript
- **Linting/Formatting:** Biome

## Getting Started

1. Clone the repository

2. Install dependencies
```sh
bun install
```

3. Set the environment variables
```sh
cp .env.example .env
```

4. Set up the database
```sh
cd apps/backend
bun run db:push
```

5. Run the development servers
```sh
bun dev
```

This will start both:
- Frontend at `http://localhost:3000`
- Backend at `http://localhost:3002`

## Features
- User authentication with better-auth
- Club management with admin controls
- Event management and registration
- Player profiles with gear tracking
- View statistics and analytics
- Feature flags for gradual rollouts
- Admin dashboard with full CRUD operations
- Responsive design with Tailwind CSS
- Type-safe server actions
- Internationalization (i18n) support
- Real-time data with React Query

## Feature Flags

RECONNED includes a comprehensive feature flag system for safe feature rollouts:

- **Admin Management**: Full CRUD interface at `/dashboard/admin/feature-flags`
- **Caching**: Redis-backed caching with database fallback
- **Type Safety**: Compile-time validation with SCREAMING_SNAKE_CASE naming
- **SSR Support**: Server-side rendering compatible
- **Real-time Updates**: Automatic cache invalidation

**Usage:**
```typescript
// Client components
const isEnabled = useFeatureFlag('MY_FEATURE_FLAG');

// Server components
const isEnabled = await getFeatureFlag('MY_FEATURE_FLAG');
```

## Development Guidelines

### Code Standards
- Follow TypeScript best practices
- Use React Server Components by default
- Use client components only when necessary
- Group related components in `_components` folders (see below)
- Format code using Biome

### Contributing
- See [CONTRIBUTING.md](CONTRIBUTING.md)

# License

This software is available under two licenses:

1. **Non-Commercial/Non-Profit Use**: [MIT License](LICENSE.md)
2. **Commercial Use**: Please contact the author for commercial licensing options.

The full terms of each license can be found in the corresponding LICENSE files.
