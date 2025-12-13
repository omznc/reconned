import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "../drizzle/schema";
import { env } from "./env";

export const db = drizzle(env.DATABASE_URL, { schema });
