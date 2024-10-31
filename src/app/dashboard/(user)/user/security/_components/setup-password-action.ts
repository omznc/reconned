"use server";

import { setupPasswordSchema } from "@/app/dashboard/(user)/user/security/_components/setup-password-schema";
import { auth } from "@/lib/auth";
import { safeActionClient } from "@/lib/safe-action";
import { headers } from "next/headers";
import { z } from "zod";

export const setupPasswordAction = safeActionClient
	.schema(setupPasswordSchema)
	.action(async ({ parsedInput }) => {
		const headerStore = await headers();
		await auth.api.setPassword({
			headers: headerStore,
			body: { newPassword: parsedInput.password },
		});

		return {
			success: true,
		};
	});
