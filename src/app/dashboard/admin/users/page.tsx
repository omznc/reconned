import { UserSheet } from "@/app/dashboard/admin/users/_components/user-sheet";
import { UserTable } from "@/app/dashboard/admin/users/_components/user-table";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface PageProps {
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
		userId?: string;
	}>;
}

export default async function UsersPage({ searchParams }: PageProps) {
	const { search, sortBy, sortOrder, page, userId } = await searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = 10;

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
				...(sortBy === "createdAt" && { createdAt: sortOrder ?? "asc" }),
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
			<div>
				<h3 className="text-lg font-semibold">Svi članovi</h3>
			</div>
			<UserSheet user={users.find((user) => user.id === userId)} />
			<UserTable users={users} totalUsers={totalUsers} pageSize={pageSize} />
		</>
	);
}
