"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { ImpersonationAlert } from "@/components/impersonation-alert";
import { useFont } from "@/components/personalization/font/font-provider";
import { authClient } from "@/lib/auth-client";

/**
 * Applies the signed-in user's stored personalization preferences and renders
 * the impersonation banner.
 *
 * This used to live in `app/[locale]/layout.tsx`, which read the session with
 * `isAuthenticated()` on the server. That single call did an HTTP round-trip to
 * the backend on *every* render — including anonymous traffic to public/SEO
 * pages — and, because it reads `headers()`, it forced the entire route tree to
 * render dynamically, making the `revalidate` exports on the public pages dead
 * code.
 *
 * The session is read on the client instead, via the same `authClient.useSession()`
 * subscription that `PosthogIdentify` already uses on every page, so this adds no
 * additional network request.
 *
 * Precedence is unchanged: an explicit local choice (localStorage) still wins
 * over the account preference, which still wins over the built-in default. We
 * only fall back to the account preference when the visitor has never made a
 * local choice on this device.
 */
export function SessionPersonalization() {
	const { data: session } = authClient.useSession();
	const user = session?.user;
	const { font, setFont } = useFont();
	const { setTheme } = useTheme();

	const userFont = user?.font as "mono" | "sans" | null | undefined;
	const userTheme = user?.theme as "dark" | "light" | null | undefined;

	useEffect(() => {
		if (!userFont || window.localStorage.getItem("reconned-font")) {
			return;
		}
		if (userFont !== font) {
			setFont(userFont);
		}
	}, [userFont, font, setFont]);

	useEffect(() => {
		// `next-themes` persists under the `theme` key and applies it pre-hydration.
		if (!userTheme || window.localStorage.getItem("theme")) {
			return;
		}
		setTheme(userTheme);
	}, [userTheme, setTheme]);

	if (!session?.session?.impersonatedBy) {
		return null;
	}

	return <ImpersonationAlert />;
}
