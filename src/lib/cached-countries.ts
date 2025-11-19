import type { Country as PrismaCountry } from "@generated/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getCountries = cache(async () => {
	const countries = await prisma.country.findMany({
		where: { enabled: true },
		select: {
			id: true,
			name: true,
			emoji: true,
			iso2: true,
			latitude: true,
			longitude: true,
		},
		orderBy: { name: "asc" },
	});

	return countries.map((country) => ({
		...country,
		emoji: country.emoji as string,
		latitude: country.latitude ? Number(country.latitude) : null,
		longitude: country.longitude ? Number(country.longitude) : null,
	}));
});

export type Country = Pick<PrismaCountry, "id" | "name" | "emoji" | "iso2"> & {
	latitude: number | null;
	longitude: number | null;
};
