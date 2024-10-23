import { isAuthenticated } from "@/lib/auth";
import { createSafeActionClient } from "next-safe-action";

export const unsafeActionClient = createSafeActionClient();

export const safeActionClient = unsafeActionClient.use(async ({ next }) => {
	const user = await isAuthenticated();

	if (!user) {
		throw new Error("Session is not valid!");
	}

	// Return the next middleware with the user object in context.
	return next({ ctx: { user } });
});
