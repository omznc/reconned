import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage, NoAccessPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { getDateFnsLocale } from "@/lib/date-locale";
import { StatsCharts } from "@/routes/{-$locale}/dashboard/$clubId/club/stats/-components/stats-charts";

const getStatsFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string(), locale: z.string() }))
	.handler(async ({ data }) => {
		const { data: stats, error } = await apiServer.GET("/api/clubs/{id}/stats", {
			params: { path: { id: data.clubId } },
		});
		if (error || !stats) {
			return null;
		}
		const dateFnsLocale = getDateFnsLocale(data.locale);
		return {
			memberData: stats.members.map((item) => ({
				date: format(new Date(item.date), "dd.MM"),
				members: item.count,
			})),
			roleData: stats.roles.map((item) => ({ role: item.role.toLowerCase(), count: item.count })),
			eventData: stats.events.map((item) => ({
				month: format(new Date(item.month), "MMMM", { locale: dateFnsLocale }),
				count: item.count,
			})),
			registrationData: stats.recentEvents.map((event) => ({
				name: event.name,
				registrations: event.registrationCount,
			})),
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/club/stats/")({
	loader: async ({ params, context }) => {
		if (!context.access.isManager) {
			return { kind: "forbidden" as const };
		}
		const stats = await getStatsFn({ data: { clubId: params.clubId, locale: context.locale } });
		return stats ? { kind: "ok" as const, ...stats } : { kind: "failed" as const };
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: StatsPage,
});

function StatsPage() {
	const t = useExtracted();
	const stats = Route.useLoaderData();

	if (stats.kind === "forbidden") {
		return <NoAccessPage />;
	}
	if (stats.kind === "failed") {
		return <ErrorPage title={t("An error occurred")} />;
	}
	return (
		<StatsCharts
			memberData={stats.memberData}
			roleData={stats.roleData}
			eventData={stats.eventData}
			registrationData={stats.registrationData}
		/>
	);
}
