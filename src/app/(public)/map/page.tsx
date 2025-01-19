import { ClubsMapWrapper } from "@/app/(public)/map/_components/clubs-map-wrapper";
import { prisma } from "@/lib/prisma";


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
        },
    });

    return (
        <div className="h-[calc(100dvh-72px)] w-full rounded-lg overflow-hidden border">
            <ClubsMapWrapper clubs={clubs} />
        </div>
    );
}
