import { lt } from "drizzle-orm";
import { clubInvite } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";

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
		logger.emit({
			severityText: "info",
			body: "Task registered",
			attributes: {
				taskName: task.name,
				interval: task.interval.toString(),
			},
		});
	}

	start() {
		if (this.isRunning) {
			logger.emit({
				severityText: "warn",
				body: "Scheduler already running",
			});
			return;
		}

		this.isRunning = true;
		logger.emit({
			severityText: "info",
			body: "Scheduler starting",
			attributes: {
				taskCount: this.tasks.length.toString(),
			},
		});

		for (const task of this.tasks) {
			if (task.runOnStart !== false) {
				this.runTask(task);
			}

			const timer = setInterval(() => {
				this.runTask(task);
			}, task.interval);

			this.intervals.set(task.name, timer);
		}

		logger.emit({
			severityText: "info",
			body: "All tasks started",
		});
	}

	stop() {
		if (!this.isRunning) {
			return;
		}

		logger.emit({
			severityText: "info",
			body: "Stopping all tasks",
		});

		for (const [name, timer] of this.intervals.entries()) {
			clearInterval(timer);
			logger.emit({
				severityText: "info",
				body: "Task stopped",
				attributes: {
					taskName: name,
				},
			});
		}

		this.intervals.clear();
		this.isRunning = false;
		logger.emit({
			severityText: "info",
			body: "All tasks stopped",
		});
	}

	private async runTask(task: Task) {
		if (this.taskRunning.get(task.name)) {
			logger.emit({
				severityText: "info",
				body: "Skipping task - still running",
				attributes: {
					taskName: task.name,
				},
			});
			return;
		}

		this.taskRunning.set(task.name, true);
		const startTime = Date.now();
		logger.emit({
			severityText: "info",
			body: "Running task",
			attributes: {
				taskName: task.name,
			},
		});

		try {
			await task.handler();
			const duration = Date.now() - startTime;
			logger.emit({
				severityText: "info",
				body: "Task completed",
				attributes: {
					taskName: task.name,
					duration: duration.toString(),
				},
			});
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Task failed",
				attributes: {
					taskName: task.name,
					error: error instanceof Error ? error.message : String(error),
				},
			});
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

		logger.emit({
			severityText: "info",
			body: "Clean expired invites completed",
			attributes: {
				deletedCount: result.length.toString(),
			},
		});
	},
});
