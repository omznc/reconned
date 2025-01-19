import { prisma } from "@/lib/prisma";
import { cache } from "react";

export interface Country {
	id: number;
	name: string;
	emoji: string;
}

export const getCountries = cache(async (): Promise<Country[]> => {
	const countries = await prisma.country.findMany({
		where: { enabled: true },
		select: {
			id: true,
			name: true,
			emoji: true,
		},
		orderBy: { name: "asc" },
	});

	return countries.map((country) => ({
		id: country.id,
		name: country.name,
		emoji: country.emoji as string,
	}));
});
