import { EventOverview } from "@/components/event-overview";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
	params: Promise<{
		clubId: string;
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			club: {
				members: {
					some: {
						userId: user.id,
					},
				},
			},
		},
		include: {
			_count: {
				select: {
					eventRegistration: true,
				},
			},
			rules: true,
		},
	});

	if (!event) {
		return notFound();
	}

	const disabledAttendence =
		!(user.managedClubs.includes(params.clubId) || user.isAdmin) ||
		new Date() < new Date(event.dateRegistrationsClose) ||
		new Date() > new Date(event.dateEnd);

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Susret</h3>
				<Button
					disabled={disabledAttendence}
					variant="default"
					size="sm"
					asChild={!disabledAttendence}
				>
					<Link
						className="flex items-center gap-2"
						href={`/dashboard/${params.clubId}/events/${params.id}/attendance`}
					>
						<Users className="h-4 w-4" />
						Prisustvo
					</Link>
				</Button>
			</div>
			<EventOverview event={event} clubId={params.clubId} />
		</>
	);
}
