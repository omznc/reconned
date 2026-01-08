import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import * as z from "zod";

// Regex to validate domain names with at least one dot (TLD required)
// Allows alphanumeric, hyphens, and dots. Must have at least one dot for TLD
const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

// Server function to get HTTPS URL schema with translations
export async function getHttpsUrlSchema() {
	const t = await getExtracted();

	return z
		.string()
		.max(150, t("Website URL must be shorter than 150 characters"))
		.refine((val) => val === "" || !val.includes(" "), {
			message: t("Website URL cannot contain spaces"),
		})
		.transform((val) => {
			// Allow empty strings
			if (val === "") return "";

			const trimmedVal = val.trim();

			// If it doesn't start with any protocol, add https://
			if (!trimmedVal.includes("://")) {
				return `https://${trimmedVal}`;
			}

			return trimmedVal;
		})
		.refine(
			(val) => {
				// Allow empty strings
				if (val === "") return true;

				// Must start with https:// - no other protocols allowed
				if (!val.startsWith("https://")) {
					return false;
				}

				// Extract domain from URL
				try {
					const url = new URL(val);

					// Double-check protocol is https
					if (url.protocol !== "https:") {
						return false;
					}

					// Get hostname and validate it has a proper TLD
					const hostname = url.hostname;

					// Must have at least one dot (domain.tld format)
					if (!DOMAIN_REGEX.test(hostname)) {
						return false;
					}

					return true;
				} catch {
					return false;
				}
			},
			{
				message: t("Website must be a valid HTTPS URL with a proper domain (e.g., example.com)"),
			},
		);
}

// Hook to get HTTPS URL schema with translations for client components
export function useHttpsUrlSchema() {
	const t = useExtracted();

	return z
		.string()
		.max(150, t("Website URL must be shorter than 150 characters"))
		.refine((val) => val === "" || !val.includes(" "), {
			message: t("Website URL cannot contain spaces"),
		})
		.transform((val) => {
			// Allow empty strings
			if (val === "") return "";

			const trimmedVal = val.trim();

			// If it doesn't start with any protocol, add https://
			if (!trimmedVal.includes("://")) {
				return `https://${trimmedVal}`;
			}

			return trimmedVal;
		})
		.refine(
			(val) => {
				// Allow empty strings
				if (val === "") return true;

				// Must start with https:// - no other protocols allowed
				if (!val.startsWith("https://")) {
					return false;
				}

				// Extract domain from URL
				try {
					const url = new URL(val);

					// Double-check protocol is https
					if (url.protocol !== "https:") {
						return false;
					}

					// Get hostname and validate it has a proper TLD
					const hostname = url.hostname;

					// Must have at least one dot (domain.tld format)
					if (!DOMAIN_REGEX.test(hostname)) {
						return false;
					}

					return true;
				} catch {
					return false;
				}
			},
			{
				message: t("Website must be a valid HTTPS URL with a proper domain (e.g., example.com)"),
			},
		);
}

// Export base schema for backend use (no translations needed)
export const httpsUrl = z
	.string()
	.max(150, "Website URL must be shorter than 150 characters")
	.refine((val) => val === "" || !val.includes(" "), {
		message: "Website URL cannot contain spaces",
	})
	.transform((val) => {
		if (val === "") return "";
		const trimmedVal = val.trim();
		if (!trimmedVal.includes("://")) {
			return `https://${trimmedVal}`;
		}
		return trimmedVal;
	})
	.refine(
		(val) => {
			if (val === "") return true;
			if (!val.startsWith("https://")) {
				return false;
			}
			try {
				const url = new URL(val);
				if (url.protocol !== "https:") {
					return false;
				}
				const hostname = url.hostname;
				if (!DOMAIN_REGEX.test(hostname)) {
					return false;
				}
				return true;
			} catch {
				return false;
			}
		},
		{
			message: "Website must be a valid HTTPS URL with a proper domain (e.g., example.com)",
		},
	);
