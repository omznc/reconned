import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { NotFoundPage } from "@/components/not-found-page";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { listDeps, listSearchSchema, parseListSearch } from "@/lib/list-search";
import { FeatureFlagForm } from "@/routes/{-$locale}/dashboard/admin/feature-flags/-components/feature-flag-form";
import { FeatureFlagTable } from "@/routes/{-$locale}/dashboard/admin/feature-flags/-components/feature-flag-table";

type FeatureFlag = ApiResponse<"/api/admin/feature-flags", "get">["featureFlags"][number];

const featureFlagsSearchSchema = listSearchSchema.extend({ flagId: z.union([z.string(), z.number()]).optional() });

const getFeatureFlagsPageFn = createServerFn({ method: "GET" })
	.validator(featureFlagsSearchSchema)
	.handler(async ({ data }) => {
		const { currentPage, pageSize, search, sortBy, sortOrder } = parseListSearch(data);

		const { data: listData } = await apiServer.GET("/api/admin/feature-flags", {
			params: {
				query: {
					page: currentPage,
					perPage: pageSize,
					...(search ? { search } : {}),
					...(sortBy ? { sortBy: sortBy as "name" | "createdAt" } : {}),
					sortOrder,
				},
			},
		});

		const selectedFlag = data.flagId
			? (
					await apiServer.GET("/api/admin/feature-flags/{id}", {
						params: { path: { id: String(data.flagId) } },
					})
				).data
			: undefined;

		return {
			featureFlags: (listData?.featureFlags || []) as FeatureFlag[],
			totalFlags: listData?.pagination.total || 0,
			pageSize,
			selectedFlag,
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/feature-flags/")({
	validateSearch: featureFlagsSearchSchema,
	loaderDeps: ({ search }) => ({ ...listDeps(search), flagId: search.flagId }),
	loader: ({ deps }) => getFeatureFlagsPageFn({ data: deps }),
	pendingComponent: GenericDataTableSkeleton,
	notFoundComponent: NotFoundPage,
	component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
	const t = useExtracted();
	const { featureFlags, totalFlags, pageSize, selectedFlag } = Route.useLoaderData();
	const { flagId } = Route.useSearch();

	return (
		<>
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">{t("Feature Flags")}</h3>
					<p className="text-sm text-muted-foreground">
						{t("Manage feature flags to control application features")}
					</p>
				</div>
				<Button asChild>
					<Link href="?flagId=new">
						<Plus className="size-4" />
						{t("Create flag")}
					</Link>
				</Button>
			</div>
			{(flagId === "new" || selectedFlag) && <FeatureFlagForm flag={selectedFlag || undefined} />}
			<FeatureFlagTable featureFlags={featureFlags} totalFlags={totalFlags} pageSize={pageSize} />
		</>
	);
}
