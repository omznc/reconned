import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ReviewsOverviewSheet } from "@/components/overviews/reviews/reviews-overview-sheet";
import { format } from "date-fns";

interface ReviewsOverviewProps {
	type: "club" | "event" | "user";
	typeId: string;
}

export async function ReviewsOverview({ type, typeId }: ReviewsOverviewProps) {
	// Fetch reviews based on type
	let reviews;
	switch (type) {
		case "club": {
			const club = await prisma.review.findMany({
				where: { clubId: typeId },
				include: {
					author: {
						select: {
							name: true,
							image: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});
			reviews = club;
			break;
		}
		case "event": {
			const event = await prisma.review.findMany({
				where: { eventId: typeId },
				include: {
					author: {
						select: {
							name: true,
							image: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});
			reviews = event;
			break;
		}
		case "user": {
			const user = await prisma.review.findMany({
				where: { userId: typeId },
				include: {
					author: {
						select: {
							name: true,
							image: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			});
			reviews = user;
			break;
		}
		default:
			return notFound();
	}

	const title =
		type === "club" ? "klub" : type === "event" ? "susret" : "korisnik";

	const averageRating =
		reviews.length > 0
			? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
			: 0;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle>Ocjene</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-1">
						{[1, 2, 3, 4, 5].map((star) => (
							<Star
								key={star}
								className={`h-6 w-6 ${
									star <= averageRating
										? "fill-yellow-400 text-yellow-400"
										: "fill-muted text-muted"
								}`}
							/>
						))}
						<span className="ml-2 text-sm text-muted-foreground">
							({reviews.length})
						</span>
					</div>

					{reviews.length > 0 ? (
						<>
							<h2 className="text-lg font-semibold">Najnovije ocjene</h2>
							<div className="flex flex-col md:flex-row gap-4 items-start justify-between">
								{reviews?.slice(0, 3).map((review) => (
									<div key={review.id} className="space-y-1">
										<div className="flex items-center gap-1">
											{[1, 2, 3, 4, 5].map((star) => (
												<Star
													key={star}
													className={`h-4 w-4 ${
														star <= review.rating
															? "fill-yellow-400 text-yellow-400"
															: "fill-muted text-muted"
													}`}
												/>
											))}
										</div>
										<p className="text-sm">
											{review.content?.slice(0, 50)}
											{review.content.length > 50 ? "(...)" : ""}
										</p>
										<p className="text-xs text-muted-foreground">
											{review.author.name} •{" "}
											{format(review.createdAt, "dd.MM.yyyy")}
										</p>
									</div>
								))}
							</div>

							<ReviewsOverviewSheet reviews={reviews} title={title} />
						</>
					) : (
						<p className="text-sm text-muted-foreground">Nema ocjena</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
