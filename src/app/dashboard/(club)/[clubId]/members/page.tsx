import { MembersTable } from "@/app/dashboard/(club)/[clubId]/members/_components/members-table";
import { GenericDataTable } from "@/components/generic-data-table";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

interface PageProps {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{
		search?: string;
		role?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
	}>;
}

export default async function MembersPage(props: PageProps) {
	const { clubId } = await props.params;
	const { search, role, sortBy, sortOrder, page } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = 10;

	const where = {
		clubId: clubId,
		...(role && role !== "all" ? { role: role as Role } : {}),
		...(search
			? {
					OR: [
						{ user: { name: { contains: search, mode: "insensitive" } } },
						{ user: { email: { contains: search, mode: "insensitive" } } },
						{ user: { callsign: { contains: search, mode: "insensitive" } } },
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
	}));

	const totalMembers = await prisma.clubMembership.count({ where });

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">Svi članovi</h3>
			</div>
			<MembersTable
				members={formattedMembers}
				totalMembers={totalMembers}
				pageSize={pageSize}
			/>
		</>
	);
}
