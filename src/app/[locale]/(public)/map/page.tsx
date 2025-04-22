import { ClubsMapWrapper } from "@/components/clubs-map/clubs-map-wrapper";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export default async function MapPage() {
	const clubs = await prisma.club.findMany({
		where: {
			isPrivate: false,
			latitude: { not: null },
			longitude: { not: null },
		},
		select: {
			id: true,
			name: true,
			logo: true,
			latitude: true,
			longitude: true,
			slug: true,
			location: true,
		},
	});

	const transformedClubs = clubs.map((club) => ({
		...club,
		location: club.location ?? undefined,
		slug: club.slug ?? undefined,
		logo: club.logo ?? undefined,
	}));

	return (
		<div className="h-[calc(100dvh-72px)] w-full rounded-lg overflow-hidden border">
			<ClubsMapWrapper clubs={transformedClubs} />
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("public");

	return {
		title: t("map.metadata.title"),
		description: t("map.metadata.description"),
		keywords: t("layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
