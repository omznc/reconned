import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE = "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/";

async function fetchData(endpoint: string) {
	const response = await fetch(`${API_BASE}${endpoint}.json`);
	return response.json();
}

async function main() {
	await prisma.$transaction(async (tx) => {
		const countries = await fetchData("countries");
		await tx.country.createMany({
			data: countries.map((country: any) => ({
				name: country.name,
				iso3: country.iso3,
				iso2: country.iso2,
				numericCode: country.numeric_code,
				phoneCode: country.phone_code,
				capital: country.capital,
				currency: country.currency,
				currencyName: country.currency_name,
				currencySymbol: country.currency_symbol,
				tld: country.tld,
				native: country.native,
				region: country.region,
				subregion: country.subregion,
				latitude: country.latitude || null,
				longitude: country.longitude || null,
				emoji: country.emoji,
				emojiU: country.emojiU,
				timezones: country.timezones,
				translations: country.translations,
				wikiDataId: country.wikiDataId,
			})),
			skipDuplicates: true,
		});
	});
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
