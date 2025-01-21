import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { EventsTable } from "@/app/dashboard/(user)/events/_components/events-table";
import { getTranslations } from "next-intl/server";

interface PageProps {
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
	}>;
}

export default async function Page(props: PageProps) {
	const user = await isAuthenticated();
	const { search, sortBy, sortOrder, page } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = 10;
	const t = await getTranslations("dashboard.events");

	if (!user) {
		return notFound();
	}

	const where = {
		eventRegistration: {
			some: {
				invitedUsers: {
					some: {
						id: user.id,
					},
				},
			},
		},
		...(search
			? {
					OR: [
						{ name: { contains: search, mode: "insensitive" } },
						{ description: { contains: search, mode: "insensitive" } },
						{ location: { contains: search, mode: "insensitive" } },
					],
				}
			: {}),
	} satisfies Prisma.EventWhereInput;

	const orderBy: Prisma.EventOrderByWithRelationInput = sortBy
		? {
				[sortBy]: sortOrder ?? "asc",
			}
		: { dateStart: "desc" };

	const events = await prisma.event.findMany({
		where,
		orderBy,
		include: {
			_count: {
				select: {
					eventRegistration: true,
				},
			},
			club: {
				select: {
					name: true,
				},
			},
		},
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalEvents = await prisma.event.count({ where });

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("title")}</h3>
			</div>
			<EventsTable
				events={events}
				totalEvents={totalEvents}
				pageSize={pageSize}
			/>
		</>
	);
}
