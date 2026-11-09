import {
	Calendar,
	ChevronRight,
	Coffee,
	CupSoda,
	Eye,
	EyeOff,
	FileText,
	MapPin,
	Pencil,
	Ticket,
	Trophy,
	UserPlus,
	Utensils,
} from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import type { ComponentType } from "react";
import AddEventToCalendarButton from "@/components/add-event-to-calendar-button";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Image } from "@/components/image";
import { normalizeMapData, snapshotHasData } from "@/components/map-editor/map-data";
import { MapViewer } from "@/components/map-editor/map-viewer-wrapper";
import { ExpandableDescription } from "@/components/overviews/expandable-description";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { StatusChip } from "@/components/redesign/event-row";
import { HOT_SHARE, takenShare, toDate } from "@/components/redesign/format-event-date";
import { SectionCard } from "@/components/redesign/section-card";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { DEFAULT_TIME_ZONE } from "@/i18n/routing";
import type { ApiResponse, ClubRule, Event } from "@/lib/api/api-type-helpers";
import type { LogoTile } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { registrationState, timelineSteps } from "@/routes/{-$locale}/_public/events/$id/-lib/registration-state";

interface ProfileClub {
	id: string;
	name: string;
	slug: string | null;
	logo: string | null;
	verified: boolean;
}

type ProfileEvent = Event & {
	_count: { eventRegistration: number };
	rules: ClubRule[];
	club: ProfileClub;
};

interface EventProfileProps {
	event: ProfileEvent;
	clubId: string;
	/** From the club endpoint. Each value is `null` when that call failed. */
	club: { city: string | null; memberCount: number | null; logoTile: LogoTile | null };
	/** The signed-in user manages the event's club. */
	canEdit: boolean;
	/** The `EVENT_REGISTRATION` feature flag, from the route loader. */
	eventRegistrationEnabled: boolean;
	reviews?: ApiResponse<"/api/reviews/{type}/{id}", "get">["reviews"];
	/** Remaining places, or null when the event has no attendee limit. */
	placesLeft: number | null;
}

const CURRENCY = "KM";

function useFormatWhen() {
	const locale = useLocale();
	return (value: string, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale, { timeZone: DEFAULT_TIME_ZONE, ...options }).format(toDate(value));
}

/** The city is the first part of the free-text location, for example "Kakanj, Igman". */
function cityOf(location: string | null | undefined) {
	return location?.split(",")[0]?.trim() || null;
}

function Hero({ event }: { event: ProfileEvent }) {
	const t = useExtracted();
	const city = cityOf(event.location);
	const club = event.club;
	const chip =
		"inline-flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-medium text-white backdrop-blur-sm";
	return (
		<section className="relative flex min-h-[300px] items-end overflow-hidden rounded-t-lg bg-neutral-900 @container">
			{event.image ? (
				<Image
					src={event.image}
					alt=""
					fill={true}
					priority={true}
					draggable={false}
					sizes="(max-width: 1200px) 100vw, 1200px"
					className="object-cover"
				/>
			) : null}
			<div className="relative flex w-full flex-col gap-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-28 text-white md:p-8 md:pt-32">
				<nav aria-label={t("Breadcrumb")} className="flex items-center gap-1 text-xs text-white/75">
					<Link href="/events" className="rounded-sm hover:text-white focus-visible:outline-2">
						{t("Events")}
					</Link>
					{city ? (
						<>
							<ChevronRight className="size-3" aria-hidden={true} />
							<span>{city}</span>
						</>
					) : null}
				</nav>
				<h1 className="text-balance text-4xl font-extrabold leading-[0.95] tracking-tighter md:text-6xl">
					{event.name}
				</h1>
				<div className="flex flex-wrap gap-2">
					<Link href={`/clubs/${club.slug || club.id}`} className={cn(chip, "hover:bg-white/25")}>
						<ClubAvatar name={club.name} logo={club.logo} size={18} />
						{club.name}
						{club.verified ? <VerifiedBadge label={t("Verified club")} /> : null}
					</Link>
					<span className={chip}>
						{event.isPrivate ? (
							<EyeOff className="size-3.5" aria-hidden={true} />
						) : (
							<Eye className="size-3.5" aria-hidden={true} />
						)}
						{event.isPrivate ? t("Private event") : t("Public event")}
					</span>
					{event.allowFreelancers ? (
						<span className={chip}>
							<UserPlus className="size-3.5" aria-hidden={true} />
							{t("Freelancers OK")}
						</span>
					) : null}
				</div>
			</div>
		</section>
	);
}

function Fact({
	icon: Icon,
	title,
	children,
}: {
	icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
	title: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex min-w-[10rem] flex-1 items-center gap-3">
			<Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden={true} />
			<div className="flex min-w-0 flex-col gap-0.5">
				<b className="truncate text-sm tabular-nums">{title}</b>
				<span className="truncate text-xs text-muted-foreground">{children}</span>
			</div>
		</div>
	);
}

function PlacesBar({ event, placesLeft }: { event: ProfileEvent; placesLeft: number | null }) {
	const t = useExtracted();
	const state = registrationState({ ...event, placesLeft }, new Date());
	const max = event.maxAttendees;
	const hasLimit = placesLeft !== null && max !== null && max > 0;
	return (
		<div className="flex min-w-[12rem] flex-[1.2] flex-col gap-1.5">
			<div className="flex items-center justify-between gap-2 text-xs">
				<StatusChip state={state} />
				{hasLimit ? (
					<span className="tabular-nums">
						{t("{left} of {max} left", { left: String(placesLeft), max: String(max) })}
					</span>
				) : (
					<span className="tabular-nums">
						{t("{count} registered", { count: String(event._count.eventRegistration) })}
					</span>
				)}
			</div>
			{hasLimit ? (
				<progress
					className="meter"
					max={max}
					value={Math.min(Math.max(max - placesLeft, 0), max)}
					data-hot={takenShare(placesLeft, max) >= HOT_SHARE}
					aria-label={t("{left} of {max} places left", { left: String(placesLeft), max: String(max) })}
				/>
			) : null}
		</div>
	);
}

function ApplyAction({ event, placesLeft }: { event: ProfileEvent; placesLeft: number | null }) {
	const t = useExtracted();
	const state = registrationState({ ...event, placesLeft }, new Date());
	if (state === "open" || state === "full") {
		return (
			<Button asChild={true} size="lg" className="min-w-40 flex-1">
				<Link href={`/events/${event.id}/apply`}>
					{state === "full" ? t("Put me on the waiting list") : t("Apply to event")}
				</Link>
			</Button>
		);
	}
	return <p className="min-w-40 flex-1 text-center text-sm text-muted-foreground">{t("Applications closed")}</p>;
}

function EditAction({ clubId, eventId }: { clubId: string; eventId: string }) {
	const t = useExtracted();
	return (
		<Button asChild={true} variant="secondary" size="lg">
			<Link href={`/dashboard/${clubId}/events/create?id=${eventId}`}>
				<Pencil aria-hidden={true} />
				{t("Edit event")}
			</Link>
		</Button>
	);
}

function RegistrationBar({
	event,
	clubId,
	canEdit,
	eventRegistrationEnabled,
	placesLeft,
}: Pick<EventProfileProps, "event" | "clubId" | "canEdit" | "eventRegistrationEnabled" | "placesLeft">) {
	const t = useExtracted();
	const locale = useLocale();
	const formatWhen = useFormatWhen();
	const price =
		event.costPerPerson > 0
			? `${new Intl.NumberFormat(locale).format(event.costPerPerson)} ${CURRENCY}`
			: t("Free");
	const time = `${formatWhen(event.dateStart, { hour: "2-digit", minute: "2-digit", hour12: false })}${
		event.dateEnd ? ` – ${formatWhen(event.dateEnd, { hour: "2-digit", minute: "2-digit", hour12: false })}` : ""
	}`;
	return (
		<section
			aria-label={t("Registration")}
			className="flex flex-wrap items-center gap-x-4 gap-y-4 rounded-b-lg border border-t-0 bg-card p-4 md:px-5"
		>
			<Fact
				icon={Calendar}
				title={formatWhen(event.dateStart, { weekday: "short", day: "numeric", month: "short" })}
			>
				{time}
			</Fact>
			<Fact icon={MapPin} title={event.location || t("Location to be announced")}>
				{event.googleMapsLink ? (
					<a
						href={event.googleMapsLink}
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2"
					>
						{t("Google Maps")}
					</a>
				) : null}
			</Fact>
			<Fact icon={Ticket} title={price}>
				{event.costPerPerson > 0 ? t("per person") : null}
			</Fact>
			<PlacesBar event={event} placesLeft={placesLeft} />
			{eventRegistrationEnabled ? <ApplyAction event={event} placesLeft={placesLeft} /> : null}
			{canEdit ? <EditAction clubId={clubId} eventId={event.id} /> : null}
		</section>
	);
}

function Timeline({ event }: { event: ProfileEvent }) {
	const t = useExtracted();
	const formatWhen = useFormatWhen();
	const labels = [t("Opens"), t("Closes"), t("Game")];
	const steps = timelineSteps(event, new Date());
	return (
		<ol className="grid grid-cols-3 gap-2">
			{steps.map((step, index) => (
				<li
					key={labels[index]}
					className="flex flex-col gap-1 border-t-2 pt-2 text-xs data-[done=true]:border-status-open"
					data-done={step.done}
				>
					<span className="text-muted-foreground">{labels[index]}</span>
					<b className="tabular-nums">{formatWhen(step.date, { day: "numeric", month: "short" })}</b>
				</li>
			))}
		</ol>
	);
}

function RegistrationCard({ event }: { event: ProfileEvent }) {
	const t = useExtracted();
	const formatWhen = useFormatWhen();
	const closes = formatWhen(event.dateRegistrationsClose, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	return (
		<SectionCard title={t("Registration")} subtitle={t("Closes {date}", { date: closes })} headingLevel={3}>
			<Timeline event={event} />
		</SectionCard>
	);
}

function RulesCard({ rules }: { rules: ClubRule[] }) {
	const t = useExtracted();
	if (rules.length === 0) {
		return null;
	}
	return (
		<SectionCard
			title={t("Rules")}
			subtitle={String(rules.length)}
			headingLevel={3}
			bodyClassName="p-2 @max-md:p-2"
		>
			<ul>
				{rules.map((rule) => (
					<li key={rule.id}>
						<details className="group rounded-md open:bg-muted/40">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md p-2.5 text-sm hover:bg-muted/60 focus-visible:outline-2">
								<span className="flex items-center gap-2">
									<FileText className="size-4 text-muted-foreground" aria-hidden={true} />
									{rule.name}
								</span>
								<ChevronRight
									className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
									aria-hidden={true}
								/>
							</summary>
							<p className="whitespace-pre-wrap px-3 pb-3 text-sm text-muted-foreground">
								{rule.content}
							</p>
						</details>
					</li>
				))}
			</ul>
		</SectionCard>
	);
}

function HostCard({ club, details }: { club: ProfileClub; details: EventProfileProps["club"] }) {
	const t = useExtracted();
	const meta = [
		details.city,
		details.memberCount === null ? null : t("{count} members", { count: String(details.memberCount) }),
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<SectionCard title={t("Hosted by")} headingLevel={3} bodyClassName="p-0 @max-md:p-0">
			<Link
				href={`/clubs/${club.slug || club.id}`}
				className="flex items-center gap-3 rounded-b-lg p-4 hover:bg-muted/40 focus-visible:outline-2"
			>
				<ClubAvatar name={club.name} logo={club.logo} tile={details.logoTile} size={44} />
				<span className="flex min-w-0 grow flex-col gap-0.5">
					<span className="flex items-center gap-1.5 font-semibold">
						<span className="truncate">{club.name}</span>
						{club.verified ? <VerifiedBadge label={t("Verified club")} /> : null}
					</span>
					{meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
				</span>
				<ChevronRight className="size-4 text-muted-foreground" aria-hidden={true} />
			</Link>
		</SectionCard>
	);
}

function MapCard({ event }: { event: ProfileEvent }) {
	const t = useExtracted();
	const snapshot = normalizeMapData(event.mapData);
	if (!snapshotHasData(snapshot)) {
		return null;
	}
	return (
		<SectionCard
			title={t("Tactical map")}
			subtitle={t("Play area, bases and objectives")}
			bodyClassName="p-0 @max-md:p-0"
		>
			<MapViewer data={snapshot} height={440} className="rounded-b-lg" />
		</SectionCard>
	);
}

function IncludedCard({ event }: { event: ProfileEvent }) {
	const t = useExtracted();
	const items = [
		{ on: event.hasBreakfast, icon: Coffee, label: t("Breakfast") },
		{ on: event.hasLunch, icon: Utensils, label: t("Lunch") },
		{ on: event.hasDinner, icon: Utensils, label: t("Dinner") },
		{ on: event.hasSnacks, icon: Utensils, label: t("Snacks") },
		{ on: event.hasDrinks, icon: CupSoda, label: t("Drinks") },
		{ on: event.hasPrizes, icon: Trophy, label: t("Awards") },
	].filter((item) => item.on);
	if (items.length === 0) {
		return null;
	}
	return (
		<SectionCard title={t("Included")}>
			<ul className="flex flex-wrap gap-2">
				{items.map(({ icon: Icon, label }) => (
					<li
						key={label}
						className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium"
					>
						<Icon className="size-3.5" aria-hidden={true} />
						{label}
					</li>
				))}
			</ul>
		</SectionCard>
	);
}

export function EventProfile(props: EventProfileProps) {
	const t = useExtracted();
	const { event, club, eventRegistrationEnabled, reviews } = props;
	return (
		<div className="flex flex-col gap-6">
			<div>
				<Hero event={event} />
				<RegistrationBar {...props} />
			</div>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
				<div className="flex min-w-0 flex-col gap-6">
					{event.description ? (
						<SectionCard title={t("Description")}>
							<ExpandableDescription description={event.description} />
						</SectionCard>
					) : null}
					<MapCard event={event} />
					<IncludedCard event={event} />
				</div>
				<aside className="flex min-w-0 flex-col gap-4">
					{eventRegistrationEnabled ? <RegistrationCard event={event} /> : null}
					<RulesCard rules={event.rules} />
					<HostCard club={event.club} details={club} />
					{eventRegistrationEnabled ? <AddEventToCalendarButton event={event} /> : null}
				</aside>
			</div>
			<ReviewsOverview type="event" typeId={event.id} entityName={event.name} reviews={reviews} />
		</div>
	);
}
