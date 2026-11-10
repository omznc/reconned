import { lt } from "drizzle-orm";
import { clubInvite } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";
import { purgeExpiredSessions, purgeExpiredVerifications, stripAgedAuditLogIdentifiers } from "./retention";

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
				task_name: task.name,
				interval_ms: task.interval.toString(),
				run_on_start: String(task.runOnStart !== false),
				business: {
					operation: "register_task",
					domain: "scheduler",
				},
			},
		});
	}

	start() {
		if (this.isRunning) {
			logger.emit({
				severityText: "warn",
				body: "Scheduler already running",
				attributes: {
					business: {
						operation: "start_scheduler",
						domain: "scheduler",
						status: "already_running",
					},
				},
			});
			return;
		}

		this.isRunning = true;
		logger.emit({
			severityText: "info",
			body: "Scheduler starting",
			attributes: {
				task_count: this.tasks.length.toString(),
				business: {
					operation: "start_scheduler",
					domain: "scheduler",
				},
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
			attributes: {
				scheduled_task_count: this.intervals.size.toString(),
				business: {
					operation: "start_scheduler",
					domain: "scheduler",
				},
			},
		});
	}

	stop() {
		if (!this.isRunning) {
			return;
		}

		logger.emit({
			severityText: "info",
			body: "Stopping all tasks",
			attributes: {
				task_count: this.intervals.size.toString(),
				business: {
					operation: "stop_scheduler",
					domain: "scheduler",
				},
			},
		});

		for (const [name, timer] of this.intervals.entries()) {
			clearInterval(timer);
			logger.emit({
				severityText: "info",
				body: "Task stopped",
				attributes: {
					task_name: name,
					business: {
						operation: "stop_task",
						domain: "scheduler",
					},
				},
			});
		}

		this.intervals.clear();
		this.isRunning = false;
		logger.emit({
			severityText: "info",
			body: "All tasks stopped",
			attributes: {
				business: {
					operation: "stop_scheduler",
					domain: "scheduler",
				},
			},
		});
	}

	private async runTask(task: Task) {
		if (this.taskRunning.get(task.name)) {
			logger.emit({
				severityText: "info",
				body: "Skipping task - still running",
				attributes: {
					task_name: task.name,
					business: {
						operation: "skip_task",
						domain: "scheduler",
						reason: "already_running",
					},
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
				task_name: task.name,
				interval_ms: task.interval.toString(),
				business: {
					operation: "run_task",
					domain: "scheduler",
				},
			},
		});

		try {
			await task.handler();
			const duration = Date.now() - startTime;
			logger.emit({
				severityText: "info",
				body: "Task completed",
				attributes: {
					task_name: task.name,
					duration_ms: duration.toString(),
					business: {
						operation: "run_task",
						domain: "scheduler",
						outcome: "success",
					},
				},
			});
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Task failed",
				attributes: {
					task_name: task.name,
					error: error instanceof Error ? error.message : String(error),
					error_type: error instanceof Error ? error.name : "Unknown",
					business: {
						operation: "run_task",
						domain: "scheduler",
						outcome: "error",
					},
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
				deleted_count: result.length.toString(),
				cutoff_date: now,
				business: {
					operation: "cleanup_expired_records",
					domain: "maintenance",
					table: "club_invites",
				},
			},
		});
	},
});

/*
 * Retention enforcement — Art. 7(1)(e). Periods and rationale live in `./retention`; this file
 * only sets cadence. Daily because the periods are measured in weeks, and the tasks are
 * idempotent, so a missed run is caught by the next.
 */

scheduler.register({
	name: "purge-expired-sessions",
	interval: TimeIntervals.DAY,
	runOnStart: true,
	handler: async () => {
		const { deleted, cutoffDate } = await purgeExpiredSessions();

		logger.emit({
			severityText: "info",
			body: "Expired session purge completed",
			attributes: {
				deleted_count: deleted.toString(),
				cutoff_date: cutoffDate,
				business: {
					operation: "enforce_retention",
					domain: "privacy",
					table: "sessions",
				},
			},
		});
	},
});

scheduler.register({
	name: "purge-expired-verifications",
	interval: TimeIntervals.DAY,
	runOnStart: true,
	handler: async () => {
		const { deleted, cutoffDate } = await purgeExpiredVerifications();

		logger.emit({
			severityText: "info",
			body: "Expired verification purge completed",
			attributes: {
				deleted_count: deleted.toString(),
				cutoff_date: cutoffDate,
				business: {
					operation: "enforce_retention",
					domain: "privacy",
					table: "verifications",
				},
			},
		});
	},
});

scheduler.register({
	name: "strip-aged-audit-log-identifiers",
	interval: TimeIntervals.DAY,
	runOnStart: true,
	handler: async () => {
		const { updated, cutoffDate } = await stripAgedAuditLogIdentifiers();

		logger.emit({
			severityText: "info",
			body: "Aged audit log identifier strip completed",
			attributes: {
				updated_count: updated.toString(),
				cutoff_date: cutoffDate,
				business: {
					operation: "enforce_retention",
					domain: "privacy",
					table: "club_audit_logs",
				},
			},
		});
	},
});
