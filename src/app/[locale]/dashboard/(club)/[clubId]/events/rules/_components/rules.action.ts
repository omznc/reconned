"use server";

import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { deleteRuleSchema, ruleSchema } from "./rules.schema";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logClubAudit } from "@/lib/audit-logger";

export const saveRule = safeActionClient.schema(ruleSchema).action(async ({ parsedInput, ctx }) => {
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

		revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/events/rules`);

		await logClubAudit({
			clubId: ctx.club.id,
			actionType: parsedInput.id ? "CLUB_RULE_UPDATE" : "CLUB_RULE_CREATE",
			actionData: {
				ruleId: rule.id,
				ruleName: rule.name,
				ruleDescription: rule.description,
			},
		});

		return { success: true, rule };
	} catch (error) {
		throw new Error("Failed to save rule");
	}
});

export const deleteRule = safeActionClient.schema(deleteRuleSchema).action(async ({ parsedInput, ctx }) => {
	await prisma.clubRule.delete({
		where: {
			id: parsedInput.ruleId,
			clubId: ctx.club.id,
		},
	});

	await logClubAudit({
		clubId: ctx.club.id,
		actionType: "CLUB_RULE_DELETE",
		actionData: {
			ruleId: parsedInput.ruleId,
		},
	});

	revalidateLocalizedPaths(`/dashboard/${ctx.club.id}/events/rules`);
	return { success: true };
});
