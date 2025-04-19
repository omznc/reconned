import { UserSheet } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-sheet";
import { UserTable } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Suspense } from "react";

interface PageProps {
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
		userId?: string;
		perPage?: string;
	}>;
}

export async function UsersPageFetcher(props: PageProps) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, userId, perPage } = searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	// Fetch selected user separately if userId is present
	const selectedUser = userId
		? await prisma.user.findUnique({
				where: { id: userId },
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
						{ name: { contains: search, mode: "insensitive" } },
						{ email: { contains: search, mode: "insensitive" } },
						{ callsign: { contains: search, mode: "insensitive" } },
					],
				}
			: {}),
	} satisfies Prisma.UserWhereInput;

	const orderBy: Prisma.UserOrderByWithRelationInput = sortBy
		? {
				...(sortBy === "name" && { name: sortOrder ?? "asc" }),
				...(sortBy === "email" && { email: sortOrder ?? "asc" }),
				...(sortBy === "callsign" && { callsign: sortOrder ?? "asc" }),
				...(sortBy === "createdAt" && {
					createdAt: sortOrder ?? "asc",
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

export default async function UsersPage(props: PageProps) {
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
