// Spawned by global-setup with the test environment; drizzle-kit's CLI migrator needs a Node
// pg driver the repo doesn't ship, so migrations run through the app's own bun-sql migrator.
import { runMigrations } from "../../src/lib/migrate";

await runMigrations();
process.exit(0);
