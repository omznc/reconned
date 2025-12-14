import { Role } from "@generated/client";
import { notFound } from "next/navigation";
import { ClubInfoForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import api from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { getInstagramAuthUrl } from "@/lib/instagram";
import { prisma } from "@/lib/prisma";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club/information">) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const [club, countriesResponse] = await Promise.all([
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
		api.countries.get(),
	]);

	if (!club || countriesResponse.error) {
		return notFound();
	}

	const authUrl = await getInstagramAuthUrl(params.clubId);

	return (
		<div className="p-6">
			<ClubInfoForm
				club={club}
				countries={countriesResponse.data}
				isClubOwner={club.members[0]?.role === Role.CLUB_OWNER}
				instagramConnectionUrl={authUrl}
			/>
		</div>
	);
}
