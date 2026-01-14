import { drizzle } from "drizzle-orm/bun-sql";
import * as relations from "../drizzle/relations";
import * as schema from "../drizzle/schema";
import { env } from "./env";

const fullSchema = { ...schema, ...relations };

declare global {
	var __db: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;
}

let db: ReturnType<typeof drizzle<typeof fullSchema>>;

if (process.env.NODE_ENV === "production") {
	db = drizzle(env.DATABASE_URL, { schema: fullSchema });
} else {
	if (!global.__db) {
		global.__db = drizzle(env.DATABASE_URL, { schema: fullSchema });
	}
	db = global.__db;
}

export { db };
