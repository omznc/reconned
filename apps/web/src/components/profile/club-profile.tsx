import {
	Calendar,
	Cog,
	Globe,
	Handshake,
	Image as ImageIcon,
	Lock,
	Mail,
	MapIcon,
	Phone,
	Share2,
	ShieldCheck,
} from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import sanitizeHtml from "sanitize-html";
import { ClaimClubForm } from "@/components/claim-club-form";
import { ClubInviteAcceptance } from "@/components/club-invite-acceptance";
import { InstagramIcon } from "@/components/icons";
import { ProfileBanner } from "@/components/identity/profile-banner";
import { Image } from "@/components/image";
import { LeaveClubButton } from "@/components/leave-club-button";
import { ClubInstagram } from "@/components/overviews/club-instagram";
import { ClubPost } from "@/components/overviews/club-post";
import { type ClubTab, eventRowState } from "@/components/profile/profile-config";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import { toIntlLocale } from "@/lib/intl-locale";
import type { loadClubPage } from "@/lib/server/club-page";

type LoadedClub = Extract<Awaited<ReturnType<typeof loadClubPage>>, { kind: "ok" }>;
type Club = LoadedClub["club"];
type Extras = LoadedClub["extras"];
type ClubEvent = Extras["events"][number];

interface ClubProfileProps {
	club: Club;
	extras: Extras;
	user?: { id: string; name: string; email: string; callsign?: string | null } | null;
	tab: ClubTab;
}

function tabHref(club: Club, tab: ClubTab) {
	const pathname = `/clubs/${club.slug || club.id}`;
	return tab === "overview" ? pathname : { pathname, query: { tab } };
}

function clubEventHref(event: ClubEvent) {
	return `/events/${event.slug || event.id}`;
}

function ClubEventRow({ club, event }: { club: Club; event: ClubEvent }) {
	return (
		<EventRow
			href={clubEventHref(event)}
			name={event.name}
			dateStart={event.dateStart}
			dateEnd={event.dateEnd}
			state={eventRowState(event.registrationState, event.dateRegistrationsClose)}
			club={{ name: club.name, logo: club.logo, logoTile: club.logoTile, verified: club.verified }}
			place={event.location}
			placesLeft={event.placesLeft}
			maxAttendees={event.capacity ?? event.maxAttendees}
			price={event.price}
			currency={event.currency}
		/>
	);
}

function useClubActions(club: Club, isManager: boolean): IdentityAction[] {
	const t = useExtracted();
	const share = useShare(club.name);
	const openExternal = useOpenExternal(!club.verified);
	const website = club.website;
	return [
		club.instagramUsername
			? {
					label: t("Instagram"),
					icon: InstagramIcon,
					onClick: () => openExternal(`https://instagram.com/${club.instagramUsername}`),
				}
			: null,
		website ? { label: t("Website"), icon: Globe, onClick: () => openExternal(website) } : null,
		club.latitude && club.longitude
			? { label: t("Map"), icon: MapIcon, href: `/map?clubId=${club.slug || club.id}` }
			: null,
		{ label: t("Share"), icon: Share2, onClick: share },
		isManager ? { label: t("Edit club"), icon: Cog, href: `/dashboard/${club.id}/club/information` } : null,
	].filter((action) => action !== null);
}

function ClubIdentity({ club, extras }: Pick<ClubProfileProps, "club" | "extras">) {
	const t = useExtracted();
	const founded = club.dateFounded ? new Date(club.dateFounded).getUTCFullYear() : null;
	const badges = [
		club.isPrivate ? { label: t("Private club"), icon: Lock } : null,
		club.isAllied ? { label: t("Allied"), icon: ShieldCheck } : null,
		founded ? { label: t("Since {year}", { year: String(founded) }), icon: Calendar } : null,
	].filter((badge) => badge !== null);

	const actions = useClubActions(club, extras.isManager);

	return (
		<IdentityPanel
			kind="club"
			name={club.name}
			image={club.logo}
			logoTile={club.logoTile}
			verified={club.verified}
			verifiedLabel={t("Verified club")}
			location={club.location}
			badges={badges}
			description={club.description}
			primaryAction={
				club.contactEmail ? { label: t("Contact"), href: `mailto:${club.contactEmail}`, icon: Mail } : undefined
			}
			actions={actions}
		>
			{extras.isMember && extras.membership?.role !== "CLUB_OWNER" ? (
				<LeaveClubButton clubId={club.id} isClubOwner={false} variant="outline" size="sm" />
			) : null}
		</IdentityPanel>
	);
}

function MembersCard({ club, extras }: Pick<ClubProfileProps, "club" | "extras">) {
	const t = useExtracted();
	const total = extras.stats?.memberCount ?? club._count.members;
	const hidden = extras.stats?.privateMemberCount ?? extras.privateCount;
	const shown = extras.members.slice(0, 8);
	const rest = total - shown.length;
	if (total === 0) {
		return null;
	}
	return (
		<AsideCard
			title={t("Members")}
			meta={
				hidden > 0 ? t("{count} · {hidden} private", { count: String(total), hidden: String(hidden) }) : total
			}
		>
			<div className="flex flex-col gap-3 p-2">
				<ul className="flex -space-x-2">
					{shown.map((member) => (
						<li key={member.id}>
							<Avatar className="size-8 ring-2 ring-card">
								<AvatarImage src={member.user.image ?? ""} alt="" />
								<AvatarFallback name={member.user.name} />
							</Avatar>
							<span className="sr-only">{member.user.name}</span>
						</li>
					))}
					{rest > 0 ? (
						<li className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground ring-2 ring-card tabular-nums">
							+{rest}
						</li>
					) : null}
				</ul>
				<Link href={tabHref(club, "members")} className="text-xs text-muted-foreground hover:text-foreground">
					{t("See all members")}
				</Link>
			</div>
		</AsideCard>
	);
}

function ContactCard({ club }: { club: Club }) {
	const t = useExtracted();
	const items: ContactItem[] = [
		club.contactPhone ? { icon: Phone, label: club.contactPhone, href: `tel:${club.contactPhone}` } : null,
		club.contactEmail ? { icon: Mail, label: club.contactEmail, href: `mailto:${club.contactEmail}` } : null,
		club.instagramUsername
			? {
					icon: InstagramIcon,
					label: `@${club.instagramUsername}`,
					href: `https://instagram.com/${club.instagramUsername}`,
					external: true,
				}
			: null,
	].filter((item) => item !== null);
	if (items.length === 0) {
		return null;
	}
	return (
		<AsideCard title={t("Contact")}>
			<ContactList items={items} />
		</AsideCard>
	);
}

function ClubBanner({ club, extras }: Pick<ClubProfileProps, "club" | "extras">) {
	const t = useExtracted();
	const photos = extras.stats?.photoCount ?? 0;
	return (
		<ProfileBanner
			name={club.name}
			kind="club"
			image={club.headerImage}
			action={
				photos > 0 ? (
					<Link
						href={tabHref(club, "posts")}
						className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black/60 px-3 text-xs font-medium text-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<ImageIcon className="size-3.5" aria-hidden={true} />
						{t("{count} photos", { count: String(photos) })}
					</Link>
				) : undefined
			}
		/>
	);
}

function ClubTabsNav({ club, extras, tab }: ClubProfileProps) {
	const t = useExtracted();
	const tabs: ProfileTab[] = [
		{ key: "overview", label: t("Overview"), href: tabHref(club, "overview") },
		{ key: "events", label: t("Events"), href: tabHref(club, "events"), count: extras.eventsTotal },
		{
			key: "members",
			label: t("Members"),
			href: tabHref(club, "members"),
			count: extras.stats?.memberCount ?? club._count.members,
		},
		{ key: "posts", label: t("Posts"), href: tabHref(club, "posts"), count: extras.posts.length },
		{ key: "rules", label: t("Rules"), href: tabHref(club, "rules"), count: extras.rules.length },
		extras.reviews
			? { key: "reviews", label: t("Reviews"), href: tabHref(club, "reviews"), count: extras.reviews.length }
			: null,
	].filter((item) => item !== null);
	return <ProfileTabs tabs={tabs} activeKey={tab} label={t("Club sections")} />;
}

function formatCount(number: Intl.NumberFormat, value: number | null | undefined) {
	return value === null || value === undefined ? null : number.format(value);
}

function ClubStats({ club, extras }: Pick<ClubProfileProps, "club" | "extras">) {
	const t = useExtracted();
	const locale = useLocale();
	const stats = extras.stats;
	const number = new Intl.NumberFormat(toIntlLocale(locale));
	return (
		<StatStrip
			items={[
				{ label: t("Members"), value: number.format(stats?.memberCount ?? club._count.members) },
				{ label: t("Games hosted"), value: formatCount(number, stats?.gamesHosted) },
				{ label: t("Rating"), value: stats?.rating ? <RatingValue average={stats.rating.average} /> : null },
				{
					label: t("Players hosted"),
					value: formatCount(number, stats?.playersHosted),
				},
			]}
		/>
	);
}

function EventsSection({ club, extras, all }: Pick<ClubProfileProps, "club" | "extras"> & { all?: boolean }) {
	const t = useExtracted();
	const events = all ? extras.events : extras.upcomingEvents.slice(0, 3);
	return (
		<SectionCard
			title={all ? t("Events") : t("Upcoming events")}
			subtitle={t("Games this club organises")}
			action={all ? undefined : { href: tabHref(club, "events"), label: t("All events") }}
			bodyClassName="flex flex-col gap-2"
		>
			{events.length === 0 ? (
				<p className="text-[13px] text-muted-foreground">{t("There are no upcoming matches")}</p>
			) : (
				events.map((event) => <ClubEventRow key={event.id} club={club} event={event} />)
			)}
		</SectionCard>
	);
}

function PostTiles({ club, extras }: Pick<ClubProfileProps, "club" | "extras">) {
	const t = useExtracted();
	const locale = useLocale();
	const posts = extras.posts.slice(0, 3);
	if (posts.length === 0) {
		return null;
	}
	const date = new Intl.DateTimeFormat(toIntlLocale(locale), { day: "numeric", month: "short" });
	return (
		<SectionCard
			title={t("Latest posts")}
			subtitle={t("Announcements from the club")}
			action={{ href: tabHref(club, "posts"), label: t("All posts") }}
			bodyClassName="grid grid-cols-1 gap-3 @lg:grid-cols-3"
		>
			{posts.map((post) => {
				const cover = post.images?.find((src): src is string => Boolean(src));
				return (
					<Link key={post.id} href={tabHref(club, "posts")} className="flex flex-col gap-2">
						<div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
							{cover ? (
								<Image src={cover} alt="" fill={true} className="object-cover" sizes="300px" />
							) : null}
						</div>
						<span className="line-clamp-2 text-[13px] font-semibold">{post.title}</span>
						<span className="text-xs text-muted-foreground">{date.format(new Date(post.createdAt))}</span>
					</Link>
				);
			})}
		</SectionCard>
	);
}

function InstagramSection({ club, extras }: Pick<ClubProfileProps, "club" | "extras">) {
	const t = useExtracted();
	if (!club.instagramUsername || extras.instagram.media.length === 0) {
		return null;
	}
	return (
		<SectionCard title={t("Instagram photos")} subtitle={t("View our latest posts on Instagram")}>
			<ClubInstagram data={extras.instagram} limit={11} />
		</SectionCard>
	);
}

function AlliancesSection({ alliances }: { alliances: Extras["alliances"] }) {
	const t = useExtracted();
	if (alliances.length === 0) {
		return null;
	}
	return (
		<SectionCard title={t("Alliances")} subtitle={t("Club alliances and partnerships")}>
			<ul className="flex flex-col gap-2">
				{alliances.map((alliance) => (
					<li key={alliance.id} className="flex items-start gap-3 text-[13px]">
						<Handshake className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden={true} />
						<div className="min-w-0">
							{alliance.link ? (
								<Link
									href={alliance.link}
									target="_blank"
									rel="noopener noreferrer"
									className="font-semibold hover:underline"
								>
									{alliance.name}
								</Link>
							) : (
								<span className="font-semibold">{alliance.name}</span>
							)}
							{alliance.description ? (
								<p className="text-muted-foreground">{alliance.description}</p>
							) : null}
						</div>
					</li>
				))}
			</ul>
		</SectionCard>
	);
}

function MemberRow({ member }: { member: Extras["members"][number] }) {
	const t = useExtracted();
	const role = { CLUB_OWNER: t("Club owner"), MANAGER: t("Manager"), USER: null }[member.role];
	const subtitle = [role, member.user.callsign].filter(Boolean).join(" · ");
	return (
		<li>
			<EntityRow
				kind="player"
				href={`/users/${member.user.slug || member.user.id}`}
				name={member.user.name}
				subtitle={subtitle || null}
				image={member.user.image}
			/>
		</li>
	);
}

const ROLE_ORDER = { CLUB_OWNER: 0, MANAGER: 1, USER: 2 };

function MembersSection({ extras }: Pick<ClubProfileProps, "extras">) {
	const t = useExtracted();
	const members = [...extras.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
	return (
		<SectionCard title={t("Members")} subtitle={t("All members of this club")}>
			<ul className="grid gap-2 @lg:grid-cols-2">
				{members.map((member) => (
					<MemberRow key={member.id} member={member} />
				))}
			</ul>
			{extras.privateCount > 0 ? (
				<p className="mt-3 text-[13px] text-muted-foreground">
					{t("+{count} private members", { count: String(extras.privateCount) })}
				</p>
			) : null}
		</SectionCard>
	);
}

function PostsSection({ club, extras }: Pick<ClubProfileProps, "club" | "extras">) {
	const t = useExtracted();
	return (
		<>
			<SectionCard
				title={t("Announcements")}
				action={
					extras.isManager ? { href: `/dashboard/${club.id}/club/posts`, label: t("New post") } : undefined
				}
				bodyClassName="flex flex-col gap-4"
			>
				{extras.posts.length === 0 ? (
					<p className="text-[13px] text-muted-foreground">{t("There are no posts")}</p>
				) : (
					extras.posts.map((post) => (
						<ClubPost key={post.id} post={post} clubId={club.id} isManager={extras.isManager} />
					))
				)}
			</SectionCard>
			<InstagramSection club={club} extras={extras} />
		</>
	);
}

function RulesSection({ rules }: { rules: Extras["rules"] }) {
	const t = useExtracted();
	return (
		<SectionCard
			title={t("Rules")}
			subtitle={t("Rules from the public events of this club")}
			bodyClassName="flex flex-col gap-3"
		>
			{rules.length === 0 ? (
				<p className="text-[13px] text-muted-foreground">{t("This club has no public rules")}</p>
			) : (
				rules.map((rule) => (
					<details key={rule.id} className="group rounded-lg border bg-background px-4 py-3">
						<summary className="cursor-pointer text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
							{rule.name}
						</summary>
						<div className="mt-3 flex flex-col gap-2 text-[13px]">
							{rule.description ? <p className="text-muted-foreground">{rule.description}</p> : null}
							<div
								className="prose prose-sm max-w-none dark:prose-invert"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: The content is sanitized
								dangerouslySetInnerHTML={{ __html: sanitizeHtml(rule.content) }}
							/>
							<Link
								href={`/events/${rule.eventSlug || rule.eventId}`}
								className="w-fit text-xs text-muted-foreground hover:text-foreground"
							>
								{t("From the event {name}", { name: rule.eventName })}
							</Link>
						</div>
					</details>
				))
			)}
		</SectionCard>
	);
}

function TabContent({ club, extras, tab }: Omit<ClubProfileProps, "user">) {
	const reviews = (limit?: number) => (
		<ProfileReviews
			type="club"
			typeId={club.id}
			entityName={club.name}
			reviews={extras.reviews}
			isMember={extras.isMember}
			limit={limit}
			allHref={tabHref(club, "reviews")}
		/>
	);
	switch (tab) {
		case "events":
			return <EventsSection club={club} extras={extras} all={true} />;
		case "members":
			return <MembersSection extras={extras} />;
		case "posts":
			return <PostsSection club={club} extras={extras} />;
		case "rules":
			return <RulesSection rules={extras.rules} />;
		case "reviews":
			return reviews();
		default:
			return (
				<>
					<EventsSection club={club} extras={extras} />
					<PostTiles club={club} extras={extras} />
					<InstagramSection club={club} extras={extras} />
					<AlliancesSection alliances={extras.alliances} />
					{reviews(3)}
				</>
			);
	}
}

export function ClubProfile({ club, extras, user, tab }: ClubProfileProps) {
	const t = useExtracted();
	return (
		<ProfileShell
			aside={
				<>
					<ClubIdentity club={club} extras={extras} />
					<MembersCard club={club} extras={extras} />
					<ContactCard club={club} />
				</>
			}
		>
			<ClubInviteAcceptance invites={extras.invites} />
			{club.headerImage ? <ClubBanner club={club} extras={extras} /> : null}
			{extras.hasOwner ? (
				<>
					<ClubTabsNav club={club} extras={extras} tab={tab} />
					<ClubStats club={club} extras={extras} />
					<TabContent club={club} extras={extras} tab={tab} />
				</>
			) : (
				<SectionCard title={t("Claim this club")}>
					<ClaimClubForm clubId={club.id} clubName={club.name} user={user} />
				</SectionCard>
			)}
		</ProfileShell>
	);
}
