import { format } from "date-fns";
import { bs } from "date-fns/locale";
import { getExtracted } from "next-intl/server";
import { StatsCharts } from "@/app/[locale]/dashboard/(club)/[clubId]/club/stats/_components/stats-charts";
import { ErrorPage } from "@/components/error-page";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club/stats">) {
	const params = await props.params;
	const t = await getExtracted();
	const user = await isAuthenticated();

	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	// Check if user manages this club
	const { data: membershipData } = await apiServer.GET("/api/clubs/{id}/membership", {
		params: { path: { id: params.clubId } },
	});

	const role = membershipData?.membership?.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER" || user.role === "admin";

	if (!isManager) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	// Fetch club stats from backend
	const { data: stats, error } = await apiServer.GET("/api/clubs/{id}/stats", {
		params: { path: { id: params.clubId } },
	});

	if (error || !stats) {
		return <ErrorPage title={t("An error occurred")} />;
	}

	// Format data for charts
	const memberData = stats.members.map((item) => ({
		date: format(new Date(item.date), "dd.MM"),
		members: item.count,
	}));

	const roleData = stats.roles.map((item) => ({
		role: item.role.toLowerCase(),
		count: item.count,
	}));

	const eventData = stats.events.map((item) => ({
		month: format(new Date(item.month), "MMMM", { locale: bs }),
		count: item.count,
	}));

	const registrationData = stats.recentEvents.map((event) => ({
		name: event.name,
		registrations: event.registrationCount,
	}));

	return (
		<StatsCharts
			memberData={memberData}
			roleData={roleData}
			eventData={eventData}
			registrationData={registrationData}
		/>
	);
}
