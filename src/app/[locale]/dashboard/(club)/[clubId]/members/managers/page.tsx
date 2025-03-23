import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AddManagerForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.form";
import { ManagersTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/managers-table";
import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

interface PageProps {
	params: Promise<{ clubId: string; }>;
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
		perPage?: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const t = await getTranslations('dashboard.club.members.managers');
	const { search, sortBy, sortOrder, page, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize =
		perPage === "25" || perPage === "50" || perPage === "100"
			? Number(perPage)
			: 25;

	const user = await isAuthenticated();

	if (!user) {
		return notFound();
	}

	const club = await prisma.club.findUnique({
		where: {
			id: params.clubId,
			members: {
				some: {
					userId: user.id,
					role: {
						in: [Role.CLUB_OWNER, Role.MANAGER],
					},
				},
			},
		},
	});

	if (!club) {
		return notFound();
	}

	const where = {
		clubId: params.clubId,
		role: {
			in: [Role.MANAGER, Role.CLUB_OWNER],
		},
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
			...(sortBy === "user.name" && {
				user: { name: sortOrder ?? "asc" },
			}),
			...(sortBy === "user.email" && {
				user: { email: sortOrder ?? "asc" },
			}),
			...(sortBy === "createdAt" && {
				createdAt: sortOrder ?? "asc",
			}),
		}
		: { createdAt: "desc" };

	const managers = await prisma.clubMembership.findMany({
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
				},
			},
		},
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalManagers = await prisma.clubMembership.count({ where });

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold mb-4">{t('title')}</h2>
				<ManagersTable
					managers={managers}
					totalManagers={totalManagers}
					pageSize={pageSize}
				/>
			</div>
			<AddManagerForm />
		</div>
	);
}
