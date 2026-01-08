import { lt } from "drizzle-orm";
import { clubInvite } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { apiError } from "../../lib/errors";
import { Router } from "../../lib/router";

export const adminTasksRouter = new Router();

adminTasksRouter.get("/admin/tasks", async ({ response }) => {
	const tasks = [
		{
			name: "clean-expired-invites",
			description: "Delete club invites that have passed their expiration date",
			interval: "24 hours",
		},
	];

	return response.json({ tasks });
});

adminTasksRouter.post("/admin/tasks/:taskName/run", async ({ params, response }) => {
	const { taskName } = params;

	if (!taskName) {
		throw apiError.validation("Task name is required");
	}

	const startTime = Date.now();
	let result: { success: boolean; message: string; data?: unknown };

	try {
		switch (taskName) {
			case "clean-expired-invites": {
				const now = new Date().toISOString();
				const deleted = await db
					.delete(clubInvite)
					.where(lt(clubInvite.expiresAt, now))
					.returning({ id: clubInvite.id });

				result = {
					success: true,
					message: `Deleted ${deleted.length} expired invite(s)`,
					data: { deletedCount: deleted.length },
				};
				break;
			}

			default:
				throw apiError.notFound("Task");
		}

		const duration = Date.now() - startTime;
		console.log(`[Admin] Manually triggered task: ${taskName} (${duration}ms)`);

		return response.json({
			...result,
			duration: `${duration}ms`,
		});
	} catch (error) {
		console.error(`[Admin] Task ${taskName} failed:`, error);
		throw apiError.internal(`Task execution failed: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
});
