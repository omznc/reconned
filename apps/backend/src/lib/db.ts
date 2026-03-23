import { drizzle } from "drizzle-orm/bun-sql";
import * as relations from "../drizzle/relations";
import * as schema from "../drizzle/schema";
import { env } from "./env";

const fullSchema = { ...schema, ...relations };

declare global {
	var __db: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;
}

let db: ReturnType<typeof drizzle<typeof fullSchema>>;

const connectionOptions = {
	schema: fullSchema,
	max: 20,
	maxTimeout: 30000,
	idleTimeout: 30000,
};

if (process.env.NODE_ENV === "production") {
	db = drizzle(env.DATABASE_URL, connectionOptions);
} else {
	if (!global.__db) {
		global.__db = drizzle(env.DATABASE_URL, connectionOptions);
	}
	db = global.__db;
}

export { db };
