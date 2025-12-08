#!/usr/bin/env bun

import { Database } from "../src/lib/database";

const _db = Database.getInstance();

async function seed() {
	console.log("🌱 Seeding database...");

	// Add sample data here
	console.log("✅ Database seeded successfully");
}

if (import.meta.main) {
	seed().catch(console.error);
}
