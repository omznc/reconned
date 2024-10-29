import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/club-overview";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;

	const club = await prisma.club.findFirst({
		where: {
			id: params.id,
			isPrivate: false,
		},
		include: {
			_count: {
				select: {
					members: true,
				},
			},
		},
	});

	if (!club) {
		return notFound();
	}

	return (
		<div className="flex flex-col size-full gap-8">
			<ClubOverview club={club} />
		</div>
	);
}

export async function generateMetadata(props: PageProps) {
	const params = await props.params;

	const club = await prisma.club.findFirst({
		where: {
			id: params.id,
			isPrivate: false,
		},
	});

	if (!club) {
		return notFound();
	}

	return {
		title: `${club.name} - AirsoftBIH`,
		description: club.description?.slice(0, 160) ?? "Airsoft klub",
		openGraph: {
			images: [
				{
					url: club.logo,
					width: 1200,
					height: 630,
					alt: club.name,
				},
			],
		},
	};
}
