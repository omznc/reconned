import type { Club, Event, User } from "@generated/client";
import { format } from "date-fns";
import { Globe, MapPin } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ExpandableDescription } from "@/components/overviews/expandable-description";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getPageViews } from "@/lib/analytics";
import { isAuthenticated } from "@/lib/auth";

interface ExtendedUser extends User {
	clubMembership: {
		club: Club;
	}[];
	eventRegistration: {
		event: Event;
		attended: boolean;
	}[];
}

interface UserOverviewProps {
	user: ExtendedUser;
}

export async function UserOverview({ user }: UserOverviewProps) {
	const t = await getTranslations();
	const [analyticsId, analyticsSlug] = await Promise.all([
		getPageViews(`/users/${user.id}`),
		getPageViews(`/users/${user.slug}`),
	]);
	const visitors = analyticsId.results.visitors.value + analyticsSlug.results.visitors.value;
	const futureEvents = user.eventRegistration.filter((reg) => reg.event.dateStart > new Date() && !reg.attended);
	const pastEvents = user.eventRegistration.filter((reg) => reg.attended || reg.event.dateStart <= new Date());

	// Get current user to check if they're viewing their own profile
	const currentUser = await isAuthenticated();
	const isCurrentUser = currentUser?.id === user.id;

	// Determine whether to show stats based on privacy setting and user permissions
	const shouldShowStats = !user.isPrivateStats || isCurrentUser;

	return (
		<div className="space-y-6">
			{/* Header Image and Profile Photo Container */}
			{user.headerImage ? (
				<div className="relative">
					{/* Header Image */}
					<div className="w-full h-48 md:h-64 overflow-hidden relative">
						<Image
							suppressHydrationWarning={true}
							src={user.headerImage}
							alt={`${user.name} header`}
							fill
							className="object-cover"
							draggable={false}
						/>
					</div>

					{/* Profile Photo positioned over header */}
					<div className="absolute bottom-0 left-4 transform translate-y-1/2">
						{user.image && (
							<Image
								suppressHydrationWarning={true}
								src={user.image}
								alt={user.name}
								width={150}
								height={150}
								className="h-24 w-24 md:h-32 md:w-32 border-4 border-background bg-background object-cover shadow-lg"
								draggable={false}
							/>
						)}
					</div>
				</div>
			) : (
				/* Profile Photo when no header */
				user.image && (
					<div className="flex justify-start mb-4">
						<Image
							suppressHydrationWarning={true}
							src={user.image}
							alt={user.name}
							width={150}
							height={150}
							className="h-32 w-32 object-cover"
							draggable={false}
						/>
					</div>
				)
			)}

			{/* Profile Info Section */}
			<div
				className={`flex flex-col gap-1 ${user.image && user.headerImage ? "md:ml-40 md:pl-4 pt-[40px] md:pt-0" : ""}`}
			>
				<div className="flex items-center gap-2">
					<h1 className="text-3xl font-semibold">
						{user.name} {user.callsign && `(${user.callsign})`}
					</h1>
				</div>
				<ExpandableDescription description={user.bio || ""} />
			</div>
			{/* New Additional User Information Card */}
			{/* <Card>
                <CardHeader>
                    <CardTitle>{t("components.userOverview.additionalInfo.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        <li>{t("components.userOverview.email")}: {user.email}</li>
                        {user.location && (
                            <li>{t("components.userOverview.location")}: {user.location}</li>
                        )}
                        {user.phone && !user.isPrivatePhone && (
                            <li>{t("components.userOverview.phone")}: {user.phone}</li>
                        )}
                    </ul>
                </CardContent>
            </Card> */}
			<div className="flex flex-wrap gap-2">
				{shouldShowStats && visitors > 0 && (
					<Badge className="md:grow-0 grow flex items-center gap-1">
						{t("components.userOverview.views", { count: visitors })}
					</Badge>
				)}
				{user.clubMembership.length === 0 && (
					<Badge className="md:grow-0 grow flex items-center gap-1">
						{t("components.userOverview.freelancer")}
					</Badge>
				)}
				{user.website && (
					<Link href={user.website} target="_blank" rel="noopener noreferrer" className="md:grow-0 grow">
						<Badge className="flex items-center gap-1 hover:cursor-pointer">
							<Globe size={16} />
							{user.website}
						</Badge>
					</Link>
				)}
				{user.location && (
					<Badge className="md:grow-0 grow flex items-center gap-1">
						<MapPin size={16} />
						{user.location}
					</Badge>
				)}
				{user.phone && !user.isPrivatePhone && (
					<Badge className="md:grow-0 grow flex items-center gap-1">{user.phone}</Badge>
				)}
				{user.email && !user.isPrivateEmail && (
					<Badge className="md:grow-0 grow flex items-center gap-1">{user.email}</Badge>
				)}
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>{t("components.userOverview.clubs.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						{user.clubMembership.length === 0 ? (
							<p className="text-muted-foreground">{t("components.userOverview.clubs.noClubs")}</p>
						) : (
							<ul className="space-y-4">
								{user.clubMembership.map((membership) => (
									<li key={membership.club.id} className="flex items-center gap-3">
										{membership.club.logo ? (
											<Image
												src={membership.club.logo}
												alt={membership.club.name}
												width={32}
												height={32}
												className="h-auto w-8"
											/>
										) : (
											<div className="h-8 w-8 bg-muted flex items-center justify-center">
												<span className="text-xs text-muted-foreground">
													{membership.club.name.charAt(0)}
												</span>
											</div>
										)}
										<Link
											href={`/clubs/${membership.club.slug ?? membership.club.id}`}
											className="hover:underline"
										>
											{membership.club.name}
										</Link>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t("components.userOverview.upcomingEvents.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						{futureEvents.length === 0 ? (
							<p className="text-muted-foreground">
								{t("components.userOverview.upcomingEvents.noEvents")}
							</p>
						) : (
							<ul className="space-y-2">
								{futureEvents.map((reg) => (
									<li key={reg.event.id}>
										<Link href={`/events/${reg.event.id}`} className="hover:underline">
											{reg.event.name}
										</Link>
										<span className="text-muted-foreground ml-2">
											({format(reg.event.dateStart, "dd.MM.yyyy")})
										</span>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t("components.userOverview.pastEvents.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						{pastEvents.length === 0 ? (
							<p className="text-muted-foreground">{t("components.userOverview.pastEvents.noEvents")}</p>
						) : (
							<ul className="space-y-2">
								{pastEvents.map((reg) => (
									<li key={reg.event.id}>
										<Link href={`/events/${reg.event.id}`} className="hover:underline">
											{reg.event.name}
										</Link>
										<span className="text-muted-foreground ml-2">
											({format(reg.event.dateStart, "dd.MM.yyyy")})
										</span>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>

			<ReviewsOverview type="user" typeId={user.id} />
		</div>
	);
}
