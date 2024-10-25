import { ClubInfoForm } from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info-form";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

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
					role: {
						in: ["CLUB_OWNER", "MANAGER"],
					},
				},
			},
			id: params.clubId,
		},
	});

	if (!club) {
		return notFound();
	}

	return <ClubInfoForm club={club} />;
}
