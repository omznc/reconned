"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteRuleSchema, ruleSchema } from "./rules.schema";
import { revalidatePath } from "next/cache";

export const saveRule = safeActionClient
	.schema(ruleSchema)
	.action(async ({ parsedInput, ctx }) => {
		try {
			const rule = parsedInput.id
				? await prisma.clubRule.update({
						where: {
							id: parsedInput.id,
							clubId: ctx.club.id,
						},
						data: {
							name: parsedInput.name,
							description: parsedInput.description,
							content: parsedInput.content,
						},
					})
				: await prisma.clubRule.create({
						data: {
							name: parsedInput.name,
							description: parsedInput.description,
							content: parsedInput.content,
							clubId: ctx.club.id,
						},
					});

			revalidatePath(`/dashboard/${ctx.club.id}/events/rules`);
			return { success: true, rule };
		} catch (error) {
			console.error("Failed to save rule:", error);
			throw new Error("Failed to save rule");
		}
	});

export const deleteRule = safeActionClient
	.schema(deleteRuleSchema)
	.action(async ({ parsedInput, ctx }) => {
		await prisma.clubRule.delete({
			where: {
				id: parsedInput.ruleId,
				clubId: ctx.club.id,
			},
		});

		revalidatePath(`/dashboard/${ctx.club.id}/events/rules`);
		return { success: true };
	});
