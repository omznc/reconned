![Image](logo.svg)

[![Build and Push Docker Image](https://github.com/omznc/reconned/actions/workflows/docker.yml/badge.svg?branch=main)](https://github.com/omznc/reconned/actions/workflows/docker.yml)

A monorepo application for managing airsoft events, clubs, and player profiles with view tracking capabilities.

> [!IMPORTANT]  
> The prebuilt Docker images you can find under **packages** are for official deployment which will not work for you. You'll need to build it yourself if you want to run RECONNED on your own.

## Architecture

RECONNED is a monorepo built with Bun workspaces, consisting of:

- **Frontend (`apps/web`)**: Next.js 16+ application with App Router
  - Runs on port **3000** by default
  - Uses Prisma ORM for database access
  - Server-side rendering with React Server Components

- **Backend (`apps/backend`)**: Elysia API server
  - Runs on port **3002** by default
  - Uses Drizzle ORM for database access
  - Provides authentication endpoints via better-auth
  - OpenAPI documentation available at `/api/docs`

Both applications share the same PostgreSQL database but use different ORMs optimized for their respective use cases.

## Tech Stack

### Frontend
- **Framework:** Next.js 16+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Prisma ORM + PostgreSQL
- **Authentication:** better-auth
- **Form Handling:** react-hook-form + zod
- **State Management:** 
  - Server Actions with next-safe-action
  - URL State with nuqs
- **i18n:** next-intl

### Backend
- **Framework:** Elysia (Bun runtime)
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
cd apps/web
bun prisma db pull # or push if it's a new database
```

5. Run the development servers
```sh
bun dev
```

This will start both:
- Frontend at `http://localhost:3000`
- Backend at `http://localhost:3002`

## Features
- User authentication
- Club management
- Event management
- Player profiles
- View statistics tracking
- Responsive design
- Type-safe server actions
- i18n support

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
