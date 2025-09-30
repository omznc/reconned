import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { routing } from "@/i18n/routing";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const VALID_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => {
	return VALID_EMAIL_REGEX.test(email);
};

export function generateHreflangAlternates(pathname: string, _currentLocale: string) {
	const alternates: Record<string, string> = {};

	// Add all supported locales
	routing.locales.forEach((locale) => {
		const localePath = locale === routing.defaultLocale ? pathname : `/${locale}${pathname}`;
		alternates[`${locale}`] = localePath;
	});

	// Add x-default (fallback to default locale)
	alternates["x-default"] = pathname;

	return alternates;
}

/**
 * Generates hreflang alternates for entities that can have custom slugs.
 * @param canonicalPathname - The canonical pathname (using slug if available, ID otherwise)
 * @param entityId - The entity ID (used for alternate language URLs)
 * @param currentLocale - Current locale
 */
export function generateHreflangAlternatesForSluggableEntity(
	canonicalPathname: string,
	entityId: string,
	_currentLocale: string,
) {
	const alternates: Record<string, string> = {};

	// Add all supported locales using ID paths for alternates
	routing.locales.forEach((locale) => {
		const localePath =
			locale === routing.defaultLocale
				? canonicalPathname
				: `/${locale}${canonicalPathname.replace(/\/[^/]+$/, `/${entityId}`)}`;
		alternates[`${locale}`] = localePath;
	});

	// Add x-default (fallback to default locale)
	alternates["x-default"] = canonicalPathname;

	return alternates;
}
