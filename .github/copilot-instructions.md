## Package Management and Development
- Use `bun` as the package manager

## Code Style
- Never use `forEach`, always use `for...of` loops instead
- Always use block statements with curly braces {}, even for single-line conditions
- Use Biome for formatting and linting (configured in biome.json)
- No ESLint or Prettier - exclusively use Biome
- Use shadcn/ui components with Tailwind CSS for UI components
- Use TypeScript for type safety

## State Management & Data Fetching
- Use `next-safe-action` for type-safe server actions
- Use React Server Components where possible
- Use client components only when necessary (e.g., for interactivity)
- Use [nuqs](src/lib/nuqs) for URL state management in tables and filters

## Project Structure
- Pages and routes follow Next.js 13+ App Router structure
- Group related components in `_components` folders next to their pages
- Use aliases for imports (configured in components.json):
  - `@/components`
  - `@/lib`
  - `@/hooks`
  - `@/ui`

## Database
- Use Prisma as ORM
- Run `prisma generate` after schema changes
- Database models are defined in [prisma/schema.prisma](prisma/schema.prisma)

## Authentication
- Uses [better-auth](package.json) for authentication management

## Other
- Always use react-hook-forms and zod. Schemas should be in a different file so we
can import them in actions as well.

## Language
- Use bosnian for all code strings
