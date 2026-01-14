import { Plus } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { FeatureFlagForm } from "@/app/[locale]/dashboard/(platform)/admin/feature-flags/_components/feature-flag-form";
import { FeatureFlagTable } from "@/app/[locale]/dashboard/(platform)/admin/feature-flags/_components/feature-flag-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type FeatureFlag = ApiResponse<"/api/admin/feature-flags", "get">["featureFlags"][number];

export async function FeatureFlagsPageFetcher(props: PageProps<"/[locale]/dashboard/admin/feature-flags">) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, flagId, perPage } = searchParams;
	const currentPage = Math.max(1, Number(page || 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data: listData } = await apiServer.GET("/api/admin/feature-flags", {
		params: {
			query: {
				page: currentPage,
				perPage: pageSize,
				...(search ? { search: search as string } : {}),
				...(sortBy ? { sortBy: sortBy as "name" | "createdAt" } : {}),
				sortOrder: sortOrder === "asc" ? "asc" : "desc",
			},
		},
	});

	const featureFlags = (listData?.featureFlags || []) as FeatureFlag[];
	const totalFlags = listData?.pagination.total || 0;

	const selectedFlag = flagId
		? (
				await apiServer.GET("/api/admin/feature-flags/{id}", {
					params: { path: { id: flagId as string } },
				})
			).data
		: undefined;

	return (
		<>
			{(flagId === "new" || selectedFlag) && <FeatureFlagForm flag={selectedFlag || undefined} />}
			<FeatureFlagTable featureFlags={featureFlags} totalFlags={totalFlags} pageSize={pageSize} />
		</>
	);
}

export default async function FeatureFlagsPage(props: PageProps<"/[locale]/dashboard/admin/feature-flags">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	const dataKey = JSON.stringify({
		search: searchParams.search,
		sortBy: searchParams.sortBy,
		sortOrder: searchParams.sortOrder,
		page: searchParams.page,
		perPage: searchParams.perPage,
	});

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
						<Plus className="size-4 mr-2" />
						{t("Create flag")}
					</Link>
				</Button>
			</div>
			<Suspense key={dataKey} fallback={<GenericDataTableSkeleton />}>
				<FeatureFlagsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
