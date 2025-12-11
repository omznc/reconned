import type { Prisma } from "@generated/client";
import { Role } from "@generated/client";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { AddManagerForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.form";
import { ManagersTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/managers-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function ManagersPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/members/managers">) {
	const params = await props.params;
	const { search, sortBy, sortOrder, page, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const user = await isAuthenticated();

	if (!user) {
		return notFound();
	}

	const club = await prisma.club.findUnique({
		where: {
			id: params.clubId,
			members: {
				some: {
					userId: user.id,
					role: {
						in: [Role.CLUB_OWNER, Role.MANAGER],
					},
				},
			},
		},
	});

	if (!club) {
		return notFound();
	}

	const where = {
		clubId: params.clubId,
		role: {
			in: [Role.MANAGER, Role.CLUB_OWNER],
		},
		...(search
			? {
					OR: [
						{
							user: {
								name: { contains: search as string, mode: "insensitive" },
							},
						},
						{
							user: {
								email: {
									contains: search as string,
									mode: "insensitive",
								},
							},
						},
						{
							user: {
								callsign: {
									contains: search as string,
									mode: "insensitive",
								},
							},
						},
					],
				}
			: {}),
	} satisfies Prisma.ClubMembershipWhereInput;

	const orderBy: Prisma.ClubMembershipOrderByWithRelationInput = sortBy
		? {
				...(sortBy === "user.name" && {
					user: { name: sortOrder === "desc" ? "desc" : "asc" },
				}),
				...(sortBy === "user.email" && {
					user: { email: sortOrder === "desc" ? "desc" : "asc" },
				}),
				...(sortBy === "createdAt" && {
					createdAt: sortOrder === "desc" ? "desc" : "asc",
				}),
			}
		: { createdAt: "desc" };

	const managers = await prisma.clubMembership.findMany({
		where,
		orderBy,
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					image: true,
					callsign: true,
				},
			},
		},
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalManagers = await prisma.clubMembership.count({ where });

	return <ManagersTable managers={managers} totalManagers={totalManagers} pageSize={pageSize} />;
}

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/members/managers">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold mb-4">{t("Managers")}</h2>
				<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
					<ManagersPageFetcher {...props} />
				</Suspense>
			</div>
			<AddManagerForm />
		</div>
	);
}
