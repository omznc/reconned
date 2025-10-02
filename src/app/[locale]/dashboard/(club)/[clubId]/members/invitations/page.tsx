import type { InviteStatus, Prisma } from "@generated/client";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvitationsForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.form";
import { InvitationsTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export async function InvitationsPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/members/invitations">) {
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
	const pageSize =
		searchParams.perPage === "25" || searchParams.perPage === "50" || searchParams.perPage === "100"
			? Number(searchParams.perPage)
			: 25;

	const where: Prisma.ClubInviteWhereInput = {
		clubId: params.clubId,
		...(searchParams.search
			? {
					OR: [
						{
							email: {
								contains: searchParams.search as string,
								mode: "insensitive",
							},
						},
						{
							user: {
								name: {
									contains: searchParams.search as string,
									mode: "insensitive",
								},
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
				[searchParams.sortBy as string]: searchParams.sortOrder ?? "asc" as "asc" | "desc",
			}
		: { createdAt: "desc" };

	const [invitesCount, invites] = await Promise.all([
		prisma.clubInvite.count({ where }),
		prisma.clubInvite.findMany({
			where,
			orderBy,
			include: {
				user: {
					select: {
						name: true,
					},
				},
				club: {
					select: {
						id: true,
					},
				},
			},
			take: pageSize,
			skip: (page - 1) * pageSize,
		}),
	]);

	const formattedInvites = invites.map((invite) => ({
		...invite,
		userName: invite.user?.name ?? "",
	}));

	return <InvitationsTable invites={formattedInvites} totalPages={Math.ceil(invitesCount / pageSize)} />;
}

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/members/invitations">) {
	const searchParams = await props.searchParams;

	return (
		<>
			<InvitationsForm />
			<hr />
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<InvitationsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
