"use client";

import LeaveReview from "@public/errors/leave-review.png";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ReviewEditHistory } from "@/components/overviews/reviews/review-edit-history";
import { ReviewModal } from "@/components/overviews/reviews/review-modal";
import { ReviewsOverviewSheet } from "@/components/overviews/reviews/reviews-overview-sheet";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { useIsAuthenticated } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface Review {
	id: string;
	type: "USER" | "CLUB" | "EVENT";
	rating: number;
	content: string;
	authorId: string;
	userId: string | null;
	clubId: string | null;
	eventId: string | null;
	createdAt: string;
	updatedAt: string;
	author: {
		id: string;
		slug: string | null;
		name: string;
		image: string | null;
	} | null;
}

interface DisplayReview extends Omit<Review, "createdAt" | "updatedAt"> {
	createdAt: Date;
	updatedAt: Date;
}

interface ReviewsOverviewClientProps {
	type: "club" | "event" | "user";
	typeId: string;
	entityName: string;
	initialReviews: Review[];
	averageRating: number;
	isMember?: boolean;
}

export function ReviewsOverviewClient({
	type,
	typeId,
	entityName,
	initialReviews,
	averageRating,
	isMember,
}: ReviewsOverviewClientProps) {
	const t = useExtracted();
	const { user } = useIsAuthenticated();
	const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
	const [editingReview, setEditingReview] = useState<DisplayReview | null>(null);
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const router = useRouter();

	const isReviewDisabled = (() => {
		if (!user) return false;
		if (type === "user" && user.id === typeId) return true;
		if (type === "club" && isMember) return true;
		return false;
	})();

	const reviews: DisplayReview[] = initialReviews.map((review) => ({
		...review,
		createdAt: new Date(review.createdAt),
		updatedAt: new Date(review.updatedAt),
	}));

	const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
		star,
		count: reviews.filter((r) => r.rating === star).length,
	}));

	const totalReviews = reviews.length;

	const deleteMutation = useMutation({
		mutationFn: async (reviewId: string) => {
			const { error } = await apiClient.DELETE("/api/reviews/{id}", {
				params: { path: { id: reviewId } },
			});
			if (error) throw error;
		},
		onSuccess: () => {
			toast.success(t("Review deleted successfully"));
			queryClient.invalidateQueries({ queryKey: [["reviews", type, typeId]] });
			router.refresh();
		},
		onError: () => {
			toast.error(t("Failed to delete review"));
		},
	});

	const handleDeleteReview = async (reviewId: string) => {
		const confirmed = await confirm({
			title: t("Delete review"),
			body: t("Are you sure you want to delete this review? This action cannot be undone."),
			cancelButton: t("Cancel"),
			actionButton: t("Delete"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) return;
		deleteMutation.mutate(reviewId);
	};

	return (
		<>
			<Card className="overflow-hidden">
				<CardHeader className="border-b">
					<div className="flex items-start justify-between">
						<div className="flex flex-col gap-2">
							<CardTitle className="text-xl">{t("Ratings & Reviews")}</CardTitle>
							<p className="text-sm text-muted-foreground mt-1">
								{totalReviews} {totalReviews === 1 ? t("review") : t("reviews")}
							</p>
						</div>
						{user && !isReviewDisabled && (
							<Button size="sm" onClick={() => setIsReviewModalOpen(true)}>
								<Star className="h-4 w-4 mr-1" />
								{t("Write Review")}
							</Button>
						)}
					</div>
				</CardHeader>

				{totalReviews > 0 ? (
					<CardContent className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
							<div className="flex flex-col items-center justify-center p-6 bg-muted rounded-lg">
								<div className="text-6xl font-bold text-primary mb-2">{averageRating.toFixed(1)}</div>
								<div className="flex items-center gap-1 mb-2">
									{[1, 2, 3, 4, 5].map((star) => (
										<Star
											key={star}
											className={cn(
												"h-5 w-5",
												star <= averageRating
													? "fill-yellow-400 text-yellow-400"
													: "fill-muted text-muted-foreground",
											)}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									{totalReviews} {totalReviews === 1 ? t("review") : t("reviews")}
								</p>
							</div>

							<div className="flex flex-col justify-center space-y-3">
								{ratingDistribution.map(({ star, count }) => {
									const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
									return (
										<div key={star} className="flex items-center">
											<div className="flex items-center gap-1 w-8 shrink-0">
												<span className="text-sm font-medium">{star}</span>
												<Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
											</div>
											<div className="flex-1 w-full">
												<Progress value={percentage} className="h-2.5 bg-muted" />
											</div>
											<div className="w-8 shrink-0 text-right">
												<span className="text-sm text-muted-foreground">{count}</span>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<Separator className="my-6" />

						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-semibold">{t("Latest Reviews")}</h3>
								{reviews.length > 3 && (
									<ReviewsOverviewSheet
										type={type}
										entityId={typeId}
										entityName={entityName}
										initialReviews={initialReviews}
										initialTotal={reviews.length}
										title={
											{
												club: t("club"),
												event: t("event"),
												user: t("the user"),
											}[type]
										}
									/>
								)}
							</div>

							<div className="grid gap-6">
								{reviews.slice(0, 3).map((review, index) => {
									const isOwner = user?.id === review.authorId;
									const isEdited = review.updatedAt !== review.createdAt;

									return (
										<div key={review.id} className="group relative">
											<div className="flex gap-4">
												{review.author ? (
													<Link
														href={`/users/${review.author.slug || review.author.id}`}
														className="flex-shrink-0"
													>
														<Avatar className="h-12 w-12 border-2 border-background shadow-sm hover:ring-2 hover:ring-primary transition-all">
															<AvatarImage
																src={review.author.image || undefined}
																alt={review.author.name}
															/>
															<AvatarFallback
																name={review.author.name}
																className="bg-primary/10 text-sm font-semibold"
															/>
														</Avatar>
													</Link>
												) : (
													<Avatar className="h-12 w-12 shrink-0 border-2 border-background shadow-sm">
														<AvatarFallback className="bg-muted text-sm font-semibold">
															U
														</AvatarFallback>
													</Avatar>
												)}

												<div className="flex-1 space-y-2">
													<div className="flex items-start justify-between gap-4">
														<div>
															<div className="flex items-center gap-2">
																{review.author ? (
																	<Link
																		href={`/users/${review.author.slug || review.author.id}`}
																		className="font-semibold text-sm hover:underline"
																	>
																		{review.author.name}
																	</Link>
																) : (
																	<h4 className="font-semibold text-sm">
																		{t("Anonymous")}
																	</h4>
																)}
																<span className="text-xs text-muted-foreground">
																	{format(review.createdAt, "MMM dd, yyyy")}
																</span>
																{isEdited && (
																	<span className="text-xs text-muted-foreground italic">
																		({t("edited")})
																	</span>
																)}
															</div>
															<div className="flex items-center gap-1 mt-1">
																{[1, 2, 3, 4, 5].map((star) => (
																	<Star
																		key={star}
																		className={cn(
																			"h-3.5 w-3.5",
																			star <= review.rating
																				? "fill-yellow-400 text-yellow-400"
																				: "fill-muted text-muted-foreground",
																		)}
																	/>
																))}
															</div>
														</div>
														<div className="flex items-center gap-1 shrink-0">
															{isEdited && <ReviewEditHistory reviewId={review.id} />}
															{isOwner && (
																<>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-8 w-8 p-0"
																		onClick={() => setEditingReview(review)}
																	>
																		<Pencil className="size-3.5" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-8 w-8 p-0 text-destructive hover:text-destructive"
																		onClick={() => handleDeleteReview(review.id)}
																	>
																		<Trash2 className="size-3.5" />
																	</Button>
																</>
															)}
														</div>
													</div>

													<p className="text-sm text-muted-foreground leading-relaxed">
														{review.content}
													</p>
												</div>
											</div>

											{index < Math.min(reviews.length, 3) - 1 && (
												<Separator className="mt-6 ml-16" />
											)}
										</div>
									);
								})}

								{reviews.length === 0 && (
									<div className="text-center py-8 flex flex-col items-center justify-center">
										<Image
											src={LeaveReview}
											alt="No reviews"
											draggable={false}
											className="w-full max-w-[300px] dark:invert"
										/>
										<p className="mt-4 text-muted-foreground">{t("No reviews yet")}</p>
									</div>
								)}
							</div>

							{reviews.length > 3 && (
								<div className="pt-4">
									<ReviewsOverviewSheet
										type={type}
										entityId={typeId}
										entityName={entityName}
										initialReviews={initialReviews}
										initialTotal={reviews.length}
										title={
											{
												club: t("club"),
												event: t("event"),
												user: t("the user"),
											}[type]
										}
									/>
								</div>
							)}
						</div>
					</CardContent>
				) : (
					<CardContent className="p-12">
						<div className="text-center space-y-4">
							<Image
								src={LeaveReview}
								alt="No reviews"
								draggable={false}
								className="w-full max-w-[300px] mx-auto dark:invert"
							/>
							<div>
								<h3 className="font-semibold text-lg mb-2">{t("No reviews yet")}</h3>
								<p className="text-sm text-muted-foreground">
									{t("Be the first to share your experience")}
								</p>
							</div>
						</div>
					</CardContent>
				)}
			</Card>

			{!isReviewDisabled && (
				<ReviewModal
					open={isReviewModalOpen}
					onOpenChange={setIsReviewModalOpen}
					type={type.toUpperCase() as "USER" | "CLUB" | "EVENT"}
					entityId={typeId}
					entityName={entityName}
				/>
			)}

			{editingReview && (
				<ReviewModal
					open={!!editingReview}
					onOpenChange={(open) => {
						if (!open) setEditingReview(null);
					}}
					type={type.toUpperCase() as "USER" | "CLUB" | "EVENT"}
					entityId={typeId}
					entityName={entityName}
					existingReview={{
						id: editingReview.id,
						rating: editingReview.rating,
						content: editingReview.content,
					}}
				/>
			)}
		</>
	);
}
