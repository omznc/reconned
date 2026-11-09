import { toIntlLocale } from "@/lib/intl-locale";

("use client");

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Star, Trash2 } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ReviewEditHistory } from "@/components/overviews/reviews/review-edit-history";
import { ReviewModal } from "@/components/overviews/reviews/review-modal";
import { Stars } from "@/components/profile/profile-shared";
import { SectionCard } from "@/components/redesign/section-card";
import type { Href } from "@/components/redesign/types";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { useIsAuthenticated } from "@/lib/auth-client";

type Review = ApiResponse<"/api/reviews/{type}/{id}", "get">["reviews"][number];

interface ProfileReviewsProps {
	type: "club" | "user";
	typeId: string;
	entityName: string;
	/** `undefined` hides the section: the `REVIEWS` flag is off. */
	reviews: Review[] | undefined;
	isMember?: boolean;
	/** Shows only the first reviews and an "All reviews" link. */
	limit?: number;
	allHref?: Href;
}

function useDeleteReview(type: string, typeId: string) {
	const t = useExtracted();
	const queryClient = useQueryClient();
	const router = useRouter();
	const confirm = useConfirm();
	const mutation = useMutation({
		mutationFn: async (reviewId: string) => {
			const { error } = await apiClient.DELETE("/api/reviews/{id}", { params: { path: { id: reviewId } } });
			if (error) {
				throw error;
			}
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
	return async (reviewId: string) => {
		const confirmed = await confirm({
			title: t("Delete review"),
			body: t("Are you sure you want to delete this review? This action cannot be undone."),
			cancelButton: t("Cancel"),
			actionButton: t("Delete"),
			actionButtonVariant: "destructive",
		});
		if (confirmed) {
			mutation.mutate(reviewId);
		}
	};
}

function OwnerControls({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
	const t = useExtracted();
	return (
		<>
			<Button variant="ghost" size="icon" className="size-8" aria-label={t("Edit review")} onClick={onEdit}>
				<Pencil className="size-3.5" aria-hidden={true} />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="size-8 text-destructive hover:text-destructive"
				aria-label={t("Delete review")}
				onClick={onDelete}
			>
				<Trash2 className="size-3.5" aria-hidden={true} />
			</Button>
		</>
	);
}

function AuthorAvatar({ author }: { author: Review["author"] }) {
	const avatar = (
		<Avatar className="size-8">
			<AvatarImage src={author?.image ?? ""} alt="" />
			<AvatarFallback name={author?.name} />
		</Avatar>
	);
	if (!author) {
		return avatar;
	}
	return (
		<Link href={`/users/${author.slug || author.id}`} className="shrink-0" aria-label={author.name}>
			{avatar}
		</Link>
	);
}

function AuthorName({ author }: { author: Review["author"] }) {
	const t = useExtracted();
	if (!author) {
		return <span className="font-semibold">{t("Anonymous")}</span>;
	}
	return (
		<Link href={`/users/${author.slug || author.id}`} className="font-semibold hover:underline">
			{author.name}
		</Link>
	);
}

function ReviewItem({
	review,
	isOwner,
	onEdit,
	onDelete,
}: {
	review: Review;
	isOwner: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const t = useExtracted();
	const locale = useLocale();
	const isEdited = review.updatedAt !== review.createdAt;
	const date = new Intl.DateTimeFormat(toIntlLocale(locale), {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(review.createdAt));
	return (
		<article className="flex items-start gap-3">
			<AuthorAvatar author={review.author} />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
					<AuthorName author={review.author} />
					<span className="text-xs text-muted-foreground">{date}</span>
					{isEdited ? <span className="text-xs italic text-muted-foreground">({t("edited")})</span> : null}
				</div>
				<Stars value={review.rating} />
				<span className="sr-only">{t("{rating} out of 5", { rating: String(review.rating) })}</span>
				<p className="text-[13px] leading-5 [overflow-wrap:anywhere]">{review.content}</p>
				{isEdited || isOwner ? (
					<div className="flex items-center gap-1">
						{isEdited ? <ReviewEditHistory reviewId={review.id} /> : null}
						{isOwner ? <OwnerControls onEdit={onEdit} onDelete={onDelete} /> : null}
					</div>
				) : null}
			</div>
		</article>
	);
}

function ReviewsSubtitle({ count, average }: { count: number; average: number }) {
	const t = useExtracted();
	if (count === 0) {
		return t("No reviews yet");
	}
	return t("{count, plural, one {# review} other {# reviews}} · {average} average", {
		count,
		average: average.toFixed(1),
	});
}

function canWriteReview(args: { userId?: string; type: "club" | "user"; typeId: string; isMember?: boolean }) {
	if (!args.userId) {
		return false;
	}
	return args.type === "user" ? args.userId !== args.typeId : !args.isMember;
}

function averageRating(reviews: Review[]) {
	return reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
}

function ReviewModals({
	type,
	typeId,
	entityName,
	writing,
	onWritingChange,
	editing,
	onEditingClose,
}: {
	type: "club" | "user";
	typeId: string;
	entityName: string;
	writing: boolean;
	onWritingChange: (open: boolean) => void;
	editing: Review | null;
	onEditingClose: () => void;
}) {
	const modalType = type === "club" ? "CLUB" : "USER";
	return (
		<>
			<ReviewModal
				open={writing}
				onOpenChange={onWritingChange}
				type={modalType}
				entityId={typeId}
				entityName={entityName}
			/>
			{editing ? (
				<ReviewModal
					open={true}
					onOpenChange={(open) => {
						if (!open) {
							onEditingClose();
						}
					}}
					type={modalType}
					entityId={typeId}
					entityName={entityName}
					existingReview={{ id: editing.id, rating: editing.rating, content: editing.content }}
				/>
			) : null}
		</>
	);
}

export function ProfileReviews({ type, typeId, entityName, reviews, isMember, limit, allHref }: ProfileReviewsProps) {
	const t = useExtracted();
	const { user } = useIsAuthenticated();
	const [writing, setWriting] = useState(false);
	const [editing, setEditing] = useState<Review | null>(null);
	const deleteReview = useDeleteReview(type, typeId);
	if (!reviews) {
		return null;
	}
	const shown = limit ? reviews.slice(0, limit) : reviews;
	const canWrite = canWriteReview({ userId: user?.id, type, typeId, isMember });
	const showAll = allHref && reviews.length > shown.length;
	return (
		<>
			<SectionCard
				title={t("Ratings & Reviews")}
				subtitle={<ReviewsSubtitle count={reviews.length} average={averageRating(reviews)} />}
				action={showAll ? { href: allHref, label: t("All reviews") } : undefined}
			>
				{shown.length === 0 && !canWrite ? null : (
					<div className="flex flex-col gap-4">
						{shown.map((review) => (
							<ReviewItem
								key={review.id}
								review={review}
								isOwner={user?.id === review.authorId}
								onEdit={() => setEditing(review)}
								onDelete={() => deleteReview(review.id)}
							/>
						))}
						{canWrite ? (
							<Button variant="outline" className="w-fit" onClick={() => setWriting(true)}>
								<Star aria-hidden={true} />
								{t("Write Review")}
							</Button>
						) : null}
					</div>
				)}
			</SectionCard>
			<ReviewModals
				type={type}
				typeId={typeId}
				entityName={entityName}
				writing={canWrite && writing}
				onWritingChange={setWriting}
				editing={editing}
				onEditingClose={() => setEditing(null)}
			/>
		</>
	);
}
