import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Club, User, Event } from "@prisma/client";
import { format } from "date-fns";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getPageViews } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";
import { Globe, MapPin } from "lucide-react";
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
	const t = await getTranslations("components.userOverview");
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
			<div className="flex flex-col md:flex-row gap-4">
				{/* TODO: Handle if unset */}
				{user.image && (
					<Image
						suppressHydrationWarning={true}
						src={user.image}
						alt={user.name}
						width={300}
						height={300}
						className="h-[400px] md:h-[200px] w-auto aspect-square object-cover"
						draggable={false}
					/>
				)}
				<div className="flex select-none flex-col gap-1">
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-semibold">
							{user.name} {user.callsign && `(${user.callsign})`}
						</h1>
					</div>
					<p className="text-accent-foreground/80 whitespace-pre-wrap line-clamp-6">{user.bio}</p>
				</div>
			</div>
			{/* New Additional User Information Card */}
			{/* <Card>
				<CardHeader>
					<CardTitle>{t("additionalInfo.title")}</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="space-y-2">
						<li>{t("email")}: {user.email}</li>
						{user.location && (
							<li>{t("location")}: {user.location}</li>
						)}
						{user.phone && !user.isPrivatePhone && (
							<li>{t("phone")}: {user.phone}</li>
						)}
					</ul>
				</CardContent>
			</Card> */}
			<div className="flex flex-wrap gap-2">
				{shouldShowStats && (
					<Badge className="md:grow-0 grow flex items-center gap-1">{t("views", { count: visitors })}</Badge>
				)}
				{user.clubMembership.length === 0 && (
					<Badge className="md:grow-0 grow flex items-center gap-1">{t("freelancer")}</Badge>
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
						<CardTitle>{t("clubs.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						{user.clubMembership.length === 0 ? (
							<p className="text-muted-foreground">{t("clubs.noClubs")}</p>
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
											<div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
												<span className="text-xs text-muted-foreground">
													{membership.club.name.charAt(0)}
												</span>
											</div>
										)}
										<Link href={`/clubs/${membership.club.id}`} className="hover:underline">
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
						<CardTitle>{t("upcomingEvents.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						{futureEvents.length === 0 ? (
							<p className="text-muted-foreground">{t("upcomingEvents.noEvents")}</p>
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
						<CardTitle>{t("pastEvents.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						{pastEvents.length === 0 ? (
							<p className="text-muted-foreground">{t("pastEvents.noEvents")}</p>
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
