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
	}));

	const totalMembers = await prisma.clubMembership.count({ where });

	return (
		<div className="space-y-4 w-full">
			<div>
				<h3 className="text-lg font-semibold">Svi članovi</h3>
			</div>
			<GenericDataTable
				data={formattedMembers}
				totalPages={Math.ceil(totalMembers / pageSize)}
				searchPlaceholder="Pretraži članove..."
				tableConfig={{
					dateFormat: "d. MMMM yyyy.",
					locale: "bs",
				}}
				columns={[
					{
						key: "userName",
						header: "Ime",
						sortable: true,
					},
					{
						key: "userCallsign",
						header: "Callsign",
						sortable: true,
					},
					{
						key: "role",
						header: "Uloga",
						sortable: true,
						cellConfig: {
							variant: "badge",
							valueMap: {
								CLUB_OWNER: "Vlasnik",
								MANAGER: "Menadžer",
								USER: "Član",
							},
							badgeVariants: {
								CLUB_OWNER: "bg-red-100 text-red-800",
								MANAGER: "bg-blue-100 text-blue-800",
								MEMBER: "bg-gray-100 text-gray-800",
							},
						},
					},
					{
						key: "createdAt",
						header: "Datum pridruživanja",
						sortable: true,
					},
				]}
				filters={[
					{
						key: "role",
						label: "Filter po ulozi",
						options: [
							{ label: "Sve uloge", value: "all" },
							{ label: "Vlasnik", value: "CLUB_OWNER" },
							{ label: "Menadžer", value: "MANAGER" },
							{ label: "Član", value: "USER" },
						],
					},
				]}
			/>
		</div>
	);
}
