import { lt } from "drizzle-orm";
import { clubInvite } from "../drizzle/schema";
import { db } from "../lib/db";

interface Task {
	name: string;
	interval: number;
	handler: () => Promise<void>;
	runOnStart?: boolean;
}

export const TimeIntervals = {
	MINUTE: 60 * 1000,
	HOUR: 60 * 60 * 1000,
	DAY: 24 * 60 * 60 * 1000,
	WEEK: 7 * 24 * 60 * 60 * 1000,
	minutes: (n: number) => n * 60 * 1000,
	hours: (n: number) => n * 60 * 60 * 1000,
	days: (n: number) => n * 24 * 60 * 60 * 1000,
};

class TaskScheduler {
	private tasks: Task[] = [];
	private intervals: Map<string, Timer> = new Map();
	private isRunning = false;
	private taskRunning: Map<string, boolean> = new Map();

	register(task: Task) {
		this.tasks.push(task);
		console.log(`[Scheduler] Registered task: ${task.name} (interval: ${task.interval}ms)`);
	}

	start() {
		if (this.isRunning) {
			console.warn("[Scheduler] Already running");
			return;
		}

		this.isRunning = true;
		console.log(`[Scheduler] Starting ${this.tasks.length} task(s)...`);

		for (const task of this.tasks) {
			if (task.runOnStart !== false) {
				this.runTask(task);
			}

			const timer = setInterval(() => {
				this.runTask(task);
			}, task.interval);

			this.intervals.set(task.name, timer);
		}

		console.log("[Scheduler] All tasks started");
	}

	stop() {
		if (!this.isRunning) {
			return;
		}

		console.log("[Scheduler] Stopping all tasks...");

		for (const [name, timer] of this.intervals.entries()) {
			clearInterval(timer);
			console.log(`[Scheduler] Stopped task: ${name}`);
		}

		this.intervals.clear();
		this.isRunning = false;
		console.log("[Scheduler] All tasks stopped");
	}

	private async runTask(task: Task) {
		if (this.taskRunning.get(task.name)) {
			console.log(`[Scheduler] Skipping ${task.name} - still running from previous execution`);
			return;
		}

		this.taskRunning.set(task.name, true);
		const startTime = Date.now();
		console.log(`[Scheduler] Running task: ${task.name}`);

		try {
			await task.handler();
			const duration = Date.now() - startTime;
			console.log(`[Scheduler] Task ${task.name} completed in ${duration}ms`);
		} catch (error) {
			console.error(`[Scheduler] Task ${task.name} failed:`, error);
		} finally {
			this.taskRunning.set(task.name, false);
		}
	}
}

export const scheduler = new TaskScheduler();

scheduler.register({
	name: "clean-expired-invites",
	interval: TimeIntervals.minutes(5),
	runOnStart: true,
	handler: async () => {
		const now = new Date().toISOString();

		const result = await db
			.delete(clubInvite)
			.where(lt(clubInvite.expiresAt, now))
			.returning({ id: clubInvite.id });

		if (result.length > 0) {
			console.log(`[clean-expired-invites] Deleted ${result.length} expired invite(s)`);
		} else {
			console.log("[clean-expired-invites] No expired invites to clean up");
		}
	},
});
