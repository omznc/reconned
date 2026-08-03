import Image from "next/image";
import type { ReactNode } from "react";
import { bannerFallbackStyle } from "@/lib/identity";
import { cn } from "@/lib/utils";

interface ProfileBannerProps {
	name: string;
	kind: "club" | "person";
	image?: string | null;
	/** Overlaid on the banner itself — an edit button, nothing else. */
	action?: ReactNode;
	className?: string;
}

/**
 * One banner for both clubs and people: same ratio, same safe area, so a single
 * crop tool serves them. With no upload, the hashed field colour fills the band
 * and the page still looks composed rather than empty.
 *
 * Nothing but the owner's edit control is overlaid — name and meta live below
 * the banner, not on it, so an upload can't break the header.
 */
export function ProfileBanner({ name, kind, image, action, className }: ProfileBannerProps) {
	return (
		<div className={cn("relative w-full overflow-hidden rounded-md", className)}>
			<div
				className="relative aspect-2/1 w-full sm:aspect-3/1"
				style={image ? undefined : bannerFallbackStyle(name, kind)}
			>
				{image && (
					<Image
						suppressHydrationWarning
						src={image}
						alt=""
						fill
						priority
						draggable={false}
						sizes="(max-width: 1200px) 100vw, 1200px"
						className="object-cover"
					/>
				)}
				{/*
				 * A bottom scrim sits under the avatar so a bright photo never washes
				 * out the ring that separates it from the banner.
				 */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-[74px] bg-linear-to-t from-[rgba(27,26,24,0.45)] to-transparent" />
			</div>
			{action && <div className="absolute right-4 top-4">{action}</div>}
		</div>
	);
}
