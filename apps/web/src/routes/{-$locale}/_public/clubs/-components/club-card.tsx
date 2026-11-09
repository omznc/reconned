import { CalendarDays, MapPin, ShieldCheck, Star, Users } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { formatDateParts } from "@/components/redesign/format-event-date";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Link } from "@/i18n/navigation";
import type { ClubListItem } from "@/lib/api/api-type-helpers";

function NextGame({ game }: { game: NonNullable<ClubListItem["nextGame"]> }) {
	const t = useExtracted();
	const locale = useLocale();
	const { weekday, day, month } = formatDateParts(game.date, locale);
	let places = t("open");
	if (game.placesLeft === 0) {
		places = t("full");
	} else if (game.placesLeft !== null) {
		places = t("{count, plural, one {# place left} other {# places left}}", { count: game.placesLeft });
	}
	return (
		<div className="col-span-2 flex min-w-0 flex-col gap-0.5 @min-[640px]:col-span-1 @min-[640px]:items-end @min-[640px]:text-right">
			<span className="text-[11px] text-muted-foreground">{t("Next game")}</span>
			<span className="truncate text-[13px] font-semibold">{game.name}</span>
			<span className="text-xs text-muted-foreground tabular-nums">
				{weekday} {day} {month} · {places}
			</span>
		</div>
	);
}

function ClubBadges({ club }: { club: ClubListItem }) {
	const t = useExtracted();
	if (!(club.isAllied || club.rating)) {
		return null;
	}
	return (
		<div className="flex flex-wrap items-center gap-2 text-xs">
			{club.isAllied ? (
				<span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium">
					<ShieldCheck className="size-3" aria-hidden={true} />
					{t("Allied")}
				</span>
			) : null}
			{club.rating ? (
				<span className="inline-flex items-center gap-1 font-semibold tabular-nums">
					<Star className="size-3 fill-status-soon text-status-soon" aria-hidden={true} />
					{club.rating.average.toFixed(1)}
					<span className="sr-only">{t("rating")}</span>
				</span>
			) : null}
		</div>
	);
}

export function ClubCard({ club }: { club: ClubListItem }) {
	const t = useExtracted();
	const since = club.dateFounded ? new Date(club.dateFounded.replace(" ", "T")).getFullYear() : null;
	const city = club.city || club.location;
	return (
		<article className="relative grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-lg border bg-card p-3.5 text-card-foreground transition-colors focus-within:border-foreground/30 hover:border-foreground/30 @min-[640px]:grid-cols-[auto_1fr_auto]">
			<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={72} />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<ClubBadges club={club} />
				<h2 className="flex min-w-0 items-center gap-1 text-base leading-5 font-bold">
					<Link
						href={`/clubs/${club.slug || club.id}`}
						className="truncate outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
					>
						{club.name}
					</Link>
					{club.verified ? <VerifiedBadge label={t("Verified club")} /> : null}
				</h2>
				<ul className="m-0 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0 text-xs text-muted-foreground">
					{city ? (
						<li className="inline-flex items-center gap-1">
							<MapPin className="size-3" aria-hidden={true} />
							{city}
						</li>
					) : null}
					<li className="inline-flex items-center gap-1 tabular-nums">
						<Users className="size-3" aria-hidden={true} />
						{t("{count, plural, one {# member} other {# members}}", { count: club.memberCount })}
					</li>
					{since ? (
						<li className="inline-flex items-center gap-1 tabular-nums">
							<CalendarDays className="size-3" aria-hidden={true} />
							{t("Since {year}", { year: String(since) })}
						</li>
					) : null}
				</ul>
			</div>
			{club.nextGame ? <NextGame game={club.nextGame} /> : null}
		</article>
	);
}
