import type { Prisma } from "@generated/client";
import { Plus } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { UnclaimedClubsSheet } from "./_components/unclaimed-clubs.sheet.tsx";
import { UnclaimedClubsTable } from "./_components/unclaimed-clubs.table.tsx";

export async function UnclaimedClubsPageFetcher(props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs">) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, clubId, perPage } = await searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const where: Prisma.ClubWhereInput = {
		...(search
			? {
					OR: [
						{
							name: {
								contains: search as string,
								mode: "insensitive" as const,
							},
						},
						{
							location: {
								contains: search as string,
								mode: "insensitive" as const,
							},
						},
					],
				}
			: {}),
		members: {
			none: {
				role: "CLUB_OWNER",
			},
		},
	};

	const orderBy: Prisma.ClubOrderByWithRelationInput = sortBy
		? { [sortBy as string]: sortOrder ?? ("asc" as "asc" | "desc") }
		: { createdAt: "desc" };

	const clubs = await prisma.club.findMany({
		where,
		orderBy,
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
		include: {
			_count: {
				select: {
					members: true,
				},
			},
		},
	});

	const totalClubs = await prisma.club.count({ where });

	const selectedClub = clubId
		? await prisma.club.findUnique({
				where: { id: clubId as string },
				include: {
					_count: {
						select: {
							members: true,
						},
					},
				},
			})
		: null;

	return (
		<>
			<UnclaimedClubsSheet selectedClub={selectedClub ?? undefined} />
			<UnclaimedClubsTable clubs={clubs} totalClubs={totalClubs} pageSize={pageSize} />
		</>
	);
}

export default async function UnclaimedClubsPage(props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs">) {
	const params = await props.params;
	const t = await getExtracted();

	return (
		<>
			<div className="flex justify-between items-center mb-4">
				<h3 className="text-lg font-semibold">{t("Unclaimed clubs")}</h3>
				<Button asChild>
					<Link href="/dashboard/admin/unclaimed-clubs/create">
						<Plus className="size-4 mr-2" />
						{t("Create unclaimed club")}
					</Link>
				</Button>
			</div>
			<Suspense key={JSON.stringify(params)} fallback={<GenericDataTableSkeleton />}>
				<UnclaimedClubsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
