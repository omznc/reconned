import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { EventsTable } from "@/app/[locale]/dashboard/(user)/events/_components/events-table";
import { getTranslations } from "next-intl/server";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { Suspense } from "react";

interface PageProps {
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
		perPage?: string;
	}>;
}

export async function EventsPageFetcher(props: PageProps) {
	const user = await isAuthenticated();
	const { search, sortBy, sortOrder, page, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize =
		perPage === "25" || perPage === "50" || perPage === "100"
			? Number(perPage)
			: 25;

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
					{
						description: {
							contains: search,
							mode: "insensitive",
						},
					},
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
		<EventsTable
			events={events}
			totalEvents={totalEvents}
			pageSize={pageSize}
		/>
	);
}

export default async function Page(props: PageProps) {
	const t = await getTranslations("dashboard.events");
	const searchParams = await props.searchParams;

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("title")}</h3>
			</div>
			<Suspense
				key={JSON.stringify(searchParams)}
				fallback={<GenericDataTableSkeleton />}
			>
				<EventsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
