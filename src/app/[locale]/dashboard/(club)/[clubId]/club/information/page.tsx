import { Role } from "@generated/client";
import { notFound } from "next/navigation";
import { ClubInfoForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import { isAuthenticated } from "@/lib/auth";
import { getCountries } from "@/lib/cached-countries";
import { getInstagramAuthUrl } from "@/lib/instagram";
import { prisma } from "@/lib/prisma";
	
export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club/information">) {
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
