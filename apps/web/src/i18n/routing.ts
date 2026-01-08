import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
	locales: ["en", "bs", "sr"],
	defaultLocale: "bs",
	localePrefix: "as-needed",
});
