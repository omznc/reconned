"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import type { User } from "@prisma/client";

interface Review {
	id: string;
	rating: number;
	content: string;
	createdAt: Date;
	author: Pick<User, "name" | "image">;
}

interface ReviewsOverviewSheetProps {
	reviews: Review[];
	title: string;
}

export function ReviewsOverviewSheet({ reviews, title }: ReviewsOverviewSheetProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button variant="outline" className="w-fit">
					Prikaži sve ocjene
				</Button>
			</SheetTrigger>

			<SheetContent side="right" className="w-full sm:w-[540px]">
				<div className="h-full flex flex-col gap-4">
					<SheetHeader>
						<SheetTitle>Ocjene</SheetTitle>
						<SheetDescription>Sve ocjene za {title}</SheetDescription>
					</SheetHeader>
					<div className="flex-1 overflow-y-auto">
						<div className="space-y-4">
							{reviews.map((review) => (
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
									<p className="text-sm">{review.content}</p>
									<p className="text-xs text-muted-foreground">
										{review.author.name} • {format(review.createdAt, "dd.MM.yyyy")}
									</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
