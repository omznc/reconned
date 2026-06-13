import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ReviewsTable } from "@/app/[locale]/dashboard/(platform)/admin/reviews/_components/reviews-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminReview = ApiResponse<"/api/admin/reviews", "get">["reviews"][number];

interface PageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
	params: Promise<{ locale: string }>;
}

export async function ReviewsPageFetcher(props: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const searchParams = await props.searchParams;
	const { page, perPage, type } = searchParams;
	const currentPage = Math.max(1, Number(page || 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data: listData } = await apiServer.GET("/api/admin/reviews", {
		params: {
			query: {
				page: currentPage,
				perPage: pageSize,
				...(type ? { type: type as "USER" | "CLUB" | "EVENT" } : {}),
			},
		},
	});

	const reviews = (listData?.reviews || []) as AdminReview[];
	const totalPages = listData?.pagination.totalPages || 0;

	return <ReviewsTable reviews={reviews} totalPages={totalPages} />;
}

export default async function ReviewsPage(props: PageProps) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	const dataKey = JSON.stringify({
		page: searchParams.page,
		perPage: searchParams.perPage,
		type: searchParams.type,
	});

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Review Management")}</h3>
			</div>
			<Suspense key={dataKey} fallback={<GenericDataTableSkeleton />}>
				<ReviewsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
