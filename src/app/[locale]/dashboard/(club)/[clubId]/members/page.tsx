import { MembersTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/members-table";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { isAuthenticated } from "@/lib/auth";

interface PageProps {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{
		search?: string;
		role?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
		perPage?: string;
	}>;
}

export default async function MembersPage(props: PageProps) {
	const [params, searchParams] = await Promise.all([props.params, props.searchParams]);

	const { clubId } = params;
	const { search, role, sortBy, sortOrder, page, perPage } = searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const [t, user] = await Promise.all([getTranslations("dashboard.club.members"), isAuthenticated()]);

	const where = {
		clubId: clubId,
		...(role && role !== "all" ? { role: role as Role } : {}),
		...(search
			? {
					OR: [
						{
							user: {
								name: { contains: search, mode: "insensitive" },
							},
						},
						{
							user: {
								email: {
									contains: search,
									mode: "insensitive",
								},
							},
						},
						{
							user: {
								callsign: {
									contains: search,
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
					user: { name: sortOrder ?? "asc" },
				}),
				...(sortBy === "userCallsign" && {
					user: { callsign: sortOrder ?? "asc" },
				}),
				...(sortBy === "createdAt" && {
					createdAt: sortOrder ?? "asc",
				}),
				...(sortBy === "role" && {
					role: sortOrder ?? "asc",
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
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("allMembers")}</h3>
			</div>
			<MembersTable
				members={formattedMembers}
				totalMembers={totalMembers}
				pageSize={pageSize}
				currentUserId={user?.id}
			/>
		</>
	);
}
