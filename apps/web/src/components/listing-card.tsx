"use client";

import { Building2, Calendar, MapPin, Users, VerifiedIcon, Wrench } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";

interface ListingCardProps {
	type: "club" | "user" | "event";
	image?: string | null;
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
}

export function ListingCard({
	type,
	image,
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
}: ListingCardProps) {
	const t = useExtracted();

	return (
		<Link href={href} className="block group">
			<Card className="overflow-hidden transition-colors duration-150 hover:border-red-500 border-border/50 h-full relative">
				<div className="absolute inset-0 bg-gradient-to-t from-red-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
				<div className="flex flex-col h-full relative">
					<div className="relative bg-muted overflow-hidden">
						{type === "user" ? (
							<div className="w-full aspect-square">
								<Avatar className="w-full h-full rounded-none">
									<AvatarImage
										src={image || undefined}
										alt={typeof title === "string" ? title : "User"}
									/>
									<AvatarFallback name={name} className="text-4xl" />
								</Avatar>
							</div>
						) : type === "event" ? (
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
								{image ? (
									<Image
										src={image}
										alt={typeof title === "string" ? title : "Image"}
										fill
										className="object-contain"
										sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center absolute inset-0 bg-muted">
										<Building2 className="w-10 h-10 text-muted-foreground/50" />
									</div>
								)}
							</div>
						)}
					</div>

					<CardHeader className="p-3 pb-1">
						<CardTitle className="text-sm font-semibold line-clamp-1 flex items-center gap-1">
							{title}
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
