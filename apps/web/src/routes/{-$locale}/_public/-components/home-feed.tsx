import { createServerFn } from "@tanstack/react-start";
import { Building2, Calendar, KeyRound, MapPin, MessageSquare, Star, Users } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import * as z from "zod";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Image } from "@/components/image";
import { formatDateParts, HOT_SHARE, takenShare, toDate } from "@/components/redesign/format-event-date";
import { MiniStatChip } from "@/components/redesign/mini-stat-chip";
import { SectionCard } from "@/components/redesign/section-card";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { paths } from "@/lib/api/api-types";
import { toIntlLocale } from "@/lib/intl-locale";
import { asJson } from "@/lib/server/json";

type FeedType = "all" | "games" | "posts" | "reviews" | "clubs";
type FeedResponse = paths["/public/feed"]["get"]["responses"][200]["content"]["application/json"];
export type FeedItem = FeedResponse["items"][number];
export type FeedPage = { items: FeedItem[]; nextCursor: string | null };
export type NextGame = {
	id: string;
	slug: string | null;
	name: string;
	city: string | null;
	location: string;
	dateStart: string;
	placesLeft: number | null;
	maxAttendees: number | null;
	registrationState: "open" | "notOpenYet" | "closed" | "full";
};

const FEED_TYPES: FeedType[] = ["all", "games", "posts", "reviews", "clubs"];

const getFeedFn = createServerFn({ method: "GET" })
	.validator(z.object({ type: z.enum(FEED_TYPES), cursor: z.string().optional() }))
	.handler(async ({ data }) => {
		const { data: page } = await apiServer.GET("/api/public/feed", {
			params: { query: { type: data.type, cursor: data.cursor, limit: 10 } },
		});
		if (!page) {
			// The UI shows its retry state for a thrown error; an empty page would look like the end of the feed.
			throw new Error("The feed request failed");
		}
		return asJson(page);
	});

/** The post content is an HTML excerpt that can stop inside a tag. */
function htmlToText(html: string): string {
	return html
		.replace(/<[^>]*(>|$)/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/** Relative time needs the clock, so the first render (server and client) shows a fixed UTC date instead. */
function useTimeAgo() {
	const locale = useLocale();
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => setNow(Date.now()), []);
	const intlLocale = toIntlLocale(locale);
	const formatter = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
	const absolute = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "UTC" });
	return (value: string) => {
		if (now === null) {
			return absolute.format(toDate(value));
		}
		const seconds = Math.round((toDate(value).getTime() - now) / 1000);
		const steps: [Intl.RelativeTimeFormatUnit, number][] = [
			["year", 31536000],
			["month", 2592000],
			["day", 86400],
			["hour", 3600],
			["minute", 60],
		];
		for (const [unit, size] of steps) {
			if (Math.abs(seconds) >= size) {
				return formatter.format(Math.round(seconds / size), unit);
			}
		}
		return formatter.format(seconds, "second");
	};
}

function DateBlock({ value }: { value: string }) {
	const locale = useLocale();
	const { weekday, day, month } = formatDateParts(value, locale);
	return (
		<div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-secondary py-2 leading-none">
			<span className="text-[11px] text-muted-foreground">{weekday}</span>
			<span className="my-1 text-xl font-bold tabular-nums">{day}</span>
			<span className="text-[11px]">{month}</span>
		</div>
	);
}

function GameBlock({ item }: { item: Extract<FeedItem, { kind: "game" }> }) {
	const t = useExtracted();
	const { event } = item;
	const href = `/events/${event.slug || item.id}` as const;
	const max = event.maxAttendees;
	const left = event.placesLeft;
	const price = event.costPerPerson > 0 ? `${event.costPerPerson} KM` : t("Free");
	return (
		<div className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
			<DateBlock value={event.dateStart} />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs">
				<span className="truncate text-muted-foreground">
					{event.location} · {price}
				</span>
				{max !== null && left !== null ? (
					<>
						<progress
							className="meter"
							max={max}
							value={Math.min(Math.max(max - left, 0), max)}
							data-hot={takenShare(left, max) >= HOT_SHARE}
							aria-label={t("{left} of {max} places left", { left: String(left), max: String(max) })}
						/>
						<span className="tabular-nums">
							{t("{left} of {max} places left", { left: String(left), max: String(max) })}
						</span>
					</>
				) : null}
			</div>
			<Button asChild={true} size="sm">
				<Link href={href}>{t("Apply")}</Link>
			</Button>
		</div>
	);
}

function Stars({ rating }: { rating: number }) {
	const t = useExtracted();
	return (
		<span role="img" aria-label={t("{rating} out of 5", { rating: String(rating) })} className="text-brand">
			{"★".repeat(rating)}
			<span className="text-muted-foreground">{"★".repeat(Math.max(0, 5 - rating))}</span>
		</span>
	);
}

type Person = { id: string; slug: string | null; name: string; image: string | null };

/** Player reviews are the only items without a club. */
function clubOf(item: FeedItem) {
	return "club" in item ? item.club : null;
}

function personOf(item: FeedItem): Person | null {
	return item.kind === "review" || item.kind === "player_review" ? item.review.author : null;
}

function useFeedMeta(item: FeedItem) {
	const t = useExtracted();
	switch (item.kind) {
		case "game":
			return { icon: Calendar, type: t("Game"), verb: t("published a game") };
		case "post":
			return { icon: MessageSquare, type: t("Post"), verb: t("posted") };
		case "review":
			return { icon: Star, type: t("Review"), verb: t("reviewed {name}", { name: item.review.target.name }) };
		case "player_review":
			return { icon: Star, type: t("Review"), verb: t("reviewed {name}", { name: item.review.player.name }) };
		case "club":
			return { icon: Building2, type: t("Club"), verb: t("joined RECONNED") };
		case "claim":
			return { icon: KeyRound, type: t("Claimed"), verb: t("got an owner") };
		default: {
			const others = item.clubs.length - 1;
			const verb =
				others > 0
					? t("and {count} more clubs joined {alliance}", {
							count: String(others),
							alliance: item.alliance.name,
						})
					: t("joined {alliance}", { alliance: item.alliance.name });
			return { icon: Users, type: t("Alliance"), verb };
		}
	}
}

function FeedAuthor({ item }: { item: FeedItem }) {
	const person = personOf(item);
	if (person) {
		return (
			<Avatar className="size-10">
				<AvatarImage src={person.image ?? ""} alt="" />
				<AvatarFallback name={person.name} />
			</Avatar>
		);
	}
	const club = clubOf(item);
	return club ? <ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={40} /> : null;
}

function FeedImage({ src }: { src: string }) {
	return (
		<div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
			<Image src={src} alt="" fill={true} sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
		</div>
	);
}

/** The clubs that joined an alliance on that day, each a link to its profile. */
function AllianceBody({ item }: { item: Extract<FeedItem, { kind: "alliance" }> }) {
	return (
		<ul className="flex flex-wrap gap-2">
			{item.clubs.map((club) => (
				<li key={club.id}>
					<Link
						href={`/clubs/${club.slug || club.id}` as "/clubs"}
						className="flex items-center gap-2 rounded-lg border bg-secondary/40 py-1.5 pr-3 pl-1.5 text-[13px] font-medium outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={28} />
						{club.name}
						{club.verified ? <VerifiedBadge label={club.name} /> : null}
					</Link>
				</li>
			))}
		</ul>
	);
}

function ClubBody({ item }: { item: Extract<FeedItem, { kind: "club" }> }) {
	const t = useExtracted();
	const href = `/clubs/${item.club.slug || item.club.id}` as "/clubs";
	return (
		<div className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
			<div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
				<span className="truncate font-semibold">{item.club.name}</span>
				{item.city ? (
					<span className="flex items-center gap-1 text-xs text-muted-foreground">
						<MapPin className="size-3.5 shrink-0" aria-hidden={true} />
						{item.city}
					</span>
				) : null}
			</div>
			<Button asChild={true} size="sm" variant="secondary">
				<Link href={href}>{t("View club")}</Link>
			</Button>
		</div>
	);
}

/** The new owner, when that profile is public, and a link to the club. */
function ClaimBody({ item }: { item: Extract<FeedItem, { kind: "claim" }> }) {
	const t = useExtracted();
	const { owner } = item;
	return (
		<div className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
			{owner ? (
				<Link
					href={`/users/${owner.slug || owner.id}` as "/users"}
					className="flex min-w-0 flex-1 items-center gap-2 text-[13px] hover:underline"
				>
					<Avatar className="size-8">
						<AvatarImage src={owner.image ?? ""} alt="" />
						<AvatarFallback name={owner.name} />
					</Avatar>
					<span className="flex min-w-0 flex-col">
						<span className="truncate font-semibold">{owner.name}</span>
						<span className="text-xs text-muted-foreground">{t("Owner")}</span>
					</span>
				</Link>
			) : (
				<span className="flex-1 text-[13px] text-muted-foreground">{t("The club now has an owner.")}</span>
			)}
			<Button asChild={true} size="sm" variant="secondary">
				<Link href={`/clubs/${item.club.slug || item.club.id}` as "/clubs"}>{t("View club")}</Link>
			</Button>
		</div>
	);
}

function FeedBody({ item }: { item: FeedItem }) {
	switch (item.kind) {
		case "game":
			return (
				<>
					<h3 className="text-base font-semibold">{item.event.name}</h3>
					<p className="line-clamp-3 text-[13px] text-muted-foreground">
						{htmlToText(item.event.description)}
					</p>
					{item.event.image ? <FeedImage src={item.event.image} /> : null}
					<GameBlock item={item} />
				</>
			);
		case "post":
			return (
				<>
					<h3 className="text-base font-semibold">{item.post.title}</h3>
					<p className="line-clamp-4 text-[13px] text-muted-foreground">{htmlToText(item.post.content)}</p>
					{item.post.images[0] ? <FeedImage src={item.post.images[0]} /> : null}
				</>
			);
		case "review":
		case "player_review":
			return (
				<>
					<h3 className="text-base font-semibold">
						<Stars rating={item.review.rating} />
					</h3>
					<p className="text-[13px] text-muted-foreground">{item.review.content}</p>
				</>
			);
		case "club":
			return <ClubBody item={item} />;
		case "claim":
			return <ClaimBody item={item} />;
		default:
			return <AllianceBody item={item} />;
	}
}

function FeedCard({ item }: { item: FeedItem }) {
	const t = useExtracted();
	const ago = useTimeAgo();
	const meta = useFeedMeta(item);
	const person = personOf(item);
	const club = clubOf(item);
	const who = person?.name ?? club?.name ?? "";
	const whoHref = person ? `/users/${person.slug || person.id}` : `/clubs/${club?.slug || club?.id}`;
	return (
		<article className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground">
			<header className="flex items-center gap-3">
				<FeedAuthor item={item} />
				<div className="flex min-w-0 flex-1 flex-col text-[13px]">
					<span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
						<Link
							href={whoHref as "/clubs"}
							className="inline-flex items-center gap-1 font-semibold hover:underline"
						>
							{who}
							{!person && club?.verified ? <VerifiedBadge label={t("Verified club")} /> : null}
						</Link>
						<span className="text-muted-foreground">{meta.verb}</span>
					</span>
					<time className="text-xs text-muted-foreground" dateTime={toDate(item.createdAt).toISOString()}>
						{ago(item.createdAt)}
					</time>
				</div>
				<MiniStatChip icon={meta.icon} value={meta.type} />
			</header>
			<FeedBody item={item} />
		</article>
	);
}

const TAB_ORDER = FEED_TYPES;

export function HomeFeed({ initial }: { initial: FeedPage }) {
	const t = useExtracted();
	const [type, setType] = useState<FeedType>("all");
	const [pages, setPages] = useState<Record<FeedType, FeedPage | undefined>>({
		all: initial,
		games: undefined,
		posts: undefined,
		reviews: undefined,
		clubs: undefined,
	});
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);
	const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
	const labels: Record<FeedType, string> = {
		all: t("All"),
		games: t("Games"),
		posts: t("Posts"),
		reviews: t("Reviews"),
		clubs: t("Clubs"),
	};

	const load = async (next: FeedType, cursor?: string) => {
		setLoading(true);
		setFailed(false);
		try {
			const page = await getFeedFn({ data: { type: next, cursor } });
			setPages((prev) => ({
				...prev,
				[next]: {
					items: [...(cursor ? (prev[next]?.items ?? []) : []), ...page.items],
					nextCursor: page.nextCursor,
				},
			}));
		} catch {
			setFailed(true);
		} finally {
			setLoading(false);
		}
	};

	const select = (next: FeedType) => {
		setType(next);
		if (!pages[next]) {
			void load(next);
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const index = TAB_ORDER.indexOf(type);
		const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
		if (step === 0) {
			return;
		}
		event.preventDefault();
		const next = TAB_ORDER[(index + step + TAB_ORDER.length) % TAB_ORDER.length] ?? "all";
		select(next);
		tabRefs.current[next]?.focus();
	};

	const page = pages[type];

	return (
		<div className="flex min-w-0 flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-xl font-semibold tracking-tight">{t("What's happening")}</h2>
				<div role="tablist" aria-label={t("Feed filter")} className="inline-flex rounded-lg bg-secondary p-0.5">
					{TAB_ORDER.map((key) => (
						<button
							key={key}
							ref={(node) => {
								tabRefs.current[key] = node;
							}}
							type="button"
							role="tab"
							id={`feed-tab-${key}`}
							aria-selected={key === type}
							aria-controls="feed-panel"
							tabIndex={key === type ? 0 : -1}
							onClick={() => select(key)}
							onKeyDown={onKeyDown}
							className="h-8 rounded-md px-3 text-[13px] text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-sm"
						>
							{labels[key]}
						</button>
					))}
				</div>
			</div>
			<div
				id="feed-panel"
				role="tabpanel"
				aria-labelledby={`feed-tab-${type}`}
				aria-busy={loading}
				className="flex flex-col gap-4"
			>
				{page?.items.map((item) => (
					<FeedCard key={`${item.kind}-${item.id}`} item={item} />
				))}
				{page && page.items.length === 0 ? (
					<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
						{t("Nothing here yet.")}
					</p>
				) : null}
				{failed ? (
					<p role="alert" className="text-sm text-muted-foreground">
						{t("The feed did not load. Try again.")}
					</p>
				) : null}
				{loading && !page ? <p className="text-sm text-muted-foreground">{t("Loading...")}</p> : null}
				{page?.nextCursor || failed ? (
					<Button
						variant="secondary"
						disabled={loading}
						onClick={() => void load(type, page?.nextCursor ?? undefined)}
						className="self-center"
					>
						{loading ? t("Loading...") : failed ? t("Try again") : t("Load more")}
					</Button>
				) : null}
			</div>
		</div>
	);
}

function NextGameRow({ game }: { game: NextGame }) {
	const t = useExtracted();
	const locale = useLocale();
	const { day, month } = formatDateParts(game.dateStart, locale);
	const status =
		game.registrationState === "full"
			? t("Full")
			: game.registrationState === "closed"
				? t("Closed")
				: game.registrationState === "notOpenYet"
					? t("Opens soon")
					: game.placesLeft !== null && game.maxAttendees !== null
						? t("{left} of {max} left", { left: String(game.placesLeft), max: String(game.maxAttendees) })
						: null;
	return (
		<li>
			<Link
				href={`/events/${game.slug || game.id}`}
				className="flex items-center gap-3 rounded-md p-1.5 outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-secondary py-1.5 leading-none">
					<span className="text-[10px] text-muted-foreground">{month}</span>
					<span className="mt-0.5 text-base font-bold tabular-nums">{day}</span>
				</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-[13px] font-semibold">{game.name}</span>
					<span className="truncate text-xs text-muted-foreground">
						{[game.city ?? game.location, status].filter(Boolean).join(" · ")}
					</span>
				</span>
			</Link>
		</li>
	);
}

export function NextGames({ games }: { games: NextGame[] }) {
	const t = useExtracted();
	return (
		<SectionCard
			title={t("Next games")}
			headingLevel={2}
			action={{ href: "/events", label: t("All") }}
			bodyClassName="py-3"
		>
			{games.length === 0 ? (
				<p className="flex items-center gap-2 text-[13px] text-muted-foreground">
					<Building2 className="size-4 shrink-0" aria-hidden={true} />
					{t("There are no upcoming matches")}
				</p>
			) : (
				<ul className="flex flex-col gap-1">
					{games.map((game) => (
						<NextGameRow key={game.id} game={game} />
					))}
				</ul>
			)}
		</SectionCard>
	);
}
