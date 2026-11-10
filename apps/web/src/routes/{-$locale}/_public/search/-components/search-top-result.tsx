import { ChevronRight, MapPin, Star, Users } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import type { ReactNode } from "react";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { formatDateParts } from "@/components/redesign/format-event-date";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import type {
	ClubItem,
	EventItem,
	SearchResponse,
	UserItem,
} from "@/routes/{-$locale}/_public/search/-components/use-search-data";

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
	return (
		<span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-xs">
			{icon}
			{children}
		</span>
	);
}

function DateBox({ date }: { date: string }) {
	const locale = useLocale();
	const { day, month } = formatDateParts(date, locale);
	return (
		<span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-background py-1.5 leading-none">
			<span className="text-[11px] text-muted-foreground">{month}</span>
			<span className="mt-1 text-lg font-bold tabular-nums">{day}</span>
		</span>
	);
}

function NextGame({ game }: { game: NonNullable<ClubItem["data"]["nextGame"]> }) {
	const t = useExtracted();
	return (
		<div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
			<DateBox date={game.dateStart} />
			<div className="min-w-0">
				<p className="text-[11px] text-muted-foreground">{t("Next game")}</p>
				<Link
					href={`/events/${game.slug || game.id}`}
					className="block truncate text-sm font-semibold outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{game.name}
				</Link>
				{game.placesLeft !== null && game.maxAttendees !== null ? (
					<p className="text-xs text-muted-foreground tabular-nums">
						{t("{left} of {max} left", { left: String(game.placesLeft), max: String(game.maxAttendees) })}
					</p>
				) : null}
			</div>
		</div>
	);
}

interface FrameProps {
	kind: string;
	lead: ReactNode;
	title: ReactNode;
	chips?: ReactNode;
	text?: string | null;
	aside?: ReactNode;
	href: string;
}

/** The title link stretches over the whole card. The next-game link sits above it, because links cannot nest. */
function Frame({ kind, lead, title, chips, text, aside, href }: FrameProps) {
	const t = useExtracted();
	return (
		<section
			aria-label={t("Top result")}
			className="@container relative rounded-lg border bg-card p-6 transition-colors hover:border-brand/50 has-[a[data-card-link]:focus-visible]:ring-[3px] has-[a[data-card-link]:focus-visible]:ring-ring/50 @max-md:p-4"
		>
			<div className="flex items-center gap-4">
				<div className="grid min-w-0 flex-1 gap-5 @min-[640px]:grid-cols-[1fr_minmax(0,260px)]">
					<div className="flex flex-col gap-4 @min-[420px]:flex-row">
						<div className="shrink-0">{lead}</div>
						<div className="flex min-w-0 flex-col gap-2">
							<p className="text-xs text-muted-foreground">
								{t("Top result")} · {kind}
							</p>
							<h2 className="text-2xl font-bold leading-tight [overflow-wrap:anywhere]">
								<Link
									href={href}
									data-card-link={true}
									className="flex flex-wrap items-center gap-2 outline-none after:absolute after:inset-0 after:rounded-lg"
								>
									{title}
								</Link>
							</h2>
							{chips ? <div className="flex flex-wrap gap-1.5">{chips}</div> : null}
							{text ? (
								<p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">{text}</p>
							) : null}
						</div>
					</div>
					{aside ? <div className="relative z-10 flex flex-col justify-end">{aside}</div> : null}
				</div>
				<ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden={true} />
			</div>
		</section>
	);
}

function ClubTop({ item }: { item: ClubItem }) {
	const t = useExtracted();
	const club = item.data;
	return (
		<Frame
			kind={t("Club")}
			lead={<ClubAvatar name={item.name} logo={club.logo} tile={club.logoTile} size={72} />}
			title={
				<>
					<span className="font-club">{item.name}</span>
					{club.verified ? <VerifiedBadge label={t("Verified club")} /> : null}
				</>
			}
			chips={
				<>
					{club.location ? (
						<Chip icon={<MapPin className="size-3" aria-hidden={true} />}>{club.location}</Chip>
					) : null}
					<Chip icon={<Users className="size-3" aria-hidden={true} />}>
						{t("{count} members", { count: String(club.memberCount) })}
					</Chip>
					{club.rating ? (
						<Chip icon={<Star className="size-3 fill-current" aria-hidden={true} />}>
							{club.rating.average.toFixed(1)}
						</Chip>
					) : null}
				</>
			}
			text={club.description}
			aside={club.nextGame ? <NextGame game={club.nextGame} /> : null}
			href={`/clubs/${club.slug || item.id}`}
		/>
	);
}

function PlayerTop({ item }: { item: UserItem }) {
	const t = useExtracted();
	const user = item.data;
	return (
		<Frame
			kind={t("Player")}
			lead={
				<Avatar className="size-[72px]">
					<AvatarImage src={user.image ?? ""} alt="" />
					<AvatarFallback name={item.name} />
				</Avatar>
			}
			title={<span className="font-person">{user.callsign || item.name}</span>}
			chips={
				<>
					{user.callsign ? <Chip>{item.name}</Chip> : null}
					{user.mainClub ? <Chip>{user.mainClub.name}</Chip> : null}
					{user.location ? (
						<Chip icon={<MapPin className="size-3" aria-hidden={true} />}>{user.location}</Chip>
					) : null}
				</>
			}
			text={user.bio}
			href={`/users/${user.slug || item.id}`}
		/>
	);
}

function EventTop({ item }: { item: EventItem }) {
	const t = useExtracted();
	const event = item.data;
	return (
		<Frame
			kind={t("Event")}
			lead={event.dateStart ? <DateBox date={event.dateStart} /> : null}
			title={item.name}
			chips={
				<>
					{event.club ? <Chip>{event.club.name}</Chip> : null}
					{event.location ? (
						<Chip icon={<MapPin className="size-3" aria-hidden={true} />}>{event.location}</Chip>
					) : null}
				</>
			}
			text={event.description}
			href={`/events/${event.slug || item.id}`}
		/>
	);
}

export function TopResult({ item }: { item: NonNullable<SearchResponse["topResult"]> }) {
	if (item.type === "club") {
		return <ClubTop item={item} />;
	}
	if (item.type === "user") {
		return <PlayerTop item={item} />;
	}
	return <EventTop item={item} />;
}
