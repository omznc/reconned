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
        const localePath = locale === routing.defaultLocale ? pathname : `/${locale}${pathname}`;
        languages[locale] = `${baseUrl}${localePath}`;
    });

    // Add x-default (fallback to default locale)
    languages["x-default"] = `${baseUrl}${pathname}`;

    return languages;
}

/**
 * Generates canonical URL without locale prefix for SEO
 * @param baseUrl - The base URL
 * @param pathname - The pathname (without locale prefix)
 * @param currentLocale - Current locale
 */
export function generateCanonicalUrl(baseUrl: string, pathname: string, _currentLocale: string) {
    // Always return the non-locale version for canonical URLs
    // This prevents duplicate content issues in search engines
    return `${baseUrl}${pathname}`;
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

/**
 * Generates canonical URL for sluggable entities without locale prefix
 * @param baseUrl - The base URL
 * @param canonicalPathname - The canonical pathname (using slug if available, ID otherwise)
 * @param currentLocale - Current locale
 */
export function generateCanonicalUrlForEntity(baseUrl: string, canonicalPathname: string, _currentLocale: string) {
    // Always return the non-locale version for canonical URLs
    return `${baseUrl}${canonicalPathname}`;
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
