import { format } from "date-fns";
import { bs } from "date-fns/locale";
import { notFound } from "next/navigation";
import { StatsCharts } from "@/app/[locale]/dashboard/(club)/[clubId]/club/stats/_components/stats-charts";
import apiClient from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club/stats">) {
	const params = await props.params;
	const user = await isAuthenticated();

	if (!user) {
		return notFound();
	}

	// Check if user manages this club
	if (!user.managedClubs.includes(params.clubId) && user.role !== "admin") {
		return notFound();
	}

	// Fetch club stats from backend
	const { data: stats, error } = await apiClient.GET("/api/clubs/{id}/stats", {
		params: { path: { id: params.clubId } },
	});

	if (error || !stats) {
		return notFound();
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
