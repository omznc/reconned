"use client";

import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { useIsAuthenticated } from "@/lib/auth-client";
import { CONSENT_CHANGED_EVENT, isAnalyticsEnabled } from "@/lib/consent";

export default function PosthogIdentify() {
	const { user, loading } = useIsAuthenticated();
	const previousUserIdRef = useRef<string | null>(null);
	const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

	// Consent can be given after this component has mounted — the banner and the
	// footer's cookie settings both act in the same tab. Tracking it as state is
	// what makes the identify effect below re-run when it flips, instead of
	// leaving a signed-in user anonymous until their next navigation.
	useEffect(() => {
		const sync = () => setAnalyticsEnabled(isAnalyticsEnabled());

		sync();
		window.addEventListener(CONSENT_CHANGED_EVENT, sync);
		return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
	}, []);

	useEffect(() => {
		// Without consent PostHog was never initialised, so there is nobody to identify to.
		if (loading || !analyticsEnabled) {
			return;
		}

		const alreadyIdentifiedId = posthog.get_distinct_id();

		if (user && alreadyIdentifiedId !== user.id) {
			// Track login event
			if (previousUserIdRef.current !== user.id) {
				// Non-identifying preferences only — the user ID is all analytics needs.
				posthog.identify(user.id, {
					language: user.language || "bs",
					theme: user.theme || "dark",
					font: user.font || "mono",
				});
				posthog.alias(user.id, alreadyIdentifiedId);

				posthog.capture("user_login", {
					user_id: user.id,
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
	}, [user, loading, analyticsEnabled]);

	return null;
}
