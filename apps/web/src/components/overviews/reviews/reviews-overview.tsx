import { ReviewsOverviewClient } from "@/components/overviews/reviews/reviews-overview-client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

interface ReviewsOverviewProps {
	type: "club" | "event" | "user";
	typeId: string;
	entityName: string;
	isMember?: boolean;
	/**
	 * Loaded by the route loader: fetch `/api/reviews/{type}/{id}` only when the `REVIEWS` flag is on.
	 * `undefined` renders nothing.
	 */
	reviews: ApiResponse<"/api/reviews/{type}/{id}", "get">["reviews"] | undefined;
}

export function ReviewsOverview({ type, typeId, entityName, isMember, reviews }: ReviewsOverviewProps) {
	if (!reviews) {
		return null;
	}

	const averageRating =
		reviews.length > 0 ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length : 0;

	return (
		<ReviewsOverviewClient
			type={type}
			typeId={typeId}
			entityName={entityName}
			initialReviews={reviews}
			averageRating={averageRating}
			isMember={isMember}
		/>
	);
}
