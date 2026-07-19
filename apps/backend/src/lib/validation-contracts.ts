import * as z from "zod";

/**
 * Validation rules shared between the backend and the web app.
 *
 * This module imports nothing but zod. That is deliberate: `apps/web` consumes it through the
 * `backend/*` path alias, so anything imported here lands in the web bundle. The neighbouring
 * `./schemas.ts` pulls in drizzle-zod and the entire database schema, which is why these rules
 * live in their own leaf module rather than there.
 *
 * The web app needs the same rules with *translated* messages, so the logic is exposed as a
 * factory rather than a fixed schema. Both apps therefore validate identically and a rule can
 * only change in one place — previously this block existed once in the backend and three more
 * times in `apps/web/src/lib/validations/schemas.ts`, free to drift.
 */

// Domain names with at least one dot, so a bare host like "localhost" is rejected.
// Allows alphanumerics and hyphens per label, and requires an alphabetic TLD of 2+ characters.
const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const WEBSITE_URL_MAX_LENGTH = 150;

/**
 * Upgrade a bare host to an https:// URL, leaving anything that already carries a protocol alone.
 *
 * A value that already specifies a protocol is returned untouched rather than rewritten, so
 * `http://example.com` stays http and is then rejected by {@link isHttpsUrl}. Silently promoting
 * it to https would mean accepting input the user did not ask for.
 */
export function normalizeWebsiteUrl(value: string): string {
	if (value === "") {
		return "";
	}

	const trimmed = value.trim();

	if (!trimmed.includes("://")) {
		return `https://${trimmed}`;
	}

	return trimmed;
}

/** Whether a *normalized* value is an https URL with a real domain. Empty is allowed. */
export function isHttpsUrl(value: string): boolean {
	if (value === "") {
		return true;
	}

	if (!value.startsWith("https://")) {
		return false;
	}

	try {
		const url = new URL(value);

		// `startsWith` above is not sufficient on its own: the URL parser normalizes some inputs,
		// so re-check the parsed protocol rather than trusting the raw string.
		if (url.protocol !== "https:") {
			return false;
		}

		return DOMAIN_REGEX.test(url.hostname);
	} catch {
		return false;
	}
}

export interface HttpsUrlMessages {
	tooLong: string;
	containsSpaces: string;
	invalid: string;
}

/** Default, untranslated messages — used by the backend, whose responses are not localized. */
export const DEFAULT_HTTPS_URL_MESSAGES: HttpsUrlMessages = {
	tooLong: "Website URL must be shorter than 150 characters",
	containsSpaces: "Website URL cannot contain spaces",
	invalid: "Website must be a valid HTTPS URL with a proper domain (e.g., example.com)",
};

/**
 * Build the website-URL schema with caller-supplied messages.
 *
 * Note the order: the value is normalized *before* the https check, so a user may type
 * `example.com` and have it accepted, while `ftp://example.com` is not silently rewritten.
 */
export function createHttpsUrlSchema(messages: HttpsUrlMessages = DEFAULT_HTTPS_URL_MESSAGES) {
	return z
		.string()
		.max(WEBSITE_URL_MAX_LENGTH, messages.tooLong)
		.refine((val) => val === "" || !val.includes(" "), {
			message: messages.containsSpaces,
		})
		.transform(normalizeWebsiteUrl)
		.refine(isHttpsUrl, {
			message: messages.invalid,
		});
}

/** The backend's website-URL schema. Empty strings pass, so pair with `.optional()` where needed. */
export const httpsUrl = createHttpsUrlSchema();
