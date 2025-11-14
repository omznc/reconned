import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EditClubForm } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/edit-club-form";
import { isAuthenticated } from "@/lib/auth";
import { getCountries } from "@/lib/cached-countries";
import { prisma } from "@/lib/prisma";

export default async function EditUnclaimedClubPage(
	props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs/edit/[clubId]">,
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

	const [club, countries] = await Promise.all([
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
		getCountries(),
	]);

	if (!club || club.members.length > 0) {
		return notFound();
	}

	const t = await getTranslations();

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold">{t("dashboard.admin.unclaimedClubs.editTitle")}</h3>
				<p className="text-muted-foreground">{t("dashboard.admin.unclaimedClubs.editDescription")}</p>
			</div>
			<EditClubForm club={club} countries={countries} />
		</div>
	);
}
