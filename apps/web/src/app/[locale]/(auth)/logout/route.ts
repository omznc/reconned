import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import posthog from "posthog-js";
import { redirect } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export async function GET() {
	const locale = await getLocale();
	const resp = await authClient.signOut({
		fetchOptions: {
			headers: await headers(),
		},
	});
	if (!resp.data) {
		return new Response("Failed to sign out", { status: 500 });
	}
	posthog.reset();

	return redirect({
		href: `/${locale}/login`,
		locale,
	});
}
