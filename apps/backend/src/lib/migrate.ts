import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { env } from "./env";

export async function runMigrations() {
	const db = drizzle(env.DATABASE_URL);
	await migrate(db, { migrationsFolder: "./src/drizzle" });
}
