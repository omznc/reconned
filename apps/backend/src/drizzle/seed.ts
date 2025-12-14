import { sql } from "drizzle-orm";
import { getNames, registerLocale } from "i18n-iso-countries";
import bsLocale from "i18n-iso-countries/langs/bs.json";
import srLocale from "i18n-iso-countries/langs/sr.json";
import countries from "world-countries";
import { country } from "../drizzle/schema";
import { db } from "../lib/db";

const LOCALES = ["en", "bs", "sr"] as const;

registerLocale(bsLocale);
registerLocale(srLocale);

async function main() {
	const now = new Date().toISOString();

	const i18nTranslations: Record<string, Record<string, string>> = {};
	for (const locale of LOCALES) {
		const names = getNames(locale, { select: "official" });
		if (names) {
			i18nTranslations[locale] = names;
		}
	}

	const countryValues = countries.map((countryData) => {
		const translations: Record<string, string> = {};
		for (const locale of LOCALES) {
			const translation = i18nTranslations[locale]?.[countryData.cca2];
			if (translation) {
				translations[locale] = translation;
			}
		}

		return {
			name: countryData.name.common,
			iso3: countryData.cca3,
			iso2: countryData.cca2,
			latitude: countryData.latlng?.[0] ? String(countryData.latlng[0]) : null,
			longitude: countryData.latlng?.[1] ? String(countryData.latlng[1]) : null,
			emoji: countryData.flag || null,
			translations: Object.keys(translations).length > 0 ? translations : null,
			updatedAt: now,
		};
	});

	await db
		.insert(country)
		.values(countryValues)
		.onConflictDoUpdate({
			target: country.iso2,
			set: {
				name: sql`excluded.name`,
				iso3: sql`excluded.iso3`,
				latitude: sql`excluded.latitude`,
				longitude: sql`excluded.longitude`,
				emoji: sql`excluded.emoji`,
				translations: sql`excluded.translations`,
				updatedAt: sql`excluded."updatedAt"`,
			},
		});
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
