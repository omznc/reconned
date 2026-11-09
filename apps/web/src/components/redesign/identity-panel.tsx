import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { ClubAvatar } from "@/components/identity/club-avatar";
import type { Href, IconComponent } from "@/components/redesign/types";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { LogoTile } from "@/lib/identity";
import { cn } from "@/lib/utils";

export interface IdentityBadge {
	label: string;
	icon?: IconComponent;
}

export interface IdentityAction {
	/** Accessible name of the icon button. */
	label: string;
	icon: IconComponent;
	href?: Href;
	onClick?: () => void;
}

interface IdentityPanelProps {
	/** A club is a square. A person is a circle. */
	kind: "club" | "person";
	name: string;
	image?: string | null;
	logoTile?: LogoTile | null;
	verified?: boolean;
	/** Accessible name of the verified mark, for example "Verified club". */
	verifiedLabel?: string;
	location?: string | null;
	badges?: IdentityBadge[];
	description?: string | null;
	primaryAction?: { label: string; href: Href; icon?: IconComponent };
	actions?: IdentityAction[];
	/** The name is the page h1 by default. Search uses 2. */
	headingLevel?: 1 | 2;
	children?: ReactNode;
	className?: string;
}

function IconAction({ action }: { action: IdentityAction }) {
	const Icon = action.icon;
	const icon = <Icon className="size-4" aria-hidden={true} />;
	if (action.href) {
		return (
			<Button asChild={true} variant="outline" size="icon" className="shrink-0">
				<Link href={action.href} aria-label={action.label} title={action.label}>
					{icon}
				</Link>
			</Button>
		);
	}
	return (
		<Button
			type="button"
			variant="outline"
			size="icon"
			className="shrink-0"
			aria-label={action.label}
			title={action.label}
			onClick={action.onClick}
		>
			{icon}
		</Button>
	);
}

function IdentityMark({
	kind,
	name,
	image,
	logoTile,
}: Pick<IdentityPanelProps, "kind" | "name" | "image" | "logoTile">) {
	if (kind === "club") {
		return <ClubAvatar name={name} logo={image} tile={logoTile} size={120} priority={true} />;
	}
	return (
		<Avatar className="size-[120px] text-4xl">
			<AvatarImage src={image ?? ""} alt="" />
			<AvatarFallback name={name} />
		</Avatar>
	);
}

function IdentityActions({ primaryAction, actions }: Pick<IdentityPanelProps, "primaryAction" | "actions">) {
	if (!primaryAction && !actions?.length) {
		return null;
	}
	const PrimaryIcon = primaryAction?.icon;
	return (
		<div className="flex flex-wrap gap-2">
			{primaryAction ? (
				<Button asChild={true} className="min-w-32 flex-1">
					<Link href={primaryAction.href}>
						{PrimaryIcon ? <PrimaryIcon aria-hidden={true} /> : null}
						{primaryAction.label}
					</Link>
				</Button>
			) : null}
			{actions?.map((action) => (
				<IconAction key={action.label} action={action} />
			))}
		</div>
	);
}

/** The left side panel of the club and player profiles. It stacks, and it goes sideways in a wide container. */
export function IdentityPanel({
	kind,
	name,
	image,
	logoTile,
	verified,
	verifiedLabel,
	location,
	badges,
	description,
	primaryAction,
	actions,
	headingLevel = 1,
	children,
	className,
}: IdentityPanelProps) {
	const Heading = headingLevel === 1 ? "h1" : "h2";
	return (
		<section className={cn("@container rounded-lg border bg-card p-6 text-card-foreground", className)}>
			<div className="flex flex-col gap-4 @xl:flex-row @xl:gap-6">
				<div className="shrink-0">
					<IdentityMark kind={kind} name={name} image={image} logoTile={logoTile} />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Heading
							className={cn(
								"text-[30px] leading-[1.05] [overflow-wrap:anywhere]",
								kind === "club" ? "font-club font-bold" : "font-person font-bold tracking-[0.02em]",
							)}
						>
							{name}
							{verified ? (
								<>
									{" "}
									<VerifiedBadge label={verifiedLabel} className="text-[0.8em]" />
								</>
							) : null}
						</Heading>
						{location ? (
							<p className="flex items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
								<MapPin className="size-3.5 shrink-0" aria-hidden={true} />
								{location}
							</p>
						) : null}
					</div>
					{badges?.length ? (
						<ul className="flex flex-wrap gap-1.5">
							{badges.map((badge) => {
								const Icon = badge.icon;
								return (
									<li
										key={badge.label}
										className="inline-flex h-6 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground"
									>
										{Icon ? <Icon className="size-3.5" aria-hidden={true} /> : null}
										{badge.label}
									</li>
								);
							})}
						</ul>
					) : null}
					{description ? <p className="text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
					<IdentityActions primaryAction={primaryAction} actions={actions} />
					{children}
				</div>
			</div>
		</section>
	);
}
