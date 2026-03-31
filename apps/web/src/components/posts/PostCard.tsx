"use client";

import { formatRelative } from "date-fns";
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import "@/components/editor/editor.css";
import { useExtracted, useLocale } from "next-intl";
import sanitizeHtml from "sanitize-html";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverflow } from "@/hooks/use-overflow";
import { getDateFnsLocale } from "@/lib/date-locale";
import { cn as classNames, cn } from "@/lib/utils";
import { CommentSection } from "./CommentSection";
import { LikeButton } from "./LikeButton";

export interface PostAuthor {
	id: string;
	slug: string | null;
	name: string;
	image: string | null;
}

export interface PostClub {
	id: string;
	name: string;
	slug: string | null;
	logo: string | null;
}

export interface PostData {
	id: string;
	title: string | null;
	content: string;
	images: string[] | null;
	authorId: string;
	clubId: string | null;
	isPublic: boolean;
	createdAt: string;
	updatedAt: string;
	author: PostAuthor;
	club: PostClub | null;
	likesCount: number;
	commentsCount: number;
	isLiked: boolean;
}

interface PostCardProps {
	post: PostData;
	currentUserId?: string;
	isClubManager?: boolean;
	showComments?: boolean;
	onPostUpdated?: (post: PostData) => void;
	onPostDeleted?: (postId: string) => void;
}

export function PostCard({
	post,
	currentUserId,
	isClubManager,
	showComments = false,
	onPostUpdated,
	onPostDeleted,
}: PostCardProps) {
	const t = useExtracted();
	const locale = useLocale();
	const dateLocale = getDateFnsLocale(locale);
	const [isExpanded, setIsExpanded] = useState(false);
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);
	const [showAllComments, setShowAllComments] = useState(showComments);
	const [localPost, setLocalPost] = useState(post);
	const { ref, isOverflowing } = useOverflow();
	const images = (localPost.images || []).filter((src): src is string => Boolean(src));

	const isOwner = currentUserId === localPost.authorId;
	const canEdit = isOwner || isClubManager;

	const handleLikeUpdate = (newLikesCount: number, newIsLiked: boolean) => {
		setLocalPost((prev) => ({
			...prev,
			likesCount: newLikesCount,
			isLiked: newIsLiked,
		}));
	};

	return (
		<div className="border bg-sidebar rounded-md p-4 space-y-3">
			<div className="flex justify-between items-start gap-4">
				<div className="space-y-1 min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<Link href={`/${localPost.author.slug || localPost.author.id}`} className="hover:underline">
							<span className="font-medium">{localPost.author.name}</span>
						</Link>
						{localPost.club && (
							<>
								<span className="text-muted-foreground">in</span>
								<Link
									href={`/clubs/${localPost.club.slug || localPost.club.id}`}
									className="hover:underline flex items-center gap-1"
								>
									{localPost.club.logo && (
										<Image
											src={localPost.club.logo}
											alt={localPost.club.name}
											width={16}
											height={16}
											className="rounded-sm"
										/>
									)}
									<span className="text-muted-foreground">{localPost.club.name}</span>
								</Link>
							</>
						)}
					</div>
					<p className="text-sm text-muted-foreground">
						{formatRelative(new Date(localPost.createdAt), new Date(), {
							locale: dateLocale,
						})}
					</p>
				</div>
				{canEdit && (
					<div className="flex items-center gap-1 shrink-0">
						{isOwner && (
							<Button variant="ghost" size="icon" asChild className="shrink-0">
								<Link href={`/posts/${localPost.id}/edit`}>
									<Pencil className="h-4 w-4" />
								</Link>
							</Button>
						)}
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								if (confirm(t("Are you sure you want to delete this post?"))) {
									onPostDeleted?.(localPost.id);
								}
							}}
							className="shrink-0 text-destructive hover:text-destructive"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				)}
			</div>

			{localPost.title && <h3 className="font-medium text-lg">{localPost.title}</h3>}

			<div ref={ref} className={cn("relative", !isExpanded && "max-h-[500px] overflow-hidden")}>
				<div
					className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 p-4"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: It's sanitized content
					dangerouslySetInnerHTML={{
						__html: sanitizeHtml(localPost.content),
					}}
				/>
				{!isExpanded && isOverflowing && (
					<div className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-sidebar to-transparent pointer-events-none" />
				)}
			</div>
			{isOverflowing && (
				<Button
					variant="ghost"
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full hover:bg-transparent"
				>
					{isExpanded ? t("Show less") : t("Read more")}
				</Button>
			)}

			{images.length > 0 && (
				<PostImages
					images={images}
					title={localPost.title || localPost.author.name}
					onImageClick={(index) => {
						setViewerIndex(index);
					}}
				/>
			)}

			<div className="flex items-center gap-4 pt-2 border-t">
				<LikeButton
					postId={localPost.id}
					initialLikesCount={localPost.likesCount}
					initialIsLiked={localPost.isLiked}
					onUpdate={handleLikeUpdate}
				/>
				<Button
					variant="ghost"
					size="sm"
					className="gap-2"
					onClick={() => setShowAllComments(!showAllComments)}
				>
					<MessageCircle className="h-4 w-4" />
					<span>{localPost.commentsCount}</span>
				</Button>
			</div>

			{showAllComments && <CommentSection postId={localPost.id} currentUserId={currentUserId} />}

			{viewerIndex !== null && images[viewerIndex] && (
				<PostImageViewer
					images={images}
					title={localPost.title || localPost.author.name}
					index={viewerIndex}
					onClose={() => {
						setViewerIndex(null);
					}}
					onChangeIndex={(nextIndex) => {
						setViewerIndex(nextIndex);
					}}
				/>
			)}
		</div>
	);
}

interface PostImagesProps {
	images: (string | undefined)[];
	title: string;
	onImageClick: (index: number) => void;
}

function PostImages({ images, title, onImageClick }: PostImagesProps) {
	const safeImages = images.filter((src): src is string => Boolean(src));
	if (safeImages.length === 0) {
		return null;
	}

	return (
		<div className="mt-2 max-h-fit">
			<div className="flex flex-wrap gap-2">
				{safeImages.map((src, index) => (
					<button
						type="button"
						key={src}
						className="relative h-32 w-32 sm:h-42 sm:w-42 rounded-md overflow-hidden"
						onClick={() => {
							onImageClick(index);
						}}
					>
						<Image src={src} alt={title} fill className="object-cover" sizes="96px" />
					</button>
				))}
			</div>
		</div>
	);
}

interface PostImageViewerProps {
	images: (string | undefined)[];
	title: string;
	index: number;
	onClose: () => void;
	onChangeIndex: (index: number) => void;
}

function PostImageViewer({ images, title, index, onClose, onChangeIndex }: PostImageViewerProps) {
	const safeImages = images.filter((src): src is string => Boolean(src));

	if (safeImages.length === 0) {
		return null;
	}

	const hasPrev = safeImages.length > 1;
	const hasNext = safeImages.length > 1;

	const goPrev = () => {
		if (!hasPrev) {
			return;
		}

		const nextIndex = index === 0 ? safeImages.length - 1 : index - 1;
		onChangeIndex(nextIndex);
	};

	const goNext = () => {
		if (!hasNext) {
			return;
		}

		const nextIndex = index === safeImages.length - 1 ? 0 : index + 1;
		onChangeIndex(nextIndex);
	};

	return (
		<div
			aria-modal="true"
			role="dialog"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
			onClick={() => {
				onClose();
			}}
		>
			<div
				aria-label="Image viewer"
				aria-labelledby="image-viewer-title"
				aria-describedby="image-viewer-description"
				aria-hidden="false"
				aria-modal="true"
				role="dialog"
				className="relative flex items-center justify-center rounded-md bg-black/60"
				style={{
					width: "min(900px, 90vw)",
					height: "min(650px, 80vh)",
				}}
				onClick={(event) => {
					event.stopPropagation();
				}}
			>
				<button
					type="button"
					className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
					onClick={() => {
						onClose();
					}}
				>
					<X className="h-5 w-5" />
				</button>
				{hasPrev && (
					<button
						type="button"
						className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1 text-white"
						onClick={goPrev}
					>
						<ChevronLeft className="h-6 w-6" />
					</button>
				)}
				{hasNext && (
					<button
						type="button"
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1 text-white"
						onClick={goNext}
					>
						<ChevronRight className="h-6 w-6" />
					</button>
				)}
				<Image
					src={safeImages[index] as string}
					alt={title}
					width={1600}
					height={1200}
					className="h-full w-full object-contain"
				/>
			</div>
		</div>
	);
}

export function PostCardSkeleton() {
	return (
		<div className="border bg-sidebar rounded-md p-4 space-y-3">
			<div className="flex justify-between items-start gap-4">
				<div className="space-y-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-3 w-24" />
				</div>
			</div>
			<Skeleton className="h-6 w-3/4" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</div>
	);
}
