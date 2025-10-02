import type { Prisma } from "@generated/client";
import { Suspense } from "react";
import { UserSheet } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-sheet";
import { UserTable } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { prisma } from "@/lib/prisma";




export async function UsersPageFetcher(props: PageProps<"/[locale]/dashboard/admin/users">) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, userId, perPage } = searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	// Fetch selected user separately if userId is present
	const selectedUser = userId
		? await prisma.user.findUnique({
				where: { id: userId as string },
				include: {
					clubMembership: {
						include: {
							club: {
								select: {
									name: true,
								},
							},
						},
					},
				},
			})
		: null;

	const where = {
		...(search
			? {
					OR: [
						{ name: { contains: search as string, mode: "insensitive" } },
						{ email: { contains: search as string, mode: "insensitive" } },
						{ callsign: { contains: search as string, mode: "insensitive" } },
					],
				}
			: {}),
	} satisfies Prisma.UserWhereInput;

	const orderBy: Prisma.UserOrderByWithRelationInput = sortBy
		? {
				...(sortBy === "name" && { name: (sortOrder === "desc" ? "desc" : "asc") }),
				...(sortBy === "email" && { email: (sortOrder === "desc" ? "desc" : "asc") }),
				...(sortBy === "callsign" && { callsign: (sortOrder === "desc" ? "desc" : "asc") }),
				...(sortBy === "createdAt" && {
					createdAt: (sortOrder === "desc" ? "desc" : "asc"),
				}),
			}
		: { createdAt: "desc" };

	const users = await prisma.user.findMany({
		where,
		orderBy,
		include: {
			clubMembership: {
				include: {
					club: {
						select: {
							name: true,
						},
					},
				},
			},
		},
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalUsers = await prisma.user.count({ where });

	return (
		<>
			<UserSheet user={selectedUser ?? undefined} />
			<UserTable users={users} totalUsers={totalUsers} pageSize={pageSize} />
		</>
	);
}

export default async function UsersPage(props: PageProps<"/[locale]/dashboard/admin/users">) {
	const searchParams = await props.searchParams;
	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">Svi članovi</h3>
			</div>
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<UsersPageFetcher {...props} />
			</Suspense>
		</>
	);
}
