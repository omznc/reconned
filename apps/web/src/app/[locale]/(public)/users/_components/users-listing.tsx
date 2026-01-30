"use client";

import { useQuery } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { SearchResultCardSkeleton } from "@/app/[locale]/(public)/search/_components/search-result-card-skeleton";
import { AdminIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

const ITEMS_PER_PAGE = 12;

type UsersResponse = ApiResponse<"/api/users", "get">;

interface UsersListingProps {
	initialData: UsersResponse;
}

export function UsersListing({ initialData }: UsersListingProps) {
	const t = useExtracted();
	const [page, setPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(1).withOptions({
			shallow: true,
			history: "replace",
		}),
	);

	const { data, isLoading } = useQuery<UsersResponse>({
		queryKey: ["users", "list", page],
		queryFn: async () => {
			const { data, error } = await apiClient.GET("/api/users", {
				params: {
					query: {
						page: String(page),
						perPage: String(ITEMS_PER_PAGE),
						sort: "admin",
					},
				},
			});
			if (error || !data) {
				throw new Error("Failed to load users");
			}
			return data;
		},
		initialData: page === 1 ? initialData : undefined,
		placeholderData: (previousData) => previousData,
	});

	const users = data?.users || [];
	const pagination = data?.pagination || initialData.pagination;
	const totalPages = pagination.totalPages;

	return (
		<div className="container max-w-7xl py-8 px-4 space-y-8">
			<div className="space-y-6">
				<h1 className="text-3xl font-bold tracking-tight">{t("Players")}</h1>

				{isLoading && users.length === 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
							<SearchResultCardSkeleton key={i} type="user" />
						))}
					</div>
				) : users.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground">
						<p>{t("No users found")}</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{users.map((user) => (
							<SearchResultCard
								key={user.id}
								type="user"
								image={user.image}
								name={user.name}
								title={
									<span className="flex gap-2 items-center">
										{user.name}
										{user.isAdmin && <AdminIcon />}
									</span>
								}
								description={user.callsign}
								href={`/users/${user.slug || user.id}`}
								meta={user.location || undefined}
							/>
						))}
					</div>
				)}
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage(page - 1)}
						disabled={page <= 1 || isLoading}
					>
						←
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
					>
						→
					</Button>
				</div>
			)}
		</div>
	);
}
