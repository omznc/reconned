import { prisma } from "@/lib/prisma";
import { GenericDataTable } from "@/components/generic-data-table";
import type { Prisma, InviteStatus } from "@prisma/client";

interface PageProps {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{
		[key: string]: string;
	}>;
}

export default async function InvitesTestPage(props: PageProps) {
	const params = await props.params;
	const searchParams = await props.searchParams;
	const page = Math.max(1, Number(searchParams.page ?? 1));
	const pageSize = 10;

	const where: Prisma.ClubInviteWhereInput = {
		clubId: params.clubId,
		...(searchParams.search
			? {
					OR: [
						{ email: { contains: searchParams.search, mode: "insensitive" } },
						{
							user: {
								name: { contains: searchParams.search, mode: "insensitive" },
							},
						},
					],
				}
			: {}),
		...(searchParams.status && searchParams.status !== "all"
			? {
					status: searchParams.status as InviteStatus,
				}
			: {}),
	};

	// @ts-expect-error
	const orderBy: Prisma.ClubInviteOrderByWithRelationInput = searchParams.sortBy
		? {
				...(searchParams.sortBy === "email" && {
					email: searchParams.sortOrder ?? "asc",
				}),
				...(searchParams.sortBy === "status" && {
					status: searchParams.sortOrder ?? "asc",
				}),
				...(searchParams.sortBy === "role" && {
					role: searchParams.sortOrder ?? "asc",
				}),
				...(searchParams.sortBy === "createdAt" && {
					createdAt: searchParams.sortOrder ?? "asc",
				}),
			}
		: { createdAt: "desc" };

	const invites = await prisma.clubInvite.findMany({
		where,
		orderBy,
		include: { user: true },
		take: pageSize,
		skip: (page - 1) * pageSize,
	});

	const invitesCount = await prisma.clubInvite.count({
		where,
	});

	return (
		<div>
			<h2 className="text-lg font-semibold mb-4">Invitations Test Table</h2>
			<GenericDataTable
				data={invites}
				totalPages={Math.ceil(invitesCount / 10)}
				searchPlaceholder="Search invitations..."
				tableConfig={{
					dateFormat: "d. MMMM yyyy.",
					locale: "bs",
				}}
				columns={[
					{
						key: "email",
						header: "Email",
						sortable: true,
					},
					{
						key: "status",
						header: "Status",
						sortable: true,
						cellConfig: {
							variant: "badge",
							valueMap: {
								PENDING: "Na čekanju",
								ACCEPTED: "Prihvaćeno",
								REJECTED: "Odbijeno",
								EXPIRED: "Isteklo",
							},
							badgeVariants: {
								PENDING: "bg-yellow-100 text-yellow-800",
								ACCEPTED: "bg-green-100 text-green-800",
								REJECTED: "bg-red-100 text-red-800",
								EXPIRED: "bg-gray-100 text-gray-800",
							},
						},
					},
					{
						key: "createdAt",
						header: "Created At",
						sortable: true,
					},
				]}
				filters={[
					{
						key: "status",
						label: "Filter by Status",
						options: [
							{ label: "All", value: "all" },
							{ label: "Pending", value: "PENDING" },
							{ label: "Accepted", value: "ACCEPTED" },
							{ label: "Rejected", value: "REJECTED" },
						],
					},
				]}
				mobileCardConfig={{
					title: "email",
					subtitle: "status",
				}}
			/>
		</div>
	);
}
