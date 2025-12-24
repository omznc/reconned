# Backend API

Backend API built with Bun's built-in HTTP server and Drizzle ORM.

## Setup

1. Copy `.env` from the web app or create one with required environment variables
2. Install dependencies: `bun install` (from root)
3. Start dev server: `bun run dev` (from root, or `cd apps/backend && bun run dev`)

The backend runs on port **3002** by default.

## Database

The database schema is managed with Drizzle ORM. The schema is located in `src/drizzle/schema.ts`.

- `bun run db:generate` - Generate migrations
- `bun run db:push` - Push schema changes to database
- `bun run db:migrate` - Run migrations
- `bun run db:studio` - Open Drizzle Studio

## API Documentation

API documentation is available via Swagger UI at `http://localhost:3002/api/docs`.

The OpenAPI specification is automatically generated from your route schemas and is available at `http://localhost:3002/api/openapi.json`.
