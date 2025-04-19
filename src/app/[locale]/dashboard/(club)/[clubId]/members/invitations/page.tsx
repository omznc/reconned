import { InvitationsForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.form";
import { InvitationsTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations-table";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { InviteStatus, Prisma } from "@prisma/client";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
	searchParams: Promise<{
		[key: string]: string;
	}>;
}

export async function InvitationsPageFetcher(props: PageProps) {
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
		searchParams.perPage === "25" ||
		searchParams.perPage === "50" ||
		searchParams.perPage === "100"
			? Number(searchParams.perPage)
			: 25;

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

	return (
		<InvitationsTable
			invites={formattedInvites}
			totalPages={Math.ceil(invitesCount / pageSize)}
		/>
	);
}

export default async function Page(props: PageProps) {
	const t = await getTranslations("dashboard.club.members.invitations");
	const searchParams = await props.searchParams;

	return (
		<>
			<h3 className="text-lg font-semibold mb-4">{t("title")}</h3>
			<InvitationsForm />
			<hr />
			<Suspense
				key={JSON.stringify(searchParams)}
				fallback={<GenericDataTableSkeleton />}
			>
				<InvitationsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
