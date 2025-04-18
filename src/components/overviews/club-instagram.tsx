"use client";

import { ExternalLink, PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { InstagramMedia } from "@/lib/instagram";
import { SiInstagram } from "@icons-pack/react-simple-icons";

interface ClubInstagramProps {
	clubId?: string;
	photos: InstagramMedia[];
	username?: string;
	limit?: number;
}

export function ClubInstagram({ photos, username, limit = 7 }: ClubInstagramProps) {
	const t = useTranslations("components.instagramGallery");
	const locale = useLocale();

	if (photos.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				<p>{t("noPhotos")}</p>
			</div>
		);
	}

	// Display only the first 'limit' photos
	const displayPhotos = photos.slice(0, limit);
	const hasMorePhotos = photos.length > limit;

	const renderMedia = (photo: InstagramMedia) => {
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
					<div className="absolute top-2 right-2 bg-black/40 aspect-square rounded-full size-6 p-1">
						<PlusIcon className="h-4 w-4 text-white" />
					</div>
				)}

				{/* Timestamp */}
				{photo.timestamp && (
					<div
						suppressHydrationWarning
						className="absolute top-2 left-2 bg-black/40 text-white text-xs px-1.5 py-0.5 rounded"
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
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
			{/* Render all photos */}
			{displayPhotos.map(renderMedia)}

			{/* "View more" box that links to Instagram */}
			{hasMorePhotos && username && (
				<a
					href={`https://instagram.com/${username}`}
					target="_blank"
					rel="noopener noreferrer"
					className="overflow-hidden rounded-md aspect-square relative group hover:opacity-70 transition-opacity flex flex-col items-center justify-center bg-sidebar border border-border"
				>
					<SiInstagram className="h-8 w-8 mb-2" />
					<p className="text-sm text-center font-medium">{t("viewMore")}</p>
					<div className="flex items-center text-xs text-muted-foreground mt-1">
						<span>{photos.length - limit}+ </span>
						<ExternalLink className="h-3 w-3 ml-1" />
					</div>
				</a>
			)}
		</div>
	);
}
