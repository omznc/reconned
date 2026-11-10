import { ChevronRight, Clock, MapPin, UserPlus } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Image } from "@/components/image";
import { formatDateParts, formatTimeRange, HOT_SHARE, takenShare } from "@/components/redesign/format-event-date";
import type { Href } from "@/components/redesign/types";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Link } from "@/i18n/navigation";
import type { LogoTile } from "@/lib/identity";
import { toIntlLocale } from "@/lib/intl-locale";
import { cn } from "@/lib/utils";

export type EventRowState = "open" | "pending" | "closing" | "closed" | "full";

interface EventRowClub {
	name: string;
	logo?: string | null;
	logoTile?: LogoTile | null;
	verified?: boolean;
}

interface EventRowProps {
	/** The event page. The event name is the link and its hit area covers the card. */
	href: Href;
	name: string;
	dateStart: string | Date;
	dateEnd?: string | Date | null;
	/** `date` shows the date tile. `thumb` shows the poster on a wide row and the date tile on a narrow row. */
	variant?: "date" | "thumb";
	image?: string | null;
	state?: EventRowState;
	/** Replaces the default chip text, for example "Closes in 3 days" or "Opens 1 Dec". */
	stateLabel?: string;
	club?: EventRowClub;
	place?: string | null;
	freelancers?: boolean;
	placesLeft?: number | null;
	maxAttendees?: number | null;
	/** `0` is free. A missing price shows nothing. */
	price?: number | null;
	currency?: string;
	/** When set and the state is `open`, the row shows a real Apply link. */
	applyHref?: Href;
	className?: string;
}

const DOT: Record<EventRowState, string> = {
	open: "bg-status-open",
	pending: "bg-transparent ring-[1.5px] ring-inset ring-muted-foreground",
	closing: "bg-status-soon",
	closed: "bg-muted-foreground",
	full: "bg-status-full",
};

export function StatusChip({ state, label }: { state: EventRowState; label?: string }) {
	const t = useExtracted();
	const defaults: Record<EventRowState, string> = {
		open: t("Registration open"),
		pending: t("Opens soon"),
		closing: t("Closing soon"),
		closed: t("Closed"),
		full: t("Full"),
	};
	return (
		<span
			className={cn(
				"inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary px-2.5 text-xs font-medium leading-none",
				state === "closed" ? "text-muted-foreground" : "text-secondary-foreground",
			)}
		>
			<span className={cn("size-[7px] rounded-full", DOT[state])} aria-hidden={true} />
			{label ?? defaults[state]}
		</span>
	);
}

function DateTile({ start, className }: { start: string | Date; className?: string }) {
	const locale = useLocale();
	const { weekday, day, month } = formatDateParts(start, locale);
	return (
		<div
			className={cn(
				"flex w-[60px] shrink-0 flex-col items-center justify-center self-start rounded-xl bg-secondary pt-[9px] pb-2 leading-none",
				className,
			)}
		>
			<span className="text-[11px] text-muted-foreground">{weekday}</span>
			<span className="mt-1 mb-[3px] text-[22px] font-bold tabular-nums">{day}</span>
			<span className="text-[11px]">{month}</span>
		</div>
	);
}

function Poster({ image, time }: { image?: string | null; time: string }) {
	return (
		<div className="relative hidden h-28 w-[168px] shrink-0 self-start overflow-hidden rounded-xl bg-muted @min-[640px]/row:block">
			{image ? <Image src={image} alt="" fill={true} sizes="168px" className="object-cover" /> : null}
			<span className="absolute bottom-2 left-2 rounded-full bg-background px-2.5 py-1 text-xs font-semibold tabular-nums">
				{time}
			</span>
		</div>
	);
}

function ClubMini({ club }: { club: EventRowClub }) {
	const t = useExtracted();
	return (
		<span className="flex min-w-0 items-center gap-1.5 text-foreground">
			<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={22} />
			<span className="truncate">{club.name}</span>
			{club.verified ? <VerifiedBadge label={t("Verified club")} className="text-sm" /> : null}
		</span>
	);
}

function PlacesMeter({ left, max }: { left: number; max: number }) {
	const t = useExtracted();
	const taken = max - left;
	return (
		<progress
			className="meter"
			max={max}
			value={Math.min(Math.max(taken, 0), max)}
			data-hot={takenShare(left, max) >= HOT_SHARE}
			aria-label={t("{left} of {max} places left", { left: String(left), max: String(max) })}
		/>
	);
}

function PlacesDesktop({ left, max }: { left: number; max: number }) {
	const t = useExtracted();
	return (
		<div className="hidden w-[168px] shrink-0 flex-col gap-1.5 @min-[640px]/row:flex">
			<div className="flex justify-between text-xs">
				<span className="text-muted-foreground">{t("Places left")}</span>
				<span className="tabular-nums">
					<b>{left}</b> / {max}
				</span>
			</div>
			<PlacesMeter left={left} max={max} />
		</div>
	);
}

function PlacesMobile({ left, max, price }: { left?: number; max?: number; price?: string }) {
	const t = useExtracted();
	const hasPlaces = left !== undefined && max !== undefined;
	return (
		<div className="mt-1 flex items-center gap-3 text-xs @min-[640px]/row:hidden">
			{hasPlaces ? (
				<>
					<span className="w-16 shrink-0 @min-[400px]/row:w-24">
						<PlacesMeter left={left} max={max} />
					</span>
					<span className="whitespace-nowrap tabular-nums">
						{t("{left} of {max} left", { left: String(left), max: String(max) })}
					</span>
				</>
			) : null}
			{price ? <b className="ml-auto whitespace-nowrap tabular-nums">{price}</b> : null}
		</div>
	);
}

function PriceBlock({ price, free }: { price: string; free: boolean }) {
	const t = useExtracted();
	return (
		<div className="hidden w-[92px] shrink-0 flex-col items-end gap-0.5 @min-[640px]/row:flex">
			<b className="text-[15px] tabular-nums">{price}</b>
			{free ? null : <span className="text-xs text-muted-foreground">{t("per person")}</span>}
		</div>
	);
}

function ActionButton({ state, applyHref }: { state: EventRowState; applyHref?: Href }) {
	const t = useExtracted();
	const base =
		"hidden h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap @min-[640px]/row:inline-flex";
	if (applyHref && state === "open") {
		return (
			<Link
				href={applyHref}
				className={cn(
					base,
					"relative z-10 bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50",
				)}
			>
				{t("Apply")}
			</Link>
		);
	}
	return (
		<span className={cn(base, "bg-secondary text-secondary-foreground")} aria-hidden={true}>
			{t("View")}
			<ChevronRight className="size-3.5" />
		</span>
	);
}

function formatPrice(price: number, currency: string, free: string, locale: string) {
	return price === 0 ? free : `${new Intl.NumberFormat(toIntlLocale(locale)).format(price)} ${currency}`;
}

export function EventRow({
	href,
	name,
	dateStart,
	dateEnd,
	variant = "date",
	image,
	state = "open",
	stateLabel,
	club,
	place,
	freelancers,
	placesLeft,
	maxAttendees,
	price,
	currency = "KM",
	applyHref,
	className,
}: EventRowProps) {
	const t = useExtracted();
	const locale = useLocale();
	const time = formatTimeRange(dateStart, dateEnd, locale);
	const left = placesLeft ?? undefined;
	const max = maxAttendees ?? undefined;
	const hasPlaces = left !== undefined && max !== undefined;
	const priceText =
		price === null || price === undefined ? undefined : formatPrice(price, currency, t("Free"), locale);

	return (
		<article
			className={cn(
				"@container/row relative flex items-center gap-4 rounded-lg border bg-card p-3 text-card-foreground transition-colors focus-within:border-foreground/30 hover:border-foreground/30",
				className,
			)}
		>
			{variant === "thumb" ? <Poster image={image} time={time} /> : null}
			<DateTile start={dateStart} className={variant === "thumb" ? "@min-[640px]/row:hidden" : undefined} />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<StatusChip state={state} label={stateLabel} />
					{variant === "date" ? (
						<span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
							<Clock className="size-3" aria-hidden={true} />
							{time}
						</span>
					) : null}
					{freelancers ? (
						<span className="hidden h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium shadow-[inset_0_0_0_1px_hsl(var(--border))] @min-[640px]/row:inline-flex">
							<UserPlus className="size-3.5" aria-hidden={true} />
							{t("Freelancers")}
						</span>
					) : null}
				</div>
				<h3 className="line-clamp-2 text-[15px] font-semibold leading-[22px] [overflow-wrap:anywhere]">
					<Link
						href={href}
						className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
					>
						{name}
					</Link>
				</h3>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					{club ? <ClubMini club={club} /> : null}
					{place ? (
						<span className="flex min-w-0 items-center gap-1.5">
							<MapPin className="size-3 shrink-0" aria-hidden={true} />
							<span className="truncate">{place}</span>
						</span>
					) : null}
				</div>
				<PlacesMobile left={left} max={max} price={priceText} />
			</div>
			{hasPlaces ? <PlacesDesktop left={left} max={max} /> : null}
			{priceText ? <PriceBlock price={priceText} free={price === 0} /> : null}
			<ActionButton state={state} applyHref={applyHref} />
		</article>
	);
}
