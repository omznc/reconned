import { format } from "date-fns";

import { getExtracted, getLocale } from "next-intl/server";
import { StatsCharts } from "@/app/[locale]/dashboard/(club)/[clubId]/club/stats/_components/stats-charts";
import { ErrorPage } from "@/components/error-page";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { getDateFnsLocale } from "@/lib/date-locale";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club/stats">) {
	// `await getExtracted()` must stay in this exact `const x = await ...` form — the next-intl SWC
	// plugin only rewrites that shape, and leaves a bare `getExtracted` identifier anywhere else.
	const t = await getExtracted();
	const [params, user, locale] = await Promise.all([props.params, isAuthenticated(), getLocale()]);
	const dateFnsLocale = getDateFnsLocale(locale);

	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	// The membership check and the stats fetch are independent — fetch them together
	// and gate on the membership result afterwards.
	const [{ data: membershipData }, { data: stats, error }] = await Promise.all([
		apiServer.GET("/api/clubs/{id}/membership", {
			params: { path: { id: params.clubId } },
		}),
		apiServer.GET("/api/clubs/{id}/stats", {
			params: { path: { id: params.clubId } },
		}),
	]);

	const role = membershipData?.membership?.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER" || user.role === "admin";

	if (!isManager) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

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
		month: format(new Date(item.month), "MMMM", { locale: dateFnsLocale }),
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
