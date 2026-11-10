import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { NoAccessPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { EventOverview } from "@/components/overviews/event-overview";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { fetchReviews } from "@/lib/server/event-page";
import { serializable } from "@/routes/{-$locale}/dashboard/$clubId/-lib/serializable";

const getEventFn = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const path = { id: data.id };
		const { data: eventData, error } = await apiServer.GET("/api/events/{id}", { params: { path } });
		if (error || !eventData) {
			return null;
		}
		const { data: rulesData } = await apiServer.GET("/api/events/{id}/rules", { params: { path } });
		return serializable({
			...eventData.event,
			rules: rulesData?.rules || [],
			_count: { eventRegistration: eventData.registrationCount },
		});
	});

const getReviewsFn = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => serializable((await fetchReviews(data.id))?.reviews));

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/events/$id/")({
	loader: async ({ params, context }) => {
		if (!context.access.membership) {
			return { kind: "forbidden" as const };
		}
		const [event, reviews] = await Promise.all([
			getEventFn({ data: { id: params.id } }),
			getReviewsFn({ data: { id: params.id } }),
		]);
		if (!event) {
			throw notFound();
		}
		const disabledAttendance =
			!context.access.isManager ||
			new Date() < new Date(event.dateRegistrationsClose) ||
			new Date() > new Date(event.dateEnd);
		return { kind: "ok" as const, event, reviews, disabledAttendance };
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: EventPage,
});

function EventPage() {
	const t = useExtracted();
	const { clubId, id } = Route.useParams();
	const page = Route.useLoaderData();

	if (page.kind === "forbidden") {
		return <NoAccessPage />;
	}
	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("Event")}</h3>
				<Button
					disabled={page.disabledAttendance}
					variant="default"
					size="sm"
					asChild={!page.disabledAttendance}
				>
					<Link className="flex items-center gap-2" href={`/dashboard/${clubId}/events/${id}/attendance`}>
						<Users className="h-4 w-4" />
						{t("Presence")}
					</Link>
				</Button>
			</div>
			<EventOverview event={page.event} clubId={clubId} reviews={page.reviews} />
		</>
	);
}
