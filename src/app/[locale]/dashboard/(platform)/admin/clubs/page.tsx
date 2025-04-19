import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ClubsSheet } from "./_components/clubs.sheet";
import { ClubsTable } from "./_components/clubs.table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

interface PageProps {
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
		clubId?: string;
		perPage?: string;
	}>;
}

export async function ClubsPageFetcher({ searchParams }: PageProps) {
	const { search, sortBy, sortOrder, page, clubId, perPage } =
		await searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const where = search
		? {
			OR: [
				{
					name: {
						contains: search,
						mode: "insensitive" as const,
					},
				},
				{
					location: {
						contains: search,
						mode: "insensitive" as const,
					},
				},
			],
		}
		: {};

	const orderBy: Prisma.ClubOrderByWithRelationInput = sortBy
		? { [sortBy]: sortOrder ?? "asc" }
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

export default async function ClubsPage({ searchParams }: PageProps) {
	const t = await getTranslations("dashboard.admin.clubs");
	const params = await searchParams;

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("allClubs")}</h3>
			</div>
			<Suspense
				key={JSON.stringify(params)}
				fallback={<GenericDataTableSkeleton />}
			>
				<ClubsPageFetcher searchParams={searchParams} />
			</Suspense>
		</>
	);
}
