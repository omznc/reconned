#!/usr/bin/env bun

import { lt } from "drizzle-orm";
import { clubInvite } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";

const tasks: Record<string, () => Promise<void>> = {
	"clean-expired-invites": async () => {
		logger.emit({
			severityText: "info",
			body: "Running task: clean-expired-invites",
		});
		const now = new Date().toISOString();

		const result = await db
			.delete(clubInvite)
			.where(lt(clubInvite.expiresAt, now))
			.returning({ id: clubInvite.id });

		logger.emit({
			severityText: "info",
			body: "Clean expired invites completed",
			attributes: {
				deletedCount: result.length.toString(),
			},
		});
	},
};

async function main() {
	const args = process.argv.slice(2);
	const taskName = args[0];

	if (!taskName || taskName === "--list" || taskName === "-l") {
		logger.emit({
			severityText: "info",
			body: "Listing available tasks",
			attributes: {
				taskNames: JSON.stringify(Object.keys(tasks)),
			},
		});
		console.log("\nAvailable tasks:");
		for (const name of Object.keys(tasks)) {
			console.log(`  - ${name}`);
		}
		console.log("\nUsage: bun run src/tasks/run-task.ts <task-name>");
		process.exit(0);
	}

	const task = tasks[taskName];
	if (!task) {
		logger.emit({
			severityText: "error",
			body: "Task not found",
			attributes: {
				taskName,
				availableTasks: JSON.stringify(Object.keys(tasks)),
			},
		});
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
		logger.emit({
			severityText: "info",
			body: "Task completed successfully",
			attributes: {
				taskName,
				duration: duration.toString(),
			},
		});
		console.log(`\n✓ Task completed in ${duration}ms`);
		process.exit(0);
	} catch (error) {
		logger.emit({
			severityText: "error",
			body: "Task execution failed",
			attributes: {
				taskName,
				error: error instanceof Error ? error.message : String(error),
			},
		});
		console.error("\n❌ Task failed:", error);
		process.exit(1);
	}
}

main();
