"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { authClient, useIsAuthenticated } from "@/lib/auth-client";

/**
 * Shows the Google One Tap prompt to signed-out visitors. Rendered only in the
 * public layout so authenticated areas and the sign-in pages stay untouched.
 */
export function GoogleOneTap() {
	const { user, loading } = useIsAuthenticated();
	const router = useRouter();
	const prompted = useRef(false);

	useEffect(() => {
		if (loading || user || prompted.current) {
			return;
		}
		prompted.current = true;

		authClient
			.oneTap({
				fetchOptions: {
					onSuccess: () => {
						router.refresh();
					},
				},
			})
			.catch(() => {
				// Prompt suppressed (cooldown, dismissed, unsupported browser) — nothing to do.
			});
	}, [loading, user, router]);

	return null;
}
