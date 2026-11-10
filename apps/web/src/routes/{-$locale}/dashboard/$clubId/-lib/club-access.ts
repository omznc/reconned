import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import apiServer from "@/lib/api/api";

/** The signed-in user's membership in one club. The backend enforces the real access rules. */
export const getClubAccessFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { data: membership } = await apiServer.GET("/api/clubs/{id}/membership", {
			params: { path: { id: data.clubId } },
		});
		return {
			role: membership?.membership?.role ?? null,
			isMember: membership?.isMember ?? false,
			membership: membership?.membership ?? null,
		};
	});
