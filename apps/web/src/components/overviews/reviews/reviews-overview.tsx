import { format } from "date-fns";
import { Star } from "lucide-react";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { ReviewsOverviewSheet } from "@/components/overviews/reviews/reviews-overview-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import apiServer from "@/lib/api/api";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { cn } from "@/lib/utils";

interface ReviewsOverviewProps {
	type: "club" | "event" | "user";
	typeId: string;
}

export async function ReviewsOverview({ type, typeId }: ReviewsOverviewProps) {
	const t = await getExtracted();

	if (!FEATURE_FLAGS.REVIEWS) {
		return;
	}

	// Fetch reviews from backend API
	const { data, error } = await apiServer.GET("/api/reviews/{type}/{id}", {
		params: {
			path: {
				type,
				id: typeId,
			},
		},
	});

	if (error || !data) {
		return notFound();
	}

	const reviews = data.reviews;

	const averageRating =
		reviews.length > 0 ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length : 0;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle>{t("Ratings")}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-1">
						{[1, 2, 3, 4, 5].map((star) => (
							<Star
								key={star}
								className={cn(
									"h-6 w-6",
									star <= averageRating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted",
								)}
							/>
						))}
						<span className="ml-2 text-sm text-muted-foreground">({reviews.length})</span>
					</div>

					{reviews.length > 0 ? (
						<>
							<h2 className="text-lg font-semibold">{t("Latest ratings")}</h2>
							<div className="flex flex-col md:flex-row gap-4 items-start justify-between">
								{reviews?.slice(0, 3).map((review) => (
									<div key={review.id} className="space-y-1">
										<div className="flex items-center gap-1">
											{[1, 2, 3, 4, 5].map((star) => (
												<Star
													key={star}
													className={cn(
														"h-4 w-4",
														star <= review.rating
															? "fill-yellow-400 text-yellow-400"
															: "fill-muted text-muted",
													)}
												/>
											))}
										</div>
										<p className="text-sm">
											{review.content?.slice(0, 50)}
											{review.content.length > 50 ? "(...)" : ""}
										</p>
										<p className="text-xs text-muted-foreground">
											{format(review.createdAt, "dd.MM.yyyy")}
										</p>
									</div>
								))}
							</div>

							<ReviewsOverviewSheet
								reviews={reviews}
								title={
									{
										club: t("club"),
										event: t("event"),
										user: t("the user"),
									}[type]
								}
							/>
						</>
					) : (
						<p className="text-sm text-muted-foreground">{t("There are no ratings")}</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
