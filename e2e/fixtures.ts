import { readFileSync } from "node:fs";
import path from "node:path";

export const BACKEND_URL = "http://localhost:3202";
export const authDir = path.join(__dirname, ".auth");

export interface Fixtures {
	user: { email: string; password: string; name: string };
	event: { id: string; name: string };
	club: { id: string; name: string };
}

/** Fixture data written by global-setup, read by the specs. */
export function loadFixtures(): Fixtures {
	return JSON.parse(readFileSync(path.join(authDir, "fixtures.json"), "utf8"));
}
