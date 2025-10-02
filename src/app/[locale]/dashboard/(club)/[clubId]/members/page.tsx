import type { Prisma, Role } from "@generated/client";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MembersTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/members-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";



export async function MembersPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/members">) {
	const [params, { search, role, sortBy, sortOrder, page, perPage }] = await Promise.all([props.params, props.searchParams]);

	const { clubId } = params;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const user = await isAuthenticated();

	const where = {
		clubId: clubId,
		...(role && role !== "all" ? { role: role as Role } : {}),
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
				...(sortBy === "userName" && {
					user: { name: (sortOrder === "desc" ? "desc" : "asc") },
				}),
				...(sortBy === "userCallsign" && {
					user: { callsign: (sortOrder === "desc" ? "desc" : "asc") },
				}),
				...(sortBy === "createdAt" && {
					createdAt: (sortOrder === "desc" ? "desc" : "asc"),
				}),
				...(sortBy === "role" && {
					role: (sortOrder === "desc" ? "desc" : "asc"),
				}),
			}
		: { createdAt: "desc" };

	const members = await prisma.clubMembership.findMany({
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
					location: true,
					bio: true,
					website: true,
					createdAt: true,
					slug: true,
				},
			},
		},
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const formattedMembers = members.map((member) => ({
		...member,
		userName: member.user.name,
		userCallsign: member.user.callsign,
		userAvatar: member.user.image,
		userSlug: member.user.slug,
	}));

	const totalMembers = await prisma.clubMembership.count({ where });

	return (
		<MembersTable
			members={formattedMembers}
			totalMembers={totalMembers}
			pageSize={pageSize}
			currentUserId={user?.id}
		/>
	);
}

export default async function MembersPage(props: PageProps<"/[locale]/dashboard/[clubId]/members">) {
	const t = await getTranslations();
	const searchParams = await props.searchParams;

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("dashboard.club.members.allMembers")}</h3>
			</div>
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<MembersPageFetcher {...props} />
			</Suspense>
		</>
	);
}
