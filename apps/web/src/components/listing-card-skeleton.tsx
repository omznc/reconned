import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ListingCardSkeletonProps {
	type: "club" | "user" | "event";
}

export function ListingCardSkeleton({ type }: ListingCardSkeletonProps) {
	return (
		<div className="block">
			<Card className="overflow-hidden border-border/50 h-full">
				<div className="flex flex-col h-full">
					<div className="relative bg-muted overflow-hidden">
						{type === "user" ? (
							<div className="w-full aspect-square">
								<Skeleton className="w-full h-full" />
							</div>
						) : type === "event" ? (
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
