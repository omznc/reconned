import { prisma } from "@/lib/prisma";
import { cache } from "react";

export const getCountries = cache(async () => {
	const countries = await prisma.country.findMany({
		where: { enabled: true },
		select: {
			id: true,
			name: true,
			emoji: true,
			iso2: true,
		},
		orderBy: { name: "asc" },
	});

	return countries.map((country) => ({
		...country,
		emoji: country.emoji as string,
	}));
});
