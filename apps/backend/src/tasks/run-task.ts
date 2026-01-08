#!/usr/bin/env bun

import { lt } from "drizzle-orm";
import { clubInvite } from "../drizzle/schema";
import { db } from "../lib/db";

const tasks: Record<string, () => Promise<void>> = {
	"clean-expired-invites": async () => {
		console.log("Running: clean-expired-invites");
		const now = new Date().toISOString();

		const result = await db
			.delete(clubInvite)
			.where(lt(clubInvite.expiresAt, now))
			.returning({ id: clubInvite.id });

		if (result.length > 0) {
			console.log(`✓ Deleted ${result.length} expired invite(s)`);
		} else {
			console.log("✓ No expired invites to clean up");
		}
	},
};

async function main() {
	const args = process.argv.slice(2);
	const taskName = args[0];

	if (!taskName || taskName === "--list" || taskName === "-l") {
		console.log("\nAvailable tasks:");
		for (const name of Object.keys(tasks)) {
			console.log(`  - ${name}`);
		}
		console.log("\nUsage: bun run src/tasks/run-task.ts <task-name>");
		process.exit(0);
	}

	const task = tasks[taskName];
	if (!task) {
		console.error(`❌ Task not found: ${taskName}`);
		console.log("\nAvailable tasks:");
		for (const name of Object.keys(tasks)) {
			console.log(`  - ${name}`);
		}
		process.exit(1);
	}

	const startTime = Date.now();
	try {
		await task();
		const duration = Date.now() - startTime;
		console.log(`\n✓ Task completed in ${duration}ms`);
		process.exit(0);
	} catch (error) {
		console.error("\n❌ Task failed:", error);
		process.exit(1);
	}
}

main();
