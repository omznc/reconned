import { z } from "zod";

export const userSchema = z.object({
	fullName: z.string().min(1, "Ime je obavezno"),
	userId: z.string().optional(),
	email: z.string().email().optional(),
	image: z.string().nullable().optional(),
	callsign: z.string().nullable().optional(),
	clubMembership: z
		.array(
			z.object({
				club: z.object({
					name: z.string(),
				}),
			}),
		)
		.optional(),
});

export const eventApplicationSchema = z.object({
	applicationType: z.enum(["solo", "team"]),
	teamMembers: z.array(userSchema).refine(
		(members) => {
			if (members.length === 0) {
				return true; // Solo application
			}
			return members.length >= 2; // Team requires at least 2 members
		},
		{
			message: "Tim mora imati najmanje 2 člana",
		},
	),
	rulesAccepted: z.boolean().refine((val) => val === true, {
		message: "Morate prihvatiti pravila susreta",
	}),
	paymentMethod: z.enum(["cash", "bank"]),
});

export type EventApplicationSchemaType = z.infer<typeof eventApplicationSchema>;
