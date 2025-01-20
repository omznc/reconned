import { ClubsMapWrapper } from "@/app/(public)/map/_components/clubs-map-wrapper";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Mapa airsoft klubova - RECONNED",
	description: "Mapa airsoft klubova na ovoj platformi",
};

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
