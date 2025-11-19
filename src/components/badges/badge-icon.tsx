"use client";

import type { BadgeTier } from "@generated/client";
import { icons, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface BadgeIconProps {
	icon?: string | null;
	customImage?: string | null;
	tier?: BadgeTier | null;
	size?: "sm" | "md" | "lg";
	className?: string;
}

function getBadgeTierColor(tier: BadgeTier): string {
	switch (tier) {
		case "BRONZE":
			return "bg-orange-500/20 border-orange-500";
		case "SILVER":
			return "bg-gray-300/20 border-gray-300";
		case "GOLD":
			return "bg-yellow-500/20 border-yellow-500";
		case "PLATINUM":
			return "bg-cyan-500/20 border-cyan-500";
		case "DIAMOND":
			return "bg-purple-500/20 border-purple-500";
	}
	return "bg-muted border-muted";
}

function getBadgeTierTextColor(tier: BadgeTier): string {
	switch (tier) {
		case "BRONZE":
			return "text-orange-500";
		case "SILVER":
			return "text-gray-300";
		case "GOLD":
			return "text-yellow-500";
		case "PLATINUM":
			return "text-cyan-500";
		case "DIAMOND":
			return "text-purple-500";
	}
	return "text-muted-foreground";
}

export function BadgeIcon({ icon, customImage, tier, size = "md", className }: BadgeIconProps) {
	const sizeClasses = {
		sm: "w-8 h-8",
		md: "w-12 h-12",
		lg: "w-16 h-16",
	};

	const iconSizes = {
		sm: 16,
		md: 24,
		lg: 32,
	};

	// For event badges with custom images
	if (customImage) {
		return (
			<div className={cn("relative rounded-lg overflow-hidden", sizeClasses[size], className)}>
				<Image src={customImage} alt="Badge" fill className="object-cover" />
			</div>
		);
	}

	// For achievement badges with lucide icons
	if (icon && tier) {
		const LucideIcon = icons[icon as keyof typeof icons] as LucideIcon;

		if (!LucideIcon) {
			return null;
		}

		return (
			<div
				className={cn(
					"relative flex items-center justify-center border-2 rounded-full",
					sizeClasses[size],
					getBadgeTierColor(tier),
					className,
				)}
			>
				<LucideIcon size={iconSizes[size]} className={getBadgeTierTextColor(tier)} />
			</div>
		);
	}

	return null;
}
