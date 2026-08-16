"use client";

import { Calendar, MapPin, Users, VerifiedIcon, Wrench } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import type { LogoTile } from "@/lib/identity";

/**
 * `card` is a tile with a big image on top — right for a page of one kind of
 * thing, like the club directory. `row` is a line with a small leading mark —
 * right for a mixed list, where tiles of different natural heights leave the
 * grid full of holes.
 */
export type ListingCardVariant = "card" | "row";

interface ListingCardProps {
	type: "club" | "user" | "event";
	image?: string | null;
	/** Tile behind an uploaded club logo. Ignored for people and events. */
	tile?: LogoTile | null;
	name?: string;
	title: ReactNode;
	description?: string | null;
	href: string;
	badges?: string[];
	meta?: string;
	location?: string | null;
	memberCount?: number;
	verified?: boolean;
	isAdmin?: boolean;
	variant?: ListingCardVariant;
}

export function ListingCard({
	type,
	image,
	tile,
	name,
	title,
	description,
	href,
	badges,
	meta,
	location,
	memberCount,
	verified,
	isAdmin,
	variant = "card",
}: ListingCardProps) {
	const t = useExtracted();

	const marks = (
		<>
			{verified && (
				<Tooltip delayDuration={100}>
					<TooltipTrigger asChild>
						<VerifiedIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
					</TooltipTrigger>
					<TooltipContent>
						<p>{t("Verified club")}</p>
					</TooltipContent>
				</Tooltip>
			)}
			{isAdmin && (
				<Tooltip delayDuration={100}>
					<TooltipTrigger asChild>
						<Wrench className="h-3.5 w-3.5 text-red-500 shrink-0" />
					</TooltipTrigger>
					<TooltipContent>
						<p>{t("Administrator")}</p>
					</TooltipContent>
				</Tooltip>
			)}
		</>
	);

	/*
	 * People are always rows, whatever the surrounding page asked for. A person's
	 * avatar is a face-sized circle next to their name — blown up to fill a
	 * square card it takes on the weight of a club's logo, which is the one
	 * distinction the identity system exists to keep.
	 */
	if (type === "user" || variant === "row") {
		const where = location || meta;

		return (
			<Link href={href} className="group block self-start">
				<Card className="relative overflow-hidden border-border/50 transition-colors duration-150 hover:border-red-500">
					<div className="flex items-center gap-3 p-3">
						<ListingMark type={type} image={image} tile={tile} name={name} title={title} />
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1">
								<span className="truncate text-sm font-semibold">{title}</span>
								{marks}
							</div>
							{description && (
								<p className="truncate text-xs text-muted-foreground mt-0.5">{description}</p>
							)}
							<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
								{where && (
									<span className="flex items-center gap-1 truncate">
										<MapPin className="w-3 h-3 shrink-0" />
										<span className="truncate">{where}</span>
									</span>
								)}
								{memberCount !== undefined && memberCount > 0 && (
									<span className="flex items-center gap-1 shrink-0">
										<Users className="w-3 h-3" />
										{memberCount}
									</span>
								)}
								{badges && badges.length > 0 && (
									<Badge
										variant="secondary"
										className="shrink-0 max-w-[10rem] truncate text-xs px-1.5 py-0 font-normal"
									>
										{badges[0]}
									</Badge>
								)}
							</div>
						</div>
					</div>
				</Card>
			</Link>
		);
	}

	return (
		<Link href={href} className="block group">
			<Card className="overflow-hidden transition-colors duration-150 hover:border-red-500 border-border/50 h-full relative">
				<div className="absolute inset-0 bg-gradient-to-t from-red-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
				<div className="flex flex-col h-full relative">
					<div className="relative bg-muted overflow-hidden">
						{type === "event" ? (
							<div className="relative aspect-video">
								{image ? (
									<Image
										src={image}
										alt={typeof title === "string" ? title : "Image"}
										fill
										className="object-cover"
										sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center absolute inset-0 bg-muted">
										<Calendar className="w-10 h-10 text-muted-foreground/50" />
									</div>
								)}
							</div>
						) : (
							<div className="relative aspect-square">
								<ClubAvatar
									name={typeof title === "string" ? title : name || ""}
									logo={image}
									tile={tile}
									size={200}
									fill
									radius={0}
								/>
							</div>
						)}
					</div>

					<CardHeader className="p-3 pb-1">
						<CardTitle className="text-sm font-semibold line-clamp-1 flex items-center gap-1">
							{title}
							{marks}
						</CardTitle>
						{description && (
							<CardDescription className="line-clamp-1 text-xs mt-0.5">{description}</CardDescription>
						)}
					</CardHeader>

					<div className="px-3 pb-3 pt-0 mt-auto">
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							{location && (
								<span className="flex items-center gap-1 truncate">
									<MapPin className="w-3 h-3 shrink-0" />
									<span className="truncate">{location}</span>
								</span>
							)}
							{memberCount !== undefined && memberCount > 0 && (
								<span className="flex items-center gap-1 shrink-0">
									<Users className="w-3 h-3" />
									{memberCount}
								</span>
							)}
							{meta && !location && <span className="truncate">{meta}</span>}
						</div>

						{badges && badges.length > 0 && (
							<div className="flex flex-wrap gap-1 mt-2">
								{badges.slice(0, 2).map((badge) => (
									<Badge key={badge} variant="secondary" className="text-xs px-1.5 py-0 font-normal">
										{badge}
									</Badge>
								))}
								{badges.length > 2 && (
									<Badge variant="secondary" className="text-xs px-1.5 py-0 font-normal">
										+{badges.length - 2}
									</Badge>
								)}
							</div>
						)}
					</div>
				</div>
			</Card>
		</Link>
	);
}

/** The leading mark of a row: a person's circle, a club's square, an event's frame. */
function ListingMark({
	type,
	image,
	tile,
	name,
	title,
}: Pick<ListingCardProps, "type" | "image" | "tile" | "name" | "title">) {
	if (type === "user") {
		return (
			<Avatar className="size-12 shrink-0">
				<AvatarImage src={image || undefined} alt="" />
				<AvatarFallback name={name} />
			</Avatar>
		);
	}

	if (type === "club") {
		return (
			<ClubAvatar
				name={typeof title === "string" ? title : name || ""}
				logo={image}
				tile={tile}
				size={48}
				className="shrink-0"
			/>
		);
	}

	// An event's picture is a scene, not a mark, so it keeps a soft rectangle
	// rather than borrowing either identity shape.
	return (
		<div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
			{image ? (
				<Image src={image} alt="" fill sizes="48px" className="object-cover" />
			) : (
				<div className="grid h-full w-full place-items-center">
					<Calendar className="h-5 w-5 text-muted-foreground/60" />
				</div>
			)}
		</div>
	);
}
