import { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

const loaders: Record<Locale, () => Promise<{ default: Record<string, string> }>> = {
	en: () => import("../../messages/en.json"),
	bs: () => import("../../messages/bs.json"),
	sr: () => import("../../messages/sr.json"),
};

export function isLocale(value: string | null | undefined): value is Locale {
	return routing.locales.some((locale) => locale === value);
}

export function toLocale(value: string | null | undefined): Locale {
	return isLocale(value) ? value : routing.defaultLocale;
}

export async function getMessages(locale: string) {
	return (await loaders[toLocale(locale)]()).default;
}

/** First path segment if it is a known locale, else the default locale (unprefixed = bs). */
export function getLocaleFromPathname(pathname: string): Locale {
	const first = pathname.split("/")[1];
	return isLocale(first) ? first : routing.defaultLocale;
}
