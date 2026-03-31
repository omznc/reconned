"use client";

import { formatRelative } from "date-fns";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getDateFnsLocale } from "@/lib/date-locale";

interface Comment {
	id: string;
	postId: string;
	authorId: string;
	content: string;
	createdAt: string;
	updatedAt: string;
	author: {
		id: string;
		slug: string | null;
		name: string;
		image: string | null;
	};
}

interface CommentSectionProps {
	postId: string;
	currentUserId?: string;
}

export function CommentSection({ postId, currentUserId }: CommentSectionProps) {
	const locale = useLocale();
	const dateLocale = getDateFnsLocale(locale);
	const [comments, setComments] = useState<Comment[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [newComment, setNewComment] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchComments();
	}, [postId]);

	const fetchComments = async () => {
		try {
			const response = await fetch(`/api/posts/${postId}/comments`, { credentials: "include" });
			if (response.ok) {
				const data = await response.json();
				setComments(data.comments || []);
			}
		} catch (err) {
			console.error("Failed to fetch comments:", err);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newComment.trim() || isSubmitting) return;

		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch(`/api/posts/${postId}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ content: newComment }),
			});

			if (response.ok) {
				const data = await response.json();
				setComments((prev) => [data as Comment, ...prev]);
				setNewComment("");
			} else {
				setError("Failed to post comment");
			}
		} catch {
			setError("Failed to post comment");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (commentId: string) => {
		try {
			await fetch(`/api/posts/${postId}/comments/${commentId}`, {
				method: "DELETE",
				credentials: "include",
			});
			setComments((prev) => prev.filter((c) => c.id !== commentId));
		} catch (err) {
			console.error("Failed to delete comment:", err);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-3 pt-3">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-3 pt-3 border-t">
			{currentUserId && (
				<form onSubmit={handleSubmit} className="space-y-2">
					<Textarea
						value={newComment}
						onChange={(e) => setNewComment(e.target.value)}
						placeholder="Write a comment..."
						className="min-h-[80px]"
						maxLength={1000}
					/>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<div className="flex justify-end">
						<Button type="submit" size="sm" disabled={!newComment.trim() || isSubmitting}>
							{isSubmitting ? "Posting..." : "Post Comment"}
						</Button>
					</div>
				</form>
			)}

			<div className="space-y-3">
				{comments.map((comment) => (
					<div key={comment.id} className="flex gap-3">
						<Link href={`/${comment.author.slug || comment.author.id}`} className="shrink-0">
							{comment.author.image ? (
								<Image
									src={comment.author.image}
									alt={comment.author.name}
									width={32}
									height={32}
									className="rounded-full"
								/>
							) : (
								<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
									{comment.author.name.charAt(0).toUpperCase()}
								</div>
							)}
						</Link>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<Link
									href={`/${comment.author.slug || comment.author.id}`}
									className="font-medium text-sm hover:underline"
								>
									{comment.author.name}
								</Link>
								<span className="text-xs text-muted-foreground">
									{formatRelative(new Date(comment.createdAt), new Date(), {
										locale: dateLocale,
									})}
								</span>
								{(currentUserId === comment.authorId || currentUserId) && (
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 ml-auto"
										onClick={() => handleDelete(comment.id)}
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								)}
							</div>
							<p className="text-sm mt-1">{comment.content}</p>
						</div>
					</div>
				))}
				{comments.length === 0 && (
					<p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
				)}
			</div>
		</div>
	);
}
