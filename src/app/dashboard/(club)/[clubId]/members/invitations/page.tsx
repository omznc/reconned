import { InvitationsForm } from "@/app/dashboard/(club)/[clubId]/members/invitations/_components/invitations-form";
import { InvitationsTable } from "@/app/dashboard/(club)/[clubId]/members/invitations/_components/invitations-table";
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

interface FormattedInvite {
	email: string;
	userName: string;
	status: InviteStatus;
	createdAt: Date;
	expiresAt: Date;
	inviteCode: string;
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
		<div className="space-y-4 w-full">
			<InvitationsForm />
			<InvitationsTable
				invites={formattedInvites}
				totalPages={Math.ceil(invitesCount / pageSize)}
			/>
		</div>
	);
}
