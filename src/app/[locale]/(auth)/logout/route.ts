import { auth } from "@auth/server";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

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
