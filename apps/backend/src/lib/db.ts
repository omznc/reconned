import { drizzle } from "drizzle-orm/bun-sql";
import * as relations from "../drizzle/relations";
import * as schema from "../drizzle/schema";
import { env } from "./env";

const fullSchema = { ...schema, ...relations };

declare global {
	var __db: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;
}

let db: ReturnType<typeof drizzle<typeof fullSchema>>;

// Pool options must go in `connection`: drizzle(url, options) ignores them. Bun reads these values in seconds.
const connectionOptions = {
	schema: fullSchema,
	connection: {
		url: env.DATABASE_URL,
		max: 20,
		idleTimeout: 30,
		maxLifetime: 1800,
		connectionTimeout: 10,
	},
};

if (process.env.NODE_ENV === "production") {
	db = drizzle(connectionOptions);
} else {
	if (!global.__db) {
		global.__db = drizzle(connectionOptions);
	}
	db = global.__db;
}

export { db };
