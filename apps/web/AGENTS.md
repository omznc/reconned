# apps/web

TanStack Start (Vite + Nitro bun preset). Read the root `AGENTS.md` (Frontend section) for conventions.

- Routes: `src/routes/{-$locale}/`. Do not edit `src/routeTree.gen.ts` by hand: `bun run typecheck` regenerates it.
- Dev: `bun run dev` (needs the backend on :3002). Build: `bun run build`. Run the build: `bun run start`.
- Docs for the framework: https://tanstack.com/start/latest/docs/framework/react/overview
