"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { safeActionClient } from "@/lib/safe-action";
import { setupPasswordSchema } from "./password.schema.ts";

export const setupPasswordAction = safeActionClient.inputSchema(setupPasswordSchema).action(async ({ parsedInput }) => {
	const headerStore = await headers();
	await auth.api.setPassword({
		headers: headerStore,
		body: { newPassword: parsedInput.password },
	});

	return {
		success: true,
	};
});
