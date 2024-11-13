import { z } from "zod";

export const teamMemberSchema = z.object({
	fullName: z.string().min(1, "Full name is required"),
});

export const eventApplicationSchema = z.object({
	applicationType: z.enum(["solo", "team"]),
	teamMembers: z
		.array(teamMemberSchema)
		.refine(
			(members) => {
				return members.length >= 1;
			},
			{ message: "Tim mora imati barem jednog člana" },
		)
		.optional(),
	rulesAccepted: z.boolean().refine((val) => val === true, {
		message: "You must accept the rules to continue",
	}),
	paymentMethod: z.enum(["cash", "bank"]),
});

export type EventApplicationForm = z.infer<typeof eventApplicationSchema>;
