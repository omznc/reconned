"use client";

import { formatRelative } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Post } from "@/lib/api/api-type-helpers";
import "@/components/editor/editor.css";
import { useExtracted, useLocale } from "next-intl";
import sanitizeHtml from "sanitize-html";
import { useOverflow } from "@/hooks/use-overflow";
import { getDateFnsLocale } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

interface ClubPostProps {
	post: Post;
	clubId: string;
	isManager?: boolean;
}

export function ClubPost({ post, clubId, isManager }: ClubPostProps) {
	const t = useExtracted();
	const locale = useLocale();
	const dateLocale = getDateFnsLocale(locale);
	const [isExpanded, setIsExpanded] = useState(false);
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);
	const { ref, isOverflowing } = useOverflow();
	const images = (post.images || []).filter((src): src is string => Boolean(src));

	return (
		<div className="border bg-sidebar rounded-md p-4 space-y-3">
			<div className="flex justify-between items-start gap-4">
				<div className="space-y-1">
					<h3 className="font-medium">{post.title}</h3>
					<p className="text-sm text-muted-foreground">
						{t("Posted on {date}", {
							date: formatRelative(new Date(post.createdAt), new Date(), {
								locale: dateLocale,
							}),
						})}
					</p>
				</div>
				{isManager && (
					<Button variant="ghost" size="icon" asChild className="shrink-0">
						<Link href={`/dashboard/${clubId}/club/posts?postId=${post.id}`}>
							<Pencil className="h-4 w-4" />
						</Link>
					</Button>
				)}
			</div>
			<div ref={ref} className={cn("relative", !isExpanded && "max-h-[500px] overflow-hidden")}>
				<div
					className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 p-4"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: It's sanitized content
					dangerouslySetInnerHTML={{
						__html: sanitizeHtml(post.content),
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
					title={post.title}
					onImageClick={(index) => {
						setViewerIndex(index);
					}}
				/>
			)}
			{viewerIndex !== null && images[viewerIndex] && (
				<PostImageViewer
					images={images}
					title={post.title}
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
