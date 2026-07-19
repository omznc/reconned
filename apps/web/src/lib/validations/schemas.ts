import { createHttpsUrlSchema } from "backend/lib/validation-contracts";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";

/**
 * The validation rules themselves live in `backend/lib/validation-contracts` so the two apps
 * cannot disagree about what a valid website URL is. Only the messages differ here, because the
 * backend's responses are not localized and the forms' are.
 *
 * The `t("...")` calls are duplicated between the two variants on purpose: next-intl's message
 * extraction only recognizes literal calls on a `t` obtained in the same scope, so routing them
 * through a shared helper leaves the strings out of the catalogs (MISSING_MESSAGE at runtime).
 */

/** Server-component variant. */
export async function getHttpsUrlSchema() {
	const t = await getExtracted();

	return createHttpsUrlSchema({
		tooLong: t("Website URL must be shorter than 150 characters"),
		containsSpaces: t("Website URL cannot contain spaces"),
		invalid: t("Website must be a valid HTTPS URL with a proper domain (e.g., example.com)"),
	});
}

/** Client-component variant. */
export function useHttpsUrlSchema() {
	const t = useExtracted();

	return createHttpsUrlSchema({
		tooLong: t("Website URL must be shorter than 150 characters"),
		containsSpaces: t("Website URL cannot contain spaces"),
		invalid: t("Website must be a valid HTTPS URL with a proper domain (e.g., example.com)"),
	});
}
