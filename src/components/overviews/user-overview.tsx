import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Club, User, Event, Review } from "@prisma/client";
import { format } from "date-fns";
import Image from "next/image";
import Link from "next/link";

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

export function UserOverview({ user }: UserOverviewProps) {
	const futureEvents = user.eventRegistration.filter(
		(reg) => reg.event.dateStart > new Date() && !reg.attended,
	);
	const pastEvents = user.eventRegistration.filter(
		(reg) => reg.attended || reg.event.dateStart <= new Date(),
	);
	return (
		<div className="space-y-6">
			<div className="flex gap-4">
				{/* TODO: Handle if unset */}
				{user.image && (
					<Image
						suppressHydrationWarning={true}
						src={`${user.image}?v=${user.updatedAt}`} // This will revalidate the browser cache
						alt={user.name}
						width={150}
						height={150}
						className="h-[150px] w-auto"
						draggable={false}
					/>
				)}
				<div className="flex select-none flex-col gap-1">
					<h1 className="text-2xl font-semibold">
						{user.name} {user.callsign && `(${user.callsign})`}
					</h1>
					<p className="text-accent-foreground/80">{user.bio}</p>
				</div>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Klubovi</CardTitle>
					</CardHeader>
					<CardContent>
						{user.clubMembership.length === 0 ? (
							<p className="text-muted-foreground">Nije član nijednog kluba</p>
						) : (
							<ul className="space-y-4">
								{user.clubMembership.map((membership) => (
									<li
										key={membership.club.id}
										className="flex items-center gap-3"
									>
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
										<Link
											href={`/clubs/${membership.club.id}`}
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
						<CardTitle>Predstojeći susreti</CardTitle>
					</CardHeader>
					<CardContent>
						{futureEvents.length === 0 ? (
							<p className="text-muted-foreground">Nema predstojećih susreta</p>
						) : (
							<ul className="space-y-2">
								{futureEvents.map((reg) => (
									<li key={reg.event.id}>
										<Link
											href={`/events/${reg.event.id}`}
											className="hover:underline"
										>
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
						<CardTitle>Prethodni susreti</CardTitle>
					</CardHeader>
					<CardContent>
						{pastEvents.length === 0 ? (
							<p className="text-muted-foreground">Nema prethodnih susreta</p>
						) : (
							<ul className="space-y-2">
								{pastEvents.map((reg) => (
									<li key={reg.event.id}>
										<Link
											href={`/events/${reg.event.id}`}
											className="hover:underline"
										>
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
