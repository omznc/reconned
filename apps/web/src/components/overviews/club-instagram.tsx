"use client";

import Error404 from "@public/errors/404.webp";
import { ArrowUpRight, InstagramIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useExtracted, useLocale } from "next-intl";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type InstagramMediaResponse = ApiResponse<"/api/clubs/{id}/instagram/media", "get">;

interface ClubInstagramProps {
	data: InstagramMediaResponse;
	limit?: number;
}

export function ClubInstagram({ data, limit = 7 }: ClubInstagramProps) {
	const t = useExtracted();
	const locale = useLocale();

	if (data.media.length === 0) {
		return (
			<div className="text-center w-full py-8 text-muted-foreground flex flex-col items-center justify-center">
				<Image src={Error404} alt="404" draggable={false} className="w-full max-w-[400px] dark:invert" />
				<p>{t("Nothing to show here")}</p>
			</div>
		);
	}

	// Display only the first 'limit' photos
	const displayPhotos = data.media.slice(0, limit);
	const hasMorePhotos = data.media.length > limit;

	const renderMedia = (photo: InstagramMediaResponse["media"][number]) => {
		const imageUrl = photo.media_type === "VIDEO" ? photo.thumbnail_url || photo.media_url : photo.media_url;

		return (
			<a
				key={photo.id}
				href={photo.permalink}
				target="_blank"
				rel="noopener noreferrer"
				className="group overflow-hidden rounded-md aspect-square relative group hover:opacity-90 transition-opacity"
			>
				<Image
					src={imageUrl}
					alt={photo.caption || `Instagram ${photo.media_type.toLowerCase()}`}
					fill
					sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
					className="object-cover group-hover:scale-105 transition-transform duration-200"
				/>

				{/* Media type indicators */}
				{photo.media_type === "VIDEO" && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/30">
						<span className="text-white text-xs font-medium">VIDEO</span>
					</div>
				)}
				{photo.media_type === "CAROUSEL_ALBUM" && (
					<div className="absolute top-2 right-2 bg-black/40 aspect-square size-6 p-1">
						<PlusIcon className="h-4 w-4 text-white" />
					</div>
				)}

				{/* Timestamp */}
				{photo.timestamp && (
					<div
						suppressHydrationWarning
						className="absolute top-2 left-2 bg-black/40 text-white text-xs px-1.5 py-0.5"
					>
						{new Date(photo.timestamp).toLocaleDateString(locale)}
					</div>
				)}

				{/* Caption overlay on hover */}
				{photo.caption && (
					<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
						<p className="text-white text-xs line-clamp-4">{photo.caption}</p>
					</div>
				)}
			</a>
		);
	};

	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 w-full content-start">
			{/* Render all photos */}
			{displayPhotos.map(renderMedia)}

			{/* "View more" box that links to Instagram */}
			{hasMorePhotos && data.username && (
				<a
					href={`https://instagram.com/${data.username}`}
					target="_blank"
					rel="noopener noreferrer"
					className="overflow-hidden rounded-md aspect-square relative group hover:opacity-70 transition-opacity flex flex-col items-center justify-center bg-sidebar border border-border"
				>
					<InstagramIcon className="h-8 w-8 mb-2" />
					<p className="text-sm text-center font-medium">{t("View more on Instagram")}</p>
					<div className="flex items-center text-xs text-muted-foreground mt-1">
						<span>{data.media.length - displayPhotos.length}+ </span>
						<ArrowUpRight className="h-3 w-3 ml-1" />
					</div>
				</a>
			)}
		</div>
	);
}
