import type { routing } from "./routing";

/**
 * `hr` maps to `bs` (mutually intelligible, and closer than English for
 * Croatian speakers) — next-intl's own matcher only knows the configured
 * locales, which is why this exists separately from it.
 */
const LANGUAGE_TO_LOCALE: Record<string, (typeof routing.locales)[number]> = {
	en: "en",
	bs: "bs",
	sr: "sr",
	hr: "bs",
};

/**
 * Returns the supported locale best matching the `Accept-Language` header, or
 * `null` when nothing matches. Matches on the primary language subtag only
 * (`en-US` → `en`), ordered by q-value.
 */
export function matchAcceptLanguage(header: string | null): (typeof routing.locales)[number] | null {
	if (!header) {
		return null;
	}
	const ranges = header
		.split(",")
		.map((part) => {
			const [tag = "", ...params] = part.trim().split(";");
			const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
			return { tag: tag.trim().toLowerCase(), quality: q ? Number.parseFloat(q.slice(2)) : 1 };
		})
		.filter((range) => range.tag && range.tag !== "*" && !Number.isNaN(range.quality) && range.quality > 0)
		.sort((a, b) => b.quality - a.quality);

	for (const { tag } of ranges) {
		const locale = LANGUAGE_TO_LOCALE[tag.split("-")[0] ?? ""];
		if (locale) {
			return locale;
		}
	}
	return null;
}
