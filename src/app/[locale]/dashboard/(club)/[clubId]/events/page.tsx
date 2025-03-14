import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlusCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { EventsTable } from "@/app/[locale]/dashboard/(club)/[clubId]/events/_components/events-table";

interface PageProps {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
	}>;
}

export default async function Page(props: PageProps) {
	const { clubId } = await props.params;
	const { search, sortBy, sortOrder, page } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = 10;

	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const where = {
		club: {
			id: clubId,
			members: {
				some: {
					userId: user.id,
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
		},
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalEvents = await prisma.event.count({ where });

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Svi susreti</h3>
				<Button asChild>
					<Link href={`/dashboard/${clubId}/events/create`}>
						<PlusCircle className="size-4 mr-2" />
						Novi susret
					</Link>
				</Button>
			</div>
			<EventsTable
				events={events}
				totalEvents={totalEvents}
				clubId={clubId}
				pageSize={pageSize}
				userIsManager={
					user.managedClubs.includes(clubId) || Boolean(user.role === "admin")
				}
			/>
		</>
	);
}
