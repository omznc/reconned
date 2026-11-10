import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { RulesForm } from "@/routes/{-$locale}/dashboard/$clubId/events/rules/-components/rules.form";

const getRulesFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { data: rules } = await apiServer.GET("/api/clubs/{id}/rules", { params: { path: { id: data.clubId } } });
		return rules?.rules || [];
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/events/rules/")({
	validateSearch: z.object({ ruleId: z.coerce.string().optional() }),
	loader: async ({ params }) => ({ rules: await getRulesFn({ data: { clubId: params.clubId } }) }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: RulesPage,
});

function RulesPage() {
	const { clubId } = Route.useParams();
	const search = Route.useSearch();
	const { rules } = Route.useLoaderData();
	const editingRule = search.ruleId ? rules.find((rule) => rule.id === search.ruleId) || null : null;

	return <RulesForm key={JSON.stringify(search)} rules={rules} clubId={clubId} editingRule={editingRule} />;
}
