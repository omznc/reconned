import { Calendar, ChevronRight, Globe, Mail, Phone, Share2, Users } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { ProfileBanner } from "@/components/identity/profile-banner";
import type { UserTab } from "@/components/profile/profile-config";
import { ProfileReviews } from "@/components/profile/profile-reviews";
import {
	AsideCard,
	type ContactItem,
	ContactList,
	ProfileShell,
	RatingValue,
} from "@/components/profile/profile-shared";
import { useOpenExternal, useShare } from "@/components/profile/use-profile-actions";
import { EntityRow } from "@/components/redesign/entity-row";
import { EventRow } from "@/components/redesign/event-row";
import { type IdentityAction, IdentityPanel } from "@/components/redesign/identity-panel";
import { type ProfileTab, ProfileTabs } from "@/components/redesign/profile-tabs";
import { SectionCard } from "@/components/redesign/section-card";
import { StatStrip } from "@/components/redesign/stat-strip";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { toIntlLocale } from "@/lib/intl-locale";

type User = ApiResponse<"/api/users/{id}/profile", "get">;
type Reviews = ApiResponse<"/api/reviews/{type}/{id}", "get">["reviews"];
type Registration = User["eventRegistration"][number];
type Membership = User["clubMembership"][number];

interface UserProfileProps {
	user: User;
	reviews: Reviews | undefined;
	tab: UserTab;
}

function tabHref(user: User, tab: UserTab) {
	const pathname = `/users/${user.slug || user.id}`;
	return tab === "overview" ? pathname : { pathname, query: { tab } };
}

function UserIdentity({ user }: { user: User }) {
	const t = useExtracted();
	const share = useShare(user.name);
	const openExternal = useOpenExternal(true);
	const website = user.website;
	const firstClub = user.clubMembership[0]?.club;
	const badges = [
		firstClub ? { label: firstClub.name, icon: Users } : { label: t("Freelancer") },
		{
			label: t("Member since {year}", { year: String(new Date(user.createdAt).getUTCFullYear()) }),
			icon: Calendar,
		},
	];
	const actions: IdentityAction[] = [
		website ? { label: t("Website"), icon: Globe, onClick: () => openExternal(website) } : null,
	].filter((action) => action !== null);

	return (
		<IdentityPanel
			kind="person"
			name={user.callsign || user.name}
			subtitle={user.callsign ? user.name : null}
			image={user.image}
			location={user.location}
			badges={badges}
			description={user.bio}
			primaryAction={{ label: t("Share profile"), onClick: share, icon: Share2 }}
			actions={actions}
		/>
	);
}

function ClubsCard({ memberships }: { memberships: Membership[] }) {
	const t = useExtracted();
	if (memberships.length === 0) {
		return null;
	}
	return (
		<AsideCard title={t("Clubs")} meta={memberships.length}>
			<ul className="flex flex-col gap-2 p-2">
				{memberships.map((membership) => (
					<li key={membership.id}>
						<ClubMembershipRow membership={membership} />
					</li>
				))}
			</ul>
		</AsideCard>
	);
}

function ClubsSection({ memberships }: { memberships: Membership[] }) {
	const t = useExtracted();
	return (
		<SectionCard title={t("Clubs")} subtitle={t("Clubs this user is a member of")}>
			{memberships.length === 0 ? (
				<p className="text-[13px] text-muted-foreground">{t("Not a member of any club")}</p>
			) : (
				<ul className="grid gap-2 @lg:grid-cols-2">
					{memberships.map((membership) => (
						<li key={membership.id}>
							<ClubMembershipRow membership={membership} />
						</li>
					))}
				</ul>
			)}
		</SectionCard>
	);
}

function ClubMembershipRow({ membership }: { membership: Membership }) {
	const t = useExtracted();
	const club = membership.club;
	const role = { CLUB_OWNER: t("Club owner"), MANAGER: t("Manager"), USER: t("Member") }[membership.role];
	const since = membership.startDate ? new Date(membership.startDate).getUTCFullYear() : null;
	return (
		<EntityRow
			kind="club"
			href={`/clubs/${club.slug || club.id}`}
			name={club.name}
			subtitle={since ? t("{role} · since {year}", { role, year: String(since) }) : role}
			image={club.logo}
		/>
	);
}

function ContactCard({ user }: { user: User }) {
	const t = useExtracted();
	const items: ContactItem[] = [
		user.website
			? {
					icon: Globe,
					label: user.website.replace(/^https?:\/\/(www\.)?/, ""),
					href: user.website,
					external: true,
				}
			: null,
		user.email && !user.isPrivateEmail
			? { icon: Mail, label: user.email, href: `mailto:${user.email}` }
			: { icon: Mail, label: t("Email is private"), muted: true },
		user.phone && !user.isPrivatePhone
			? { icon: Phone, label: user.phone, href: `tel:${user.phone}` }
			: { icon: Phone, label: t("Phone is private"), muted: true },
	].filter((item) => item !== null);
	return (
		<AsideCard title={t("Contact")}>
			<ContactList items={items} />
		</AsideCard>
	);
}

function isUpcoming(registration: Registration, now: number) {
	return !registration.attended && new Date(registration.event.dateStart).getTime() > now;
}

function UpcomingEvents({ registrations }: { registrations: Registration[] }) {
	const t = useExtracted();
	return (
		<SectionCard
			title={t("Upcoming events")}
			subtitle={t("Events this user is registered for")}
			bodyClassName="flex flex-col gap-2"
		>
			{registrations.length === 0 ? (
				<p className="text-[13px] text-muted-foreground">{t("There are no upcoming matches")}</p>
			) : (
				registrations.map((registration) => (
					<EventRow
						key={registration.id}
						href={`/events/${registration.event.slug || registration.event.id}`}
						name={registration.event.name}
						dateStart={registration.event.dateStart}
						state="open"
						stateLabel={t("Registered")}
						club={{ name: registration.event.club.name }}
						place={registration.event.location}
						price={registration.event.costPerPerson}
					/>
				))
			)}
		</SectionCard>
	);
}

function PastEventRow({ registration }: { registration: Registration }) {
	const locale = useLocale();
	const { event } = registration;
	const date = new Intl.DateTimeFormat(toIntlLocale(locale), {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(event.dateStart));
	return (
		<li>
			<Link
				href={`/events/${event.slug || event.id}`}
				className="flex items-center gap-3 rounded-md px-2 py-2.5 text-[13px] outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<span className="w-24 shrink-0 text-muted-foreground tabular-nums">{date}</span>
				<span className="min-w-0 flex-1 truncate font-medium">{event.name}</span>
				<span className="hidden truncate text-muted-foreground @md:inline">{event.club.name}</span>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden={true} />
			</Link>
		</li>
	);
}

function PreviousEvents({ registrations, gamesCount }: { registrations: Registration[]; gamesCount: number | null }) {
	const t = useExtracted();
	return (
		<SectionCard
			title={t("Previous events")}
			subtitle={
				gamesCount === null
					? t("Events this user has attended")
					: t("{count} games played", { count: String(gamesCount) })
			}
			bodyClassName="px-2 py-2 @max-md:px-2 @max-md:py-2"
		>
			{registrations.length === 0 ? (
				<p className="p-4 text-[13px] text-muted-foreground">{t("No previous events")}</p>
			) : (
				<ul className="@container">
					{registrations.map((registration) => (
						<PastEventRow key={registration.id} registration={registration} />
					))}
				</ul>
			)}
		</SectionCard>
	);
}

function UserTabsNav({ user, reviews, tab, showEvents }: UserProfileProps & { showEvents: boolean }) {
	const t = useExtracted();
	const tabs: ProfileTab[] = [
		{ key: "overview", label: t("Overview"), href: tabHref(user, "overview") },
		showEvents
			? { key: "events", label: t("Events"), href: tabHref(user, "events"), count: user.eventRegistration.length }
			: null,
		{ key: "clubs", label: t("Clubs"), href: tabHref(user, "clubs"), count: user.clubMembership.length },
		reviews ? { key: "reviews", label: t("Reviews"), href: tabHref(user, "reviews"), count: reviews.length } : null,
	].filter((item) => item !== null);
	return <ProfileTabs tabs={tabs} activeKey={tab} label={t("Player sections")} />;
}

function UserStats({ user }: { user: User }) {
	const t = useExtracted();
	const locale = useLocale();
	const memberSince = new Intl.DateTimeFormat(toIntlLocale(locale), { month: "short", year: "numeric" }).format(
		new Date(user.createdAt),
	);
	// A private profile sends null for the games and the rating: the cells leave the strip.
	return (
		<StatStrip
			items={[
				{ label: t("Games played"), value: user.gamesCount },
				{ label: t("Rating"), value: user.rating ? <RatingValue average={user.rating.average} /> : null },
				{ label: t("Member since"), value: memberSince },
				{ label: t("Clubs"), value: user.clubMembership.length },
			]}
		/>
	);
}

function TabContent({ user, reviews, tab }: UserProfileProps) {
	const now = Date.now();
	const upcoming = user.eventRegistration.filter((registration) => isUpcoming(registration, now));
	const past = user.eventRegistration.filter((registration) => !isUpcoming(registration, now));
	const reviewList = (limit?: number) => (
		<ProfileReviews
			type="user"
			typeId={user.id}
			entityName={user.name}
			reviews={reviews}
			limit={limit}
			allHref={tabHref(user, "reviews")}
		/>
	);
	const events = user.isPrivateStats ? null : (
		<>
			<UpcomingEvents registrations={upcoming} />
			<PreviousEvents registrations={past} gamesCount={user.gamesCount} />
		</>
	);
	switch (tab) {
		case "events":
			return events;
		case "clubs":
			return <ClubsSection memberships={user.clubMembership} />;
		case "reviews":
			return reviewList();
		default:
			return (
				<>
					{events}
					{reviewList(3)}
				</>
			);
	}
}

export function UserProfile({ user, reviews, tab }: UserProfileProps) {
	return (
		<ProfileShell
			aside={
				<>
					<UserIdentity user={user} />
					<ClubsCard memberships={user.clubMembership} />
					<ContactCard user={user} />
				</>
			}
		>
			<ProfileBanner name={user.name} kind="person" image={user.headerImage} />
			<UserTabsNav user={user} reviews={reviews} tab={tab} showEvents={!user.isPrivateStats} />
			<UserStats user={user} />
			<TabContent user={user} reviews={reviews} tab={tab} />
		</ProfileShell>
	);
}
