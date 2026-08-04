"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { useIsAuthenticated } from "@/lib/auth-client";

export default function PosthogIdentify() {
	const { user, loading } = useIsAuthenticated();
	const previousUserIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (loading) {
			return;
		}

		const alreadyIdentifiedId = posthog.get_distinct_id();

		if (user && alreadyIdentifiedId !== user.id) {
			// Track login event
			if (previousUserIdRef.current !== user.id) {
				posthog.identify(user.id, {
					email: user.email,
					name: user.name,
					language: user.language || "bs",
					theme: user.theme || "dark",
					font: user.font || "mono",
				});
				posthog.alias(user.id, alreadyIdentifiedId);

				posthog.capture("user_login", {
					user_id: user.id,
					email: user.email,
					name: user.name,
					language: user.language || "bs",
					theme: user.theme || "dark",
					font: user.font || "mono",
				});

				previousUserIdRef.current = user.id;
			}
		} else if (!user && previousUserIdRef.current) {
			// Track logout event
			posthog.capture("user_logout", {
				user_id: previousUserIdRef.current,
			});
			previousUserIdRef.current = null;
		}

		if (alreadyIdentifiedId) {
			return;
		}

		posthog.identify();
	}, [user, loading]);

	return null;
}
