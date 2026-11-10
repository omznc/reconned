import { ChevronRight } from "lucide-react";
import { ClubAvatar } from "@/components/identity/club-avatar";
import type { Href } from "@/components/redesign/types";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import type { LogoTile } from "@/lib/identity";
import { cn } from "@/lib/utils";

interface EntityRowProps {
	/** A club has a square mark. A player has a round avatar. */
	kind: "club" | "player";
	href: Href;
	/** The club name, or the player callsign. */
	name: string;
	/** For example the city and the member count. */
	subtitle?: string | null;
	image?: string | null;
	logoTile?: LogoTile | null;
	verified?: boolean;
	className?: string;
}

export function EntityRow({ kind, href, name, subtitle, image, logoTile, verified, className }: EntityRowProps) {
	return (
		<Link
			href={href}
			className={cn(
				"flex min-w-0 items-center gap-3 rounded-lg border bg-card p-3.5 text-card-foreground outline-none transition-colors hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			)}
		>
			{kind === "club" ? (
				<ClubAvatar name={name} logo={image} tile={logoTile} size={32} />
			) : (
				<Avatar className="size-8">
					<AvatarImage src={image ?? ""} alt="" />
					<AvatarFallback name={name} />
				</Avatar>
			)}
			<span className="flex min-w-0 flex-1 flex-col">
				<span
					className={cn(
						"flex items-center gap-1 text-[13px] leading-5",
						kind === "club" ? "font-semibold" : "font-person font-bold tracking-[0.02em]",
					)}
				>
					<span className="truncate">{name}</span>
					{verified ? <VerifiedBadge className="text-sm" /> : null}
				</span>
				{subtitle ? (
					<span className="truncate text-xs leading-[18px] text-muted-foreground">{subtitle}</span>
				) : null}
			</span>
			<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden={true} />
		</Link>
	);
}
