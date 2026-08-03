import { format } from "date-fns";
import { Globe, MapPin } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { ProfileBanner } from "@/components/identity/profile-banner";
import { ExpandableDescription } from "@/components/overviews/expandable-description";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type UserResponse = ApiResponse<"/api/users/{id}", "get">;
type UserProfileResponse = ApiResponse<"/api/users/{id}/profile", "get">;
type UserOverviewUser = UserResponse | UserProfileResponse;

interface UserOverviewProps {
	user: UserOverviewUser;
}

export async function UserOverview({ user }: UserOverviewProps) {
	const t = await getExtracted();

	const formatWebsiteDisplay = (url: string) => {
		try {
			const parsedUrl = new URL(url);
			let host = parsedUrl.hostname;
			if (host.startsWith("www.")) {
				host = host.slice(4);
			}
			const path = parsedUrl.pathname === "/" ? "" : parsedUrl.pathname;
			const display = `${host}${path}`;
			return display.length > 25 ? `${display.slice(0, 25)}...` : display;
		} catch {
			return url.length > 25 ? `${url.slice(0, 25)}...` : url;
		}
	};

	const futureEvents = user.eventRegistration.filter(
		(reg: UserOverviewUser["eventRegistration"][number]) =>
			reg.event?.dateStart && new Date(reg.event.dateStart) > new Date() && !reg.attended,
	);
	const pastEvents = user.eventRegistration.filter(
		(reg: UserOverviewUser["eventRegistration"][number]) =>
			reg.attended || (reg.event?.dateStart && new Date(reg.event?.dateStart) <= new Date()),
	);

	return (
		<div className="space-y-6">
			<ProfileBanner name={user.name} kind="person" image={user.headerImage} />

			<div className="px-4 sm:px-6">
				{/* Circle, overhanging the banner by half its height — the one shape that says "person". */}
				<div className="relative z-1 -mt-14 w-28 h-28 rounded-full bg-background p-[5px] shadow-lg">
					<Avatar className="h-full w-full">
						<AvatarImage src={user.image || undefined} alt={user.name} />
						<AvatarFallback name={user.name} />
					</Avatar>
				</div>

				<div className="flex flex-col gap-1 mt-4">
					<div className="flex items-center gap-2">
						<h1 className="text-3xl font-semibold">
							{user.name} {user.callsign && `(${user.callsign})`}
						</h1>
					</div>
					<ExpandableDescription description={user.bio || ""} />
				</div>
			</div>
			{/* New Additional User Information Card */}
			{/* <Card>
                <CardHeader>
                    <CardTitle>{t("Additional information")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        <li>{t("Email")}: {user.email}</li>
                        {user.location && (
                            <li>{t("Location")}: {user.location}</li>
                        )}
                        {user.phone && !user.isPrivatePhone && (
                            <li>{t("Phone")}: {user.phone}</li>
                        )}
                    </ul>
                </CardContent>
            </Card> */}
			<div className="flex flex-wrap gap-2">
				{user.clubMembership.length === 0 && (
					<Badge className="md:grow-0 grow flex items-center gap-1">{t("Freelancer")}</Badge>
				)}
				{user.website && (
					<Link href={user.website} target="_blank" rel="noopener noreferrer" className="md:grow-0 grow">
						<Badge className="flex items-center gap-1 hover:cursor-pointer">
							<Globe size={16} />
							{formatWebsiteDisplay(user.website)}
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
					<CardHeader className="border-b">
						<div className="flex flex-col gap-4">
							<CardTitle>{t("Clubs")}</CardTitle>
							<p className="text-sm text-muted-foreground">{t("Clubs this user is a member of")}</p>
						</div>
					</CardHeader>
					<CardContent className="pt-4">
						{user.clubMembership.length === 0 ? (
							<p className="text-muted-foreground">{t("Not a member of any club")}</p>
						) : (
							<ul className="space-y-4">
								{user.clubMembership.map((membership: UserOverviewUser["clubMembership"][number]) => {
									if (!membership.club) {
										return null;
									}
									const clubLogo = "logo" in membership.club ? membership.club.logo : null;
									return (
										<li key={membership.club.id} className="flex items-center gap-3">
											<ClubAvatar name={membership.club.name} logo={clubLogo} size={40} />
											<Link
												href={`/clubs/${membership.club.slug || membership.club.id}`}
												className="hover:underline"
											>
												{membership.club.name}
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="border-b">
						<div className="flex flex-col gap-4">
							<CardTitle>{t("Upcoming events")}</CardTitle>
							<p className="text-sm text-muted-foreground">{t("Events this user is registered for")}</p>
						</div>
					</CardHeader>
					<CardContent className="pt-4">
						{futureEvents.length === 0 ? (
							<p className="text-muted-foreground">{t("There are no upcoming matches")}</p>
						) : (
							<ul className="space-y-2">
								{futureEvents.map((reg: UserOverviewUser["eventRegistration"][number]) => {
									if (!reg.event) {
										return null;
									}
									return (
										<li key={reg.event.id}>
											<Link
												href={`/events/${reg.event.slug || reg.event.id}`}
												className="hover:underline"
											>
												{reg.event.name}
											</Link>
											<span className="text-muted-foreground ml-2">
												(
												{reg.event.dateStart
													? format(new Date(reg.event.dateStart), "dd.MM.yyyy")
													: "TBD"}
												)
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="border-b">
						<div className="flex flex-col gap-4">
							<CardTitle>{t("Previous events")}</CardTitle>
							<p className="text-sm text-muted-foreground">{t("Events this user has attended")}</p>
						</div>
					</CardHeader>
					<CardContent className="pt-4">
						{pastEvents.length === 0 ? (
							<p className="text-muted-foreground">{t("No previous events")}</p>
						) : (
							<ul className="space-y-2">
								{pastEvents.map((reg: UserOverviewUser["eventRegistration"][number]) => {
									if (!reg.event) {
										return null;
									}
									return (
										<li key={reg.event.id}>
											<Link
												href={`/events/${reg.event.slug || reg.event.id}`}
												className="hover:underline"
											>
												{reg.event.name}
											</Link>
											<span className="text-muted-foreground ml-2">
												(
												{reg.event.dateStart
													? format(new Date(reg.event.dateStart), "dd.MM.yyyy")
													: "TBD"}
												)
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</CardContent>
				</Card>
				<ReviewsOverview type="user" typeId={user.id} entityName={user.name} />
			</div>
		</div>
	);
}
