import { lt } from "drizzle-orm";
import * as z from "zod";
import { clubInvite } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { apiError } from "../../lib/errors";
import { Router } from "../../lib/router";

export const adminTasksRouter = new Router();

adminTasksRouter.get(
	"/admin/tasks",
	async ({ response }) => {
		const tasks = [
			{
				name: "clean-expired-invites",
				description: "Delete club invites that have passed their expiration date",
				interval: "5 minutes",
			},
		];

		return response.json({ tasks });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "List background tasks",
			description: "Admin endpoint to list all background tasks",
			response: {
				200: z.object({
					tasks: z.array(
						z.object({
							name: z.string(),
							description: z.string(),
							interval: z.string(),
						}),
					),
				}),
			},
		},
	},
);

adminTasksRouter.post(
	"/admin/tasks/:taskName/run",
	async ({ params, response }) => {
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
				success: result.success,
				message: result.message,
				duration: `${duration}ms`,
				data: result.data as { deletedCount?: number } | undefined,
			});
		} catch (error) {
			console.error(`[Admin] Task ${taskName} failed:`, error);
			throw apiError.internal(
				`Task execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Run background task",
			description: "Admin endpoint to manually trigger a background task",
			params: z.object({
				taskName: z.string(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					message: z.string(),
					duration: z.string().optional(),
					data: z
						.object({
							deletedCount: z.number().optional(),
						})
						.optional(),
				}),
			},
		},
	},
);
