import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { listSearchSchema, parseListSearch } from "@/lib/list-search";
import { ReviewsTable } from "@/routes/{-$locale}/dashboard/admin/reviews/-components/reviews-table";

type AdminReview = ApiResponse<"/api/admin/reviews", "get">["reviews"][number];

const reviewsSearchSchema = listSearchSchema.extend({ type: z.string().optional() });

const getReviewsFn = createServerFn({ method: "GET" })
	.validator(reviewsSearchSchema)
	.handler(async ({ data }) => {
		const { currentPage, pageSize } = parseListSearch(data);
		const { data: listData } = await apiServer.GET("/api/admin/reviews", {
			params: {
				query: {
					page: currentPage,
					perPage: pageSize,
					...(data.type ? { type: data.type as "USER" | "CLUB" | "EVENT" } : {}),
				},
			},
		});
		return {
			reviews: (listData?.reviews || []) as AdminReview[],
			totalPages: listData?.pagination.totalPages || 0,
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/reviews/")({
	validateSearch: reviewsSearchSchema,
	loaderDeps: ({ search }) => ({ page: search.page, perPage: search.perPage, type: search.type }),
	loader: ({ deps }) => getReviewsFn({ data: deps }),
	pendingComponent: GenericDataTableSkeleton,
	notFoundComponent: NotFoundPage,
	component: ReviewsPage,
});

function ReviewsPage() {
	const t = useExtracted();
	const { reviews, totalPages } = Route.useLoaderData();

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Review Management")}</h3>
			</div>
			<ReviewsTable reviews={reviews} totalPages={totalPages} />
		</>
	);
}
