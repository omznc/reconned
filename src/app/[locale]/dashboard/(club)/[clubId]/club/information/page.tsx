import { ClubInfoForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCountries } from "@/lib/cached-countries";
import { Role } from "@prisma/client";
import { notFound } from "next/navigation";
import { getInstagramAuthUrl } from "@/lib/instagram";

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

	const [club, countries] = await Promise.all([
		prisma.club.findUnique({
			where: {
				members: {
					some: {
						userId: user.id,
						role: {
							in: [Role.CLUB_OWNER, Role.MANAGER],
						},
					},
				},
				id: params.clubId,
			},
			include: {
				members: {
					select: {
						userId: true,
						role: true,
					},
					where: {
						userId: user.id,
					},
				},
			},
		}),
		getCountries(),
	]);

	if (!club) {
		return notFound();
	}

	const authUrl = await getInstagramAuthUrl(params.clubId);

	return (
		<div className="p-6">
			<ClubInfoForm
				club={club}
				countries={countries}
				isClubOwner={club.members[0]?.role === Role.CLUB_OWNER}
				instagramConnectionUrl={authUrl}
			/>
		</div>
	);
}
