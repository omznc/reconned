// Chrome ships no Intl data for bs; sr-Latn-BA formats the same ijekavian Latin text.
export function toIntlLocale(locale: string): string {
	return locale === "bs" || locale.startsWith("bs-") ? "sr-Latn-BA" : locale;
}
