import { ReviewsOverviewClient } from "@/components/overviews/reviews/reviews-overview-client";
import apiServer from "@/lib/api/api";
import { isFeatureEnabled } from "@/lib/feature-flags";

interface ReviewsOverviewProps {
	type: "club" | "event" | "user";
	typeId: string;
	entityName: string;
	isMember?: boolean;
}

export async function ReviewsOverview({ type, typeId, entityName, isMember }: ReviewsOverviewProps) {
	// Check if reviews feature is enabled (from backend database)
	const reviewsEnabled = await isFeatureEnabled("REVIEWS");
	if (!reviewsEnabled) {
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
		return null;
	}

	const reviews = data.reviews;

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
