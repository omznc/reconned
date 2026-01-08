import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SearchResultCardSkeletonProps {
	type: "club" | "user" | "event";
}

export function SearchResultCardSkeleton({ type }: SearchResultCardSkeletonProps) {
	return (
		<Card className="relative overflow-hidden border bg-sidebar h-full flex flex-col">
			<div
				className={cn("flex gap-4 flex-1", {
					"flex-col md:flex-row": type === "club" || type === "event",
					"flex-row": type === "user",
				})}
			>
				<div
					className={cn("relative shrink-0 overflow-hidden bg-muted", {
						"w-[100px] md:w-[150px] h-[100px] md:h-[150px] rounded-md md:border-r": type === "user",
						"w-full md:w-[150px] h-[200px] md:h-full md:border-r": type === "club" || type === "event",
					})}
				>
					<Skeleton className="w-full h-full" />
				</div>

				<div className="flex-1 p-4 pr-12 flex flex-col min-w-0 overflow-hidden">
					<Skeleton className="h-6 w-3/4 mb-2" />
					<Skeleton className="h-4 w-full mb-1" />
					<Skeleton className="h-4 w-5/6 mb-3" />
					<div className="flex flex-wrap items-center gap-2 mt-auto">
						<Skeleton className="h-5 w-16" />
						<Skeleton className="h-5 w-20" />
						<Skeleton className="h-4 w-24" />
					</div>
				</div>
			</div>
		</Card>
	);
}
