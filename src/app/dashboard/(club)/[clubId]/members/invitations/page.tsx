import { InvitationsForm } from "@/app/dashboard/(club)/[clubId]/members/invitations/_components/invitations-form";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
// biome-ignore lint/correctness/useImportExtensions: <explanation>
import ClubInvitesTable from "./_components/invitations-table";
import type { InviteStatus, Prisma } from "@prisma/client";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
	searchParams: Promise<{
		page?: string;
		pageSize?: string;
		search?: string;
		status?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
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

	const page = Math.max(1, Number(searchParams.page) || 1);
	const pageSize = 10;

	const whereClause: Prisma.ClubInviteWhereInput = {
		clubId: params.clubId,
		...(searchParams.status && searchParams.status !== "all"
			? { status: searchParams.status as InviteStatus }
			: {}),
		...(searchParams.search
			? {
					// biome-ignore lint/style/useNamingConvention: <explanation>
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
	};

	const totalInvites = await prisma.clubInvite.count({
		where: whereClause,
	});

	const orderBy: Prisma.ClubInviteOrderByWithRelationInput =
		searchParams.sortBy === "userName"
			? { user: { name: searchParams.sortOrder || "desc" } }
			: searchParams.sortBy
				? { [searchParams.sortBy]: searchParams.sortOrder || "desc" }
				: { createdAt: "desc" };

	const invites = await prisma.clubInvite.findMany({
		where: whereClause,
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
		skip: (page - 1) * pageSize,
		take: pageSize,
		orderBy,
	});

	return (
		<div className="space-y-4 w-full md:w-fit max-w-full">
			<InvitationsForm />
			<ClubInvitesTable
				data={invites}
				totalItems={totalInvites}
				currentPage={page}
				pageSize={pageSize}
				searchParams={searchParams}
			/>
		</div>
	);
}
