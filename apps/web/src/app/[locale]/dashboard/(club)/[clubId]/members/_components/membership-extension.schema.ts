import * as z from "zod";

export const membershipExtensionSchema = z.object({
	clubId: z.string().min(1),
	memberId: z.string().min(1),
	duration: z.enum(["1", "3", "6", "12"], {
		error: "Please select a duration",
	}),
});

export type MembershipExtensionFormValues = z.infer<typeof membershipExtensionSchema>;
