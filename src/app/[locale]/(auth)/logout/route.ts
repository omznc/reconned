import { auth } from "@auth/server";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import posthog from "posthog-js";
import { redirect } from "@/i18n/navigation";

export async function GET() {
	const [, locale] = await Promise.all([
		auth.api.signOut({
			headers: await headers(),
		}),
		getLocale(),
		posthog.reset(),
	]);

	return redirect({
		href: `/${locale}/login`,
		locale,
	});
}
