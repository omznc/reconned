import { InvitationsForm } from "@/app/dashboard/(club)/[clubId]/members/invitations/_components/invitations-form";
import { GenericDataTable } from "@/components/generic-data-table";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { InviteStatus, Prisma } from "@prisma/client";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
	searchParams: Promise<{
		[key: string]: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const searchParams = await props.searchParams;
	const user = await isAuthenticated();

	if (!user) {
		return notFound();
	}

	const club = await prisma.club.findUnique({
		where: {
			members: {
				some: {
					userId: user.id,
					role: {
						in: ["CLUB_OWNER", "MANAGER"],
					},
				},
			},
			id: params.clubId,
		},
	});

	if (!club) {
		return notFound();
	}

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

	const orderBy: Prisma.ClubInviteOrderByWithRelationInput = searchParams.sortBy
		? {
				[searchParams.sortBy]: searchParams.sortOrder ?? "asc",
			}
		: { createdAt: "desc" };

	const invitesCount = await prisma.clubInvite.count({
		where,
	});

	const invites = await prisma.clubInvite.findMany({
		where,
		orderBy,
		include: {
			user: {
				select: {
					name: true,
				},
			},
		},
		take: pageSize,
		skip: (page - 1) * pageSize,
	});

	const formattedInvites = invites.map((invite) => ({
		...invite,
		userName: invite.user?.name ?? "",
	}));

	return (
		<div className="space-y-4 w-full">
			<InvitationsForm />
			<GenericDataTable
				data={formattedInvites}
				totalPages={Math.ceil(invitesCount / pageSize)}
				searchPlaceholder="Pretraži pozivnice..."
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
						key: "userName",
						header: "Korisnik",
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
						header: "Datum slanja",
						sortable: true,
					},
					{
						key: "expiresAt",
						header: "Ističe",
						sortable: true,
					},
					{
						key: "inviteCode",
						header: "Kod pozivnice",
					},
				]}
				filters={[
					{
						key: "status",
						label: "Filter po statusu",
						options: [
							{ label: "Svi statusi", value: "all" },
							{ label: "Na čekanju", value: "PENDING" },
							{ label: "Prihvaćeno", value: "ACCEPTED" },
							{ label: "Odbijeno", value: "REJECTED" },
							{ label: "Isteklo", value: "EXPIRED" },
						],
					},
				]}
			/>
		</div>
	);
}
