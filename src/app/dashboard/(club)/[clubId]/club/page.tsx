import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/club-overview";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const club = await prisma.club.findUnique({
		where: {
			members: {
				some: {
					userId: user.id,
				},
			},
			id: params.clubId,
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
		<div className="space-y-4 max-w-3xl">
			<div>
				<h3 className="text-lg font-semibold">Klub</h3>
			</div>
			<ClubOverview club={club} />
		</div>
	);
}
