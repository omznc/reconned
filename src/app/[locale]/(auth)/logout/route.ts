import { auth } from "@auth/server";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export async function GET() {
	const [, locale] = await Promise.all([
		auth.api.signOut({
			headers: await headers(),
		}),
		getLocale(),
	]);

	return redirect({
		href: `/${locale}/login`,
		locale,
	});
}
