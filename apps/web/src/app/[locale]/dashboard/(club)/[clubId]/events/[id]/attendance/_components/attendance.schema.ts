import { z } from "zod";

export const toggleAttendanceSchema = z.object({
	registrationId: z.string(),
	eventId: z.string(),
	attended: z.boolean(),
	clubId: z.string(),
});
