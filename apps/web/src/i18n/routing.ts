export const routing = {
	locales: ["en", "bs", "sr"],
	defaultLocale: "bs",
	localePrefix: "as-needed",
} as const;

/** The platform serves Bosnia and Herzegovina; use-intl needs a zone to format dates without a warning. */
export const DEFAULT_TIME_ZONE = "Europe/Sarajevo";
