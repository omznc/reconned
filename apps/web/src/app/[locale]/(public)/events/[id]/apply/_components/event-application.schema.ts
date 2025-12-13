import { z } from "zod";

export const eventApplicationSchema = z.object({
	eventId: z.string().min(1, { message: "ID susreta je obavezan" }),
	type: z.enum(["solo", "team"], {
		message: "Tip prijave je obavezan",
	}),
	invitedUsers: z.array(
		z.object({
			id: z.string().optional(),
			email: z.string().email(),
			name: z.string().min(1),
			callsign: z.string().nullable().optional(),
			image: z.string().nullable().optional(),
		}),
	),
	invitedUsersNotOnApp: z.array(
		z.object({
			id: z.string().optional(),
			email: z.string().email(),
			name: z.string().min(1),
		}),
	),
	paymentMethod: z.enum(["cash", "bank"], {
		message: "Način plaćanja je obavezan",
	}),
	rulesAccepted: z.boolean().refine((val) => val === true, {
		message: "Morate prihvatiti pravila susreta",
	}),
});

export type EventApplicationSchemaType = z.infer<typeof eventApplicationSchema>;
