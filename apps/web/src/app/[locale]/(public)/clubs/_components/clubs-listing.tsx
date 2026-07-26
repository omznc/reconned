"use client";

import NoResults from "@public/errors/no-results.png";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { ListingCard } from "@/components/listing-card";
import { ListingCardSkeleton } from "@/components/listing-card-skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

const ITEMS_PER_PAGE = 12;

type ClubsResponse = ApiResponse<"/api/clubs", "get">;

interface ClubsListingProps {
	initialData: ClubsResponse;
}

export function ClubsListing({ initialData }: ClubsListingProps) {
	const t = useExtracted();
	const [page, setPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(1).withOptions({
			shallow: true,
			history: "replace",
		}),
	);

	const { data, isLoading } = useQuery<ClubsResponse>({
		queryKey: ["clubs", "list", page],
		queryFn: async () => {
			const { data, error } = await apiClient.GET("/api/clubs", {
				params: {
					query: {
						page: String(page),
						perPage: String(ITEMS_PER_PAGE),
					},
				},
			});
			if (error || !data) {
				throw new Error("Failed to load clubs");
			}
			return data;
		},
		initialData: page === 1 ? initialData : undefined,
		placeholderData: (previousData) => previousData,
	});

	const clubs = data?.clubs || [];
	const pagination = data?.pagination || initialData.pagination;
	const totalPages = pagination.totalPages;

	return (
		<div className="container max-w-7xl py-8 px-4">
			<div className="space-y-6">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h1 className="text-2xl font-bold tracking-tight">{t("Clubs")}</h1>
					<Link href="/clubs/city" className="text-sm underline underline-offset-4">
						{t("Browse by city")}
					</Link>
				</div>

				{isLoading && clubs.length === 0 ? (
					<div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
						{Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
							<ListingCardSkeleton key={i} type="club" />
						))}
					</div>
				) : clubs.length === 0 ? (
					<div className="text-center py-16 flex flex-col items-center justify-center">
						<Image
							src={NoResults}
							alt="No results"
							draggable={false}
							className="w-full max-w-[250px] dark:invert"
						/>
						<p className="mt-4 text-muted-foreground">{t("No clubs found")}</p>
					</div>
				) : (
					<div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
						{clubs.map((club) => (
							<ListingCard
								key={club.id}
								type="club"
								image={club.logo}
								title={club.name}
								description={club.description}
								href={`/clubs/${club.slug || club.id}`}
								verified={club.verified}
								memberCount={club._count.members}
								meta={club.location || undefined}
							/>
						))}
					</div>
				)}
			</div>
			<div className="min-h-[60px] flex items-center justify-center mt-8">
				{totalPages > 1 && (
					<div className="flex items-center justify-center gap-2">
						<Button
							variant="outline"
							size="icon"
							onClick={() => setPage(page - 1)}
							disabled={page <= 1 || isLoading}
							className="transition-all duration-200 hover:scale-110 active:scale-95"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<div className="flex items-center gap-1">
							{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
								let pageNum: number;
								if (totalPages <= 5) {
									pageNum = i + 1;
								} else if (page <= 3) {
									pageNum = i + 1;
								} else if (page >= totalPages - 2) {
									pageNum = totalPages - 4 + i;
								} else {
									pageNum = page - 2 + i;
								}
								return (
									<Button
										key={pageNum}
										variant={page === pageNum ? "default" : "outline"}
										size="icon"
										onClick={() => setPage(pageNum)}
										disabled={isLoading}
										className="transition-all duration-200 hover:scale-110 active:scale-95"
									>
										{pageNum}
									</Button>
								);
							})}
						</div>
						<Button
							variant="outline"
							size="icon"
							onClick={() => setPage(page + 1)}
							disabled={page >= totalPages || isLoading}
							className="transition-all duration-200 hover:scale-110 active:scale-95"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
