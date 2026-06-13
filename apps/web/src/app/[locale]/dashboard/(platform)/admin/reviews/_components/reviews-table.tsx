"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Star, Trash2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { GenericDataTable } from "@/components/generic-data-table";
import { ReviewEditHistory } from "@/components/overviews/reviews/review-edit-history";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";

interface AdminReview {
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
	author: { id: string; slug: string | null; name: string; image: string | null } | null;
	target: { id: string; name: string; slug: string | null } | null;
	editCount: number;
}

interface ReviewsTableProps {
	reviews: AdminReview[];
	totalPages: number;
}

export function ReviewsTable(props: ReviewsTableProps) {
	const t = useExtracted();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const router = useRouter();
	const [historyReviewId, setHistoryReviewId] = useState<string | null>(null);
	const [filterType, setFilterType] = useQueryState("type", { shallow: false });

	const typeFilters: Array<{ label: string; value: string | null }> = [
		{ label: t("All"), value: null },
		{ label: t("User"), value: "USER" },
		{ label: t("Club"), value: "CLUB" },
		{ label: t("Event"), value: "EVENT" },
	];

	const deleteMutation = useMutation({
		mutationFn: async (reviewId: string) => {
			const { error } = await apiClient.DELETE("/api/admin/reviews/{id}", {
				params: { path: { id: reviewId } },
			});
			if (error) throw error;
		},
		onSuccess: () => {
			toast.success(t("Review deleted successfully"));
			queryClient.invalidateQueries({ queryKey: [["admin", "reviews"]] });
			router.refresh();
		},
		onError: () => {
			toast.error(t("Failed to delete review"));
		},
	});

	const handleDelete = async (reviewId: string) => {
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
			<div className="flex items-center gap-2 mb-4">
				<span className="text-sm font-medium text-muted-foreground">{t("Filter by type:")}</span>
				<div className="flex gap-1">
					{typeFilters.map((filter) => (
						<Button
							key={filter.value || "all"}
							variant={filterType === filter.value ? "default" : "outline"}
							size="sm"
							onClick={() => setFilterType(filter.value)}
						>
							{filter.label}
						</Button>
					))}
				</div>
			</div>
			<GenericDataTable
				data={props.reviews}
				totalPages={props.totalPages}
				columns={[
					{
						key: "type",
						header: t("Type"),
						cellConfig: {
							variant: "badge",
							valueMap: {
								USER: t("User"),
								CLUB: t("Club"),
								EVENT: t("Event"),
							},
							badgeVariants: {
								USER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
								CLUB: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
								EVENT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
							},
						},
					},
					{
						key: "author",
						header: t("Author"),
						cellConfig: {
							variant: "custom",
							component: (_value: unknown, review: AdminReview) =>
								review.author ? (
									<Link
										href={`/users/${review.author.slug || review.author.id}`}
										className="text-sm font-medium hover:underline"
									>
										{review.author.name}
									</Link>
								) : (
									<span className="text-sm text-muted-foreground">{t("Deleted")}</span>
								),
						},
					},
					{
						key: "target",
						header: t("Target"),
						cellConfig: {
							variant: "custom",
							component: (_value: unknown, review: AdminReview) =>
								review.target ? (
									<Link
										href={
											review.type === "USER"
												? `/users/${review.target.slug || review.target.id}`
												: review.type === "CLUB"
													? `/dashboard/${review.target.id}/club`
													: `/dashboard/${review.clubId}/events`
										}
										className="text-sm font-medium hover:underline"
									>
										{review.target.name}
									</Link>
								) : (
									<span className="text-sm text-muted-foreground">{t("Deleted")}</span>
								),
						},
					},
					{
						key: "rating",
						header: t("Rating"),
						cellConfig: {
							variant: "custom",
							component: (_value: unknown, review: AdminReview) => (
								<div className="flex items-center gap-0.5">
									{[1, 2, 3, 4, 5].map((star) => (
										<Star
											key={star}
											className={`h-3.5 w-3.5 ${
												star <= review.rating
													? "fill-yellow-400 text-yellow-400"
													: "fill-muted text-muted-foreground"
											}`}
										/>
									))}
								</div>
							),
						},
					},
					{
						key: "content",
						header: t("Content"),
						cellConfig: {
							variant: "custom",
							component: (_value: unknown, review: AdminReview) => (
								<p className="text-sm text-muted-foreground truncate max-w-[200px]">{review.content}</p>
							),
						},
					},
					{
						key: "createdAt",
						header: t("Date"),
						cellConfig: {
							variant: "custom",
							component: (_value: unknown, review: AdminReview) => (
								<span className="text-sm text-muted-foreground">
									{format(new Date(review.createdAt), "MMM dd, yyyy")}
								</span>
							),
						},
					},
					{
						key: "actions",
						header: t("Actions"),
						cellConfig: {
							variant: "custom",
							components: (review: AdminReview) => [
								...(review.editCount > 0
									? [
											<DropdownMenuItem
												key="history"
												onClick={() => setHistoryReviewId(review.id)}
											>
												<span className="text-sm">{t("History")}</span>
											</DropdownMenuItem>,
										]
									: []),
								<DropdownMenuItem key="delete" onClick={() => handleDelete(review.id)}>
									<Trash2 className="size-4 mr-2 text-destructive" />
									<span className="text-destructive">{t("Delete")}</span>
								</DropdownMenuItem>,
							],
						},
					},
				]}
			/>
			{historyReviewId && (
				<ReviewEditHistory
					reviewId={historyReviewId}
					open
					onOpenChange={(open) => {
						if (!open) setHistoryReviewId(null);
					}}
				/>
			)}
		</>
	);
}
