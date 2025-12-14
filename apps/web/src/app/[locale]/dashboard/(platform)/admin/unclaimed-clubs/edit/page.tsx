import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { EditClubForm } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/edit-club-form";
import api from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditUnclaimedClubPage(
	props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs/edit">,
) {
	const searchParams = await props.searchParams;
	const { clubId } = searchParams;

	if (!clubId) {
		return notFound();
	}

	const user = await isAuthenticated();
	if (!user || user.role !== "admin") {
		return notFound();
	}

	const [club, countriesResponse] = await Promise.all([
		prisma.club.findUnique({
			where: { id: clubId as string },
			include: {
				members: {
					where: {
						role: "CLUB_OWNER",
					},
				},
			},
		}),
		api.countries.get(),
	]);

	if (!club || club.members.length > 0 || countriesResponse.error) {
		return notFound();
	}

	const t = await getExtracted();

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold">{t("Edit unclaimed club")}</h3>
				<p className="text-muted-foreground">{t("Edit the information for this unclaimed club.")}</p>
			</div>
			<EditClubForm club={club} countries={countriesResponse.data} />
		</div>
	);
}
