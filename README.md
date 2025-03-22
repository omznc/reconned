<img src="https://reconned.com/reconned-logo-light.svg" alt="Airsoft Event Management System Logo" width="100%" height="auto" style="background: white; padding: 1rem;" />

A Next.js 15+ application for managing airsoft events, clubs, and player profiles with view tracking capabilities.

## Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Prisma ORM + PostgreSQL
- **Authentication:** better-auth
- **Package Manager:** Bun
- **Form Handling:** react-hook-form + zod
- **State Management:** 
  - Server Actions with next-safe-action
  - URL State with nuqs

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
bun prisma db pull # or push if it's a new database
```

5. Run the development server
```sh
bun dev
```

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
