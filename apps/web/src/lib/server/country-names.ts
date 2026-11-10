import apiServer from "@/lib/api/api";

type CountryTranslations = Partial<Record<string, string>>;

/** Country names by id in the given locale, with the English name when a translation is missing. */
export async function getCountryNames(locale: string): Promise<Map<number, string>> {
	const { data } = await apiServer.GET("/api/countries");
	return new Map(
		(data ?? []).map((country) => [
			country.id,
			(country.translations as CountryTranslations | undefined)?.[locale] ?? country.name,
		]),
	);
}
