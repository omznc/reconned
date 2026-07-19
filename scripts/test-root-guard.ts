// Preloaded by the root bunfig.toml when `bun test` is run from the repo root. That mixes
// the router unit tests with the backend integration tests minus their setup (the server
// never starts, so every backend test fails instantly). Fail fast with directions instead.
console.error(
	[
		"Don't run `bun test` from the repo root — each suite needs its own working directory:",
		"",
		"  backend integration tests:  bun run test        (or: cd apps/backend && bun test)",
		"  router unit tests:          cd packages/router && bun test",
		"  Playwright E2E tests:       bun run test:e2e",
	].join("\n"),
);
process.exit(1);
