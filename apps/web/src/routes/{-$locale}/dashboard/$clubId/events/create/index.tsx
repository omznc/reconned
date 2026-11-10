import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { parse as parseDateFns } from "date-fns";
import * as z from "zod";
import { NoAccessPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { serializable } from "@/routes/{-$locale}/dashboard/$clubId/-lib/serializable";
import CreateEventForm from "@/routes/{-$locale}/dashboard/$clubId/events/create/-components/events.form";

const getCreateEventFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string(), id: z.string().optional() }))
	.handler(async ({ data }) => {
		const [event, rules] = await Promise.all([
			data.id ? apiServer.GET("/api/events/{id}", { params: { path: { id: data.id } } }) : null,
			apiServer.GET("/api/clubs/{id}/rules", { params: { path: { id: data.clubId } } }),
		]);
		return serializable({ event: event?.data?.event ?? null, rules: rules.data?.rules || [] });
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/events/create/")({
	validateSearch: z.object({ id: z.coerce.string().optional(), date: z.coerce.string().optional() }),
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps, context }) => {
		if (!context.access.isManager) {
			return { kind: "forbidden" as const };
		}
		const page = await getCreateEventFn({ data: { clubId: params.clubId, id: deps.search.id } });
		const parsedDate = deps.search.date ? parseDateFns(deps.search.date, "yyyy-MM-dd", new Date()) : null;
		const prefillDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
		return { kind: "ok" as const, ...page, prefillDate };
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: CreateEventPage,
});

function CreateEventPage() {
	const page = Route.useLoaderData();

	if (page.kind === "forbidden") {
		return <NoAccessPage />;
	}
	return <CreateEventForm event={page.event} rules={page.rules} prefillDate={page.prefillDate} />;
}
