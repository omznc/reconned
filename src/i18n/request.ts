import { isAuthenticated } from "@/lib/auth";
import { getRequestConfig } from "next-intl/server";

export const VALID_LOCALES = ["bs", "en"];

export default getRequestConfig(async () => {
	const user = await isAuthenticated();
	const locale = VALID_LOCALES.includes(user?.language ?? "")
		? user?.language
		: "bs";

	return {
		locale: locale ?? "bs",
		messages: (await import(`../messages/${locale}.json`)).default,
	};
});
