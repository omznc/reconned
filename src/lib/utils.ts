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

export function generateHreflangLanguages(baseUrl: string, pathname: string, _currentLocale: string) {
	const languages: Record<string, string> = {};

	// Add all supported locales
	routing.locales.forEach((locale) => {
		const localePath = locale === routing.defaultLocale ? pathname : `/${locale}${pathname}`;
		languages[locale] = `${baseUrl}${localePath}`;
	});

	// Add x-default (fallback to default locale)
	languages["x-default"] = `${baseUrl}${pathname}`;

	return languages;
}

/**
 * Generates hreflang languages object for pages
 * @param baseUrl - The base URL
 * @param pathname - The pathname (without locale prefix)
 * @param currentLocale - Current locale (used for canonical URL)
 */
export function generatePageLanguages(baseUrl: string, pathname: string, _currentLocale: string) {
	const languages: Record<string, string> = {};

	// Add all supported locales
	routing.locales.forEach((locale) => {
		// For default locale (bs), we don't add the prefix because of localePrefix: 'as-needed'
		const localePath = locale === routing.defaultLocale ? pathname : `/${locale}${pathname}`;
		// Ensure we don't have double slashes if pathname is just "/"
		const cleanPath = localePath === "/" ? "" : localePath;
		languages[locale] = `${baseUrl}${cleanPath}`;
	});

	// Add x-default (fallback to default locale)
	languages["x-default"] = `${baseUrl}${pathname === "/" ? "" : pathname}`;

	return languages;
}

/**
 * Constructs a canonical URL for a page
 * @param baseUrl - The base URL
 * @param pathname - The pathname (without locale prefix)
 * @param locale - The current locale
 */
export function constructCanonicalUrl(baseUrl: string, pathname: string, locale: string) {
	// For default locale (bs), we don't add the prefix because of localePrefix: 'as-needed'
	const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
	const path = pathname === "/" ? "" : pathname;
	return `${baseUrl}${localePrefix}${path}`;
}

/**
 * Generates hreflang alternates for entities that can have custom slugs.
 * @param baseUrl - The base URL
 * @param pathPrefix - The path prefix (e.g., "/clubs")
 * @param entityId - The entity ID (used for alternate language URLs)
 * @param currentLocale - Current locale
 * @param currentSlug - Current entity slug (optional, used for current locale URL)
 */
export function generateHreflangAlternatesForSluggableEntity(
	baseUrl: string,
	pathPrefix: string,
	entityId: string,
	currentLocale: string,
	currentSlug?: string,
) {
	const alternates: Record<string, string> = {};
	const slugOrId = currentSlug || entityId;

	// Add all supported locales
	routing.locales.forEach((locale) => {
		// If it's the current locale, we use the slug (if available).
		// For other locales, we fallback to ID to ensure the link works
		const idToUse = locale === currentLocale ? slugOrId : entityId;
		alternates[locale] = constructCanonicalUrl(baseUrl, `${pathPrefix}/${idToUse}`, locale);
	});

	// Add x-default (fallback to default locale)
	// If default locale is current locale, use slug. Otherwise use ID.
	const defaultLocaleId = routing.defaultLocale === currentLocale ? slugOrId : entityId;
	alternates["x-default"] = constructCanonicalUrl(baseUrl, `${pathPrefix}/${defaultLocaleId}`, routing.defaultLocale);

	return alternates;
}

/**
 * Adds or updates a version parameter to an image URL.
 * Removes any existing v? parameters first to prevent stacking.
 * @param imageUrl - The image URL to modify
 * @param version - The version string to use (defaults to current timestamp)
 */
export function addImageVersion(imageUrl: string, version?: string): string {
	if (!imageUrl) return imageUrl;

	// Remove existing v? parameter and anything after it
	const urlWithoutVersion = imageUrl.replace(/[?&]v=[^&]*/, "");

	// Add new version parameter
	const versionParam = version || Date.now().toString();
	const separator = urlWithoutVersion.includes("?") ? "&" : "?";

	return `${urlWithoutVersion}${separator}v=${versionParam}`;
}
