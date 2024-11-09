import { prisma } from "@/lib/prisma";
import { GenericDataTable } from "@/components/generic-data-table";
import type { Prisma, Role } from "@prisma/client";

interface PageProps {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{
		[key: string]: string;
	}>;
}

export default async function MembersTestPage(props: PageProps) {
	const params = await props.params;
	const searchParams = await props.searchParams;
	const page = Math.max(1, Number(searchParams.page ?? 1));
	const pageSize = 10;

	const where: Prisma.ClubMembershipWhereInput = {
		clubId: params.clubId,
		...(searchParams.search
			? {
					OR: [
						{
							user: {
								name: { contains: searchParams.search, mode: "insensitive" },
							},
						},
						{
							user: {
								callsign: {
									contains: searchParams.search,
									mode: "insensitive",
								},
							},
						},
						{
							user: {
								email: { contains: searchParams.search, mode: "insensitive" },
							},
						},
					],
				}
			: {}),
		...(searchParams.role && searchParams.role !== "all"
			? {
					role: searchParams.role as Role,
				}
			: {}),
	};

	// @ts-expect-error
	const orderBy: Prisma.ClubMembershipOrderByWithRelationInput =
		searchParams.sortBy
			? {
					...(searchParams.sortBy === "name" && {
						user: { name: searchParams.sortOrder ?? "asc" },
					}),
					...(searchParams.sortBy === "callsign" && {
						user: { callsign: searchParams.sortOrder ?? "asc" },
					}),
					...(searchParams.sortBy === "createdAt" && {
						createdAt: searchParams.sortOrder ?? "asc",
					}),
				}
			: { createdAt: "desc" };

	const members = await prisma.clubMembership.findMany({
		where,
		orderBy,
		include: { user: true },
		take: pageSize,
		skip: (page - 1) * pageSize,
	});

	const membersCount = await prisma.clubMembership.count({
		where,
	});

	const formattedMembers = members.map((m) => ({
		id: m.id,
		name: m.user.name,
		callsign: m.user.callsign,
		email: m.user.email,
		role: m.role,
		createdAt: m.createdAt,
	}));

	return (
		<div>
			<h2 className="text-lg font-semibold mb-4">Members Test Table</h2>
			<GenericDataTable
				data={formattedMembers}
				totalPages={Math.ceil(membersCount / 10)}
				searchPlaceholder="Search members..."
				tableConfig={{
					dateFormat: "d. MMMM yyyy.",
					locale: "bs",
				}}
				columns={[
					{
						key: "name",
						header: "Name",
						sortable: true,
					},
					{
						key: "callsign",
						header: "Callsign",
						sortable: true,
					},
					{
						key: "role",
						header: "Role",
						cellConfig: {
							valueMap: {
								USER: "Član",
								MANAGER: "Menadžer",
								CLUB_OWNER: "Vlasnik kluba",
							},
						},
					},
					{
						key: "createdAt",
						header: "Joined Date",
						sortable: true,
					},
				]}
				filters={[
					{
						key: "role",
						label: "Filter by Role",
						options: [
							{ label: "All Roles", value: "all" },
							{ label: "Member", value: "USER" },
							{ label: "Manager", value: "MANAGER" },
							{ label: "Owner", value: "CLUB_OWNER" },
						],
					},
				]}
				mobileCardConfig={{
					title: "name",
					subtitle: "callsign",
				}}
			/>
		</div>
	);
}
