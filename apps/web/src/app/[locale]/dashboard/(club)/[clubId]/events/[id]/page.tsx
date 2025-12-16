import { Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { EventOverview } from "@/components/overviews/event-overview";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/[id]">) {
	const params = await props.params;
	const user = await isAuthenticated();
	const t = await getExtracted();

	if (!user) {
		return notFound();
	}

	// Fetch event from backend
	const { data: eventData, error: eventError } = await apiServer.GET("/api/events/{id}", {
		params: { path: { id: params.id } },
	});

	if (eventError || !eventData) {
		return notFound();
	}

	const { event, registrationCount } = eventData;

	// Check if user is a member of the club
	const { data: clubData, error: clubError } = await apiServer.GET("/api/clubs/{id}/membership", {
		params: { path: { id: params.clubId } },
	});

	if (clubError || !clubData?.membership) {
		return notFound();
	}

	// Fetch event rules
	const { data: rulesData } = await apiServer.GET("/api/events/{id}/rules", {
		params: { path: { id: params.id } },
	});

	const role = clubData.membership.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER" || user.role === "admin";

	const disabledAttendence =
		!isManager || new Date() < new Date(event.dateRegistrationsClose) || new Date() > new Date(event.dateEnd);

	// Combine event with rules and count for the overview component
	const eventWithDetails = {
		...event,
		rules: rulesData?.rules || [],
		_count: {
			eventRegistration: registrationCount,
		},
	};

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("Event")}</h3>
				<Button disabled={disabledAttendence} variant="default" size="sm" asChild={!disabledAttendence}>
					<Link
						className="flex items-center gap-2"
						href={`/dashboard/${params.clubId}/events/${params.id}/attendance`}
					>
						<Users className="h-4 w-4" />
						{t("Presence")}
					</Link>
				</Button>
			</div>
			<EventOverview event={eventWithDetails} clubId={params.clubId} />
		</>
	);
}
