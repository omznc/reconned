import type { ListingCardVariant } from "@/components/listing-card";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ListingCardSkeletonProps {
	type: "club" | "user" | "event";
	variant?: ListingCardVariant;
}

export function ListingCardSkeleton({ type, variant = "card" }: ListingCardSkeletonProps) {
	// A row's placeholder has to be a row too — otherwise the list jumps a full
	// card height the moment the data lands.
	if (type === "user" || variant === "row") {
		return (
			<div className="block self-start">
				<Card className="overflow-hidden border-border/50">
					<div className="flex items-center gap-3 p-3">
						<Skeleton className={cn("size-12 shrink-0", type === "user" ? "rounded-full" : "rounded-lg")} />
						<div className="min-w-0 flex-1 space-y-1.5">
							<Skeleton className="h-4 w-1/2" />
							<Skeleton className="h-3 w-1/3" />
							<Skeleton className="h-3 w-2/3" />
						</div>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="block">
			<Card className="overflow-hidden border-border/50 h-full">
				<div className="flex flex-col h-full">
					<div className="relative bg-muted overflow-hidden">
						{type === "event" ? (
							<Skeleton className="w-full aspect-video" />
						) : (
							<Skeleton className="w-full aspect-square" />
						)}
					</div>

					<CardHeader className="p-3 pb-1">
						<Skeleton className="h-4 w-3/4 mb-0.5" />
						<Skeleton className="h-3 w-full mt-1" />
					</CardHeader>

					<div className="px-3 pb-3 pt-0">
						<div className="flex items-center gap-2">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-16" />
						</div>
						<div className="flex gap-1 mt-2">
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-4 w-16" />
						</div>
					</div>
				</div>
			</Card>
		</div>
	);
}
