import type { Prisma } from "@generated/client";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { prisma } from "@/lib/prisma";
import { ClubsSheet } from "./_components/clubs.sheet.tsx";
import { ClubsTable } from "./_components/clubs.table.tsx";



export async function ClubsPageFetcher(props: PageProps<"/[locale]/dashboard/admin/clubs">) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, clubId, perPage } = await searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const where = search
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
		: {};

	const orderBy: Prisma.ClubOrderByWithRelationInput = sortBy
		? { [sortBy as string]: sortOrder ?? "asc" as "asc" | "desc" }
		: { createdAt: "desc" };

	const clubs = await prisma.club.findMany({
		where,
		orderBy,
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalClubs = await prisma.club.count({ where });

	// Fetch selected club separately if clubId is present
	const selectedClub = clubId
		? await prisma.club.findUnique({
				where: { id: clubId },
			})
		: null;

	return (
		<>
			<ClubsSheet selectedClub={selectedClub ?? undefined} />
			<ClubsTable clubs={clubs} totalClubs={totalClubs} pageSize={pageSize} />
		</>
	);
}

export default async function ClubsPage(props: PageProps<"/[locale]/dashboard/admin/clubs">) {
	const searchParams = await props.searchParams;
	const t = await getTranslations();
	const params = await props.params;

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("dashboard.admin.clubs.allClubs")}</h3>
			</div>
			<Suspense key={JSON.stringify(params)} fallback={<GenericDataTableSkeleton />}>
				<ClubsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
