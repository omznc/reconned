"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { useIsAuthenticated } from "@/lib/auth-client";

export default function PosthogIdentify() {
	const { user, loading } = useIsAuthenticated();

	useEffect(() => {
		if (loading) {
			return;
		}

		const alreadyIdentifiedId = posthog.get_distinct_id();

		if (user && alreadyIdentifiedId !== user.id) {
			posthog.identify(user.id, {
				email: user.email,
				name: user.name,
			});
			posthog.alias(user.id, alreadyIdentifiedId);
		}

		if (alreadyIdentifiedId) {
			return;
		}

		posthog.identify();
	}, [user, loading]);

	return null;
}
