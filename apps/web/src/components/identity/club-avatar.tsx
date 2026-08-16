import Image from "next/image";
import { generatedClubMark, type LogoTile, logoTileStyle } from "@/lib/identity";
import { cn } from "@/lib/utils";

interface ClubAvatarProps {
	name: string;
	logo?: string | null;
	/** Rendered size in pixels. Drives radius, hatch and initials scaling. */
	size: number;
	/**
	 * Tile behind an uploaded logo. Paper is the default; ink keeps light logos
	 * from vanishing. Only meaningful when `logo` is set. `null` is what a club
	 * with no stored preference sends, and reads the same as the default.
	 */
	tile?: LogoTile | null;
	className?: string;
	/**
	 * Fill the parent instead of sitting at exactly `size` pixels. `size` still
	 * drives the type and texture scale, which is what a responsive header needs.
	 */
	fill?: boolean;
	priority?: boolean;
	/** Override the computed corner radius, e.g. 0 for a full-bleed card header. */
	radius?: number;
}

/**
 * A club's square mark. An uploaded logo is framed on a tile chosen for
 * contrast, so a transparent PNG in any colour stays visible. A club without a
 * logo gets its generated mark: a hashed field, hatched, with condensed initials.
 */
export function ClubAvatar({ name, logo, size, tile, className, fill, priority, radius }: ClubAvatarProps) {
	const box = fill ? { width: "100%", height: "100%" } : { width: size, height: size };
	const override = radius === undefined ? {} : { borderRadius: radius };

	if (logo) {
		return (
			<div
				className={cn("flex shrink-0 items-center justify-center overflow-hidden", className)}
				style={{ ...box, ...logoTileStyle(tile ?? "paper", size), ...override }}
			>
				{/*
				 * The logo lives inside the tile at 78%, never touching the corner
				 * radius, and is contained rather than cropped so wide marks stay whole.
				 */}
				<Image
					src={logo}
					alt=""
					width={size * 2}
					height={size * 2}
					priority={priority}
					draggable={false}
					className="object-contain"
					style={{ width: "78%", height: "78%" }}
				/>
			</div>
		);
	}

	const mark = generatedClubMark(name, size);

	return (
		<div
			className={cn("flex shrink-0 items-center justify-center overflow-hidden", className)}
			style={{ ...box, ...mark.style, ...override }}
			aria-hidden="true"
		>
			{mark.initialsSize !== null && (
				<span
					className="select-none font-club-mark font-bold leading-none tracking-[0.02em] text-white/95"
					style={{ fontSize: mark.initialsSize }}
				>
					{mark.initials}
				</span>
			)}
		</div>
	);
}
