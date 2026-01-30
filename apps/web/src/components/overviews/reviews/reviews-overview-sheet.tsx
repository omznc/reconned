"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Filter, Star } from "lucide-react";
import { useExtracted } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { useState } from "react";
import { Pagination } from "@/app/[locale]/(public)/_components/pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";
import { Link } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { cn } from "@/lib/utils";

type Review = {
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
};

interface ReviewsOverviewSheetProps {
	type: "user" | "club" | "event";
	entityId: string;
	entityName: string;
	initialReviews: Review[];
	initialTotal: number;
	title: string;
}

export function ReviewsOverviewSheet({
	type,
	entityId,
	entityName,
	initialReviews,
	initialTotal,
	title,
}: ReviewsOverviewSheetProps) {
	const t = useExtracted();
	const [isOpen, setIsOpen] = useState(false);
	const perPage = 10;

	// Use URL query params for pagination and filtering
	const [page, _setPage] = useQueryState("reviewPage", parseAsInteger.withDefault(1).withOptions({ shallow: false }));
	const [ratingFilter, setRatingFilter] = useQueryState(
		"reviewRating",
		parseAsInteger.withOptions({ shallow: false }),
	);

	// Fetch reviews with React Query
	const { data, isLoading } = useQuery({
		queryKey: ["reviews", type, entityId, page, ratingFilter],
		queryFn: async () => {
			const query: {
				page: number;
				perPage: number;
				rating?: number;
			} = {
				page,
				perPage,
			};

			if (ratingFilter !== undefined && ratingFilter !== null) {
				query.rating = ratingFilter;
			}

			const { data, error } = await apiClient.GET("/api/reviews/{type}/{id}", {
				params: {
					path: {
						type,
						id: entityId,
					},
					query,
				},
			});

			if (error) {
				throw error;
			}

			return data;
		},
		enabled: isOpen, // Only fetch when credenza is open
		initialData: isOpen
			? undefined
			: {
					reviews: initialReviews,
					pagination: {
						page: 1,
						perPage,
						total: initialTotal,
						totalPages: Math.ceil(initialTotal / perPage),
					},
				},
	});

	const reviews = data?.reviews || initialReviews;
	const total = data?.pagination.total ?? initialTotal;

	const handleRatingFilter = (rating: number | undefined | null) => {
		setRatingFilter(rating ?? null);
	};

	const averageRating = data
		? reviews.length > 0
			? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
			: "0.0"
		: initialReviews.length > 0
			? (initialReviews.reduce((sum, review) => sum + review.rating, 0) / initialReviews.length).toFixed(1)
			: "0.0";

	const totalPages = Math.ceil(total / perPage);

	return (
		<Credenza open={isOpen} onOpenChange={setIsOpen}>
			<CredenzaTrigger asChild>
				<Button variant="outline" className="w-fit">
					{t("Show all reviews")}
				</Button>
			</CredenzaTrigger>

			<CredenzaContent className="max-w-3xl">
				<CredenzaHeader>
					<CredenzaTitle className="flex items-center justify-between">
						<span>{title}</span>
						<Badge variant="secondary" className="flex items-center gap-1">
							<Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
							<span className="text-sm font-semibold">{averageRating}</span>
							<span className="text-muted-foreground">({total})</span>
						</Badge>
					</CredenzaTitle>
					<CredenzaDescription>{t("All reviews for {name}", { name: entityName })}</CredenzaDescription>
				</CredenzaHeader>

				<CredenzaBody className="space-y-6">
					{/* Star Filter */}
					<div className="flex items-center gap-2 flex-wrap">
						<Filter className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm text-muted-foreground">{t("Filter by rating")}:</span>
						<div className="flex gap-1">
							<Button
								variant={ratingFilter === undefined || ratingFilter === null ? "default" : "outline"}
								size="sm"
								onClick={() => handleRatingFilter(null)}
							>
								{t("All")}
							</Button>
							{[5, 4, 3, 2, 1].map((stars) => (
								<Button
									key={stars}
									variant={ratingFilter === stars ? "default" : "outline"}
									size="sm"
									onClick={() => handleRatingFilter(stars)}
									className="gap-1"
								>
									{stars}
									<Star className="h-3 w-3" />
								</Button>
							))}
						</div>
					</div>

					{/* Reviews List */}
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-muted-foreground">{t("Loading...")}</div>
						</div>
					) : reviews.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<Star className="h-12 w-12 text-muted-foreground mb-2" />
							<p className="text-muted-foreground">{t("No reviews yet")}</p>
						</div>
					) : (
						<div className="space-y-6">
							{reviews.map((review) => (
								<div key={review.id} className="space-y-3 pb-4 border-b last:border-b-0">
									{/* Author Info and Rating */}
									<div className="flex items-start justify-between gap-4">
										<div className="flex items-center gap-3">
											{review.author ? (
												<Link
													href={`/users/${review.author.slug || review.author.id}`}
													className="flex items-center gap-3"
												>
													<Avatar className="h-8 w-8">
														<AvatarImage src={review.author.image || undefined} />
														<AvatarFallback name={review.author.name} />
													</Avatar>
												</Link>
											) : (
												<Avatar className="h-8 w-8">
													<AvatarFallback className="bg-muted">
														<span className="text-muted-foreground text-xs">?</span>
													</AvatarFallback>
												</Avatar>
											)}
											<div className="flex flex-col">
												{review.author ? (
													<Link
														href={`/users/${review.author.slug || review.author.id}`}
														className="font-medium hover:underline text-sm"
													>
														{review.author.name}
													</Link>
												) : (
													<span className="font-medium text-sm text-muted-foreground">
														{t("Anonymous")}
													</span>
												)}
												<span className="text-xs text-muted-foreground">
													{format(new Date(review.createdAt), "dd.MM.yyyy")}
												</span>
											</div>
										</div>
										<div className="flex items-center gap-0.5">
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
									</div>

									{/* Review Content */}
									<p className="text-sm leading-relaxed whitespace-pre-wrap">{review.content}</p>
								</div>
							))}
						</div>
					)}

					{/* Pagination */}
					{totalPages > 1 && (
						<Pagination totalItems={total} itemsPerPage={perPage} siblingsCount={1} paramKey="reviewPage" />
					)}
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
