import AddEventToCalendarButton from "@/components/add-event-to-calendar-button";
import { LoadChildOnClick } from "@/components/load-child-on-click";
import { MapComponent } from "@/components/map-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { ClubRule, Event } from "@prisma/client";
import { Eye, EyeOff, MapPin, Pencil, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { isAfter, isBefore } from "date-fns";
import { BadgeSoon } from "@/components/badge-soon";
import { getPageViews } from "@/lib/analytics";

interface EventOverviewProps {
	event: Event & {
		_count: {
			eventRegistration: number;
		};
		rules: ClubRule[];
	};
	clubId?: string;
}

export async function EventOverview({ event, clubId }: EventOverviewProps) {
	const user = await isAuthenticated();
	const canEdit = user?.managedClubs.some((club) => club === clubId);
	const analytics = await getPageViews(`/events/${event.id}`);

	const canApplyToEvent = (event: Event) => {
		const now = new Date();
		return (
			isAfter(now, new Date(event.dateRegistrationsOpen)) &&
			isBefore(now, new Date(event.dateRegistrationsClose))
		);
	};

	return (
		<div className="relative flex flex-col items-center justify-center gap-4">
			{event.coverImage && (
				<>
					<Eye className="size-8 z-20 text-black bg-white border p-0.5 absolute top-4 right-4 peer" />

					<Image
						suppressHydrationWarning={true}
						src={`${event.coverImage}?v=${event.updatedAt}`} // This will revalidate the browser cache
						alt={event.name}
						width={680}
						height={380}
						className="absolute aspect-video top-0 object-cover transition-all w-full h-auto"
						draggable={false}
						priority={true}
					/>
				</>
			)}
			<div
				className={cn({
					"peer-hover:opacity-25 peer-hover:mt-[50%] z-10 mt-[150px] border transition-all h-4/5 min-h-fit p-4 bg-background w-full md:w-3/4 flex flex-col gap-1":
						event.coverImage,
					"border p-4 bg-background w-full flex flex-col gap-1":
						!event.coverImage,
				})}
			>
				<div className="relative flex select-none flex-col gap-3">
					{clubId ? (
						<>
							{canEdit && (
								<Button asChild={true}>
									<Link
										className="absolute top-0 md:right-0 transition-all flex items-center gap-1 h-fit w-full md:w-fit"
										href={`/dashboard/${clubId}/events/create?id=${event.id}`}
									>
										<Pencil className="size-4" />
										Izmjeni susret
									</Link>
								</Button>
							)}
						</>
					) : (
						<div className="absolute top-0 md:right-0 transition-all flex items-center gap-2 h-fit w-full md:w-fit">
							{user && canApplyToEvent(event) ? (
								<Link href={`/events/${event.id}/apply`}>
									<Button
										variant="outline"
										size="sm"
										className="w-full md:w-auto"
									>
										Prijava <BadgeSoon className="ml-2" />
									</Button>
								</Link>
							) : user ? (
								<p className="text-sm text-muted-foreground">
									Prijave zatvorene
								</p>
							) : null}
							<AddEventToCalendarButton event={event} />
						</div>
					)}
					<div className="flex items-center gap-2">
						<h1 className="text-4xl font-semibold w-[calc(100%-150px)] mt-12 md:mt-0 transition-all">
							{event.name}
						</h1>
					</div>
					<div className="flex flex-wrap gap-1 -mt-2">
						<Badge variant="outline" className="flex h-fit items-center gap-1">
							<UserIcon className="size-4" />
							{event._count?.eventRegistration} prijavljenih
						</Badge>
						<Badge variant="outline" className="flex h-fit items-center gap-1">
							{event.isPrivate ? (
								<>
									<EyeOff className="size-4" />
									Privatni susret
								</>
							) : (
								<>
									<Eye className="size-4" />
									Javni susret
								</>
							)}
						</Badge>
						{event.location && (
							<Badge
								variant="outline"
								className="flex h-fit items-center gap-1"
							>
								<MapPin className="size-4" />
								{event.location}
							</Badge>
						)}
						<Badge variant="outline" className="h-fit">
							{analytics.results.visitors.value} pregled/a
						</Badge>
					</div>
					<p className="text-accent-foreground/80">{event.description}</p>
					{event.googleMapsLink && (
						<div className="size-full flex flex-col gap-2">
							<h2 className="text-xl font-semibold">Lokacija</h2>
							<LoadChildOnClick title="Prikaži lokaciju">
								<iframe
									src={event.googleMapsLink}
									loading="lazy"
									referrerPolicy="no-referrer-when-downgrade"
									className="w-full h-96 border"
									title="Google Maps"
								/>
							</LoadChildOnClick>
						</div>
					)}
					{event.mapData &&
						JSON.stringify(event.mapData) !== `{"pois":[],"areas":[]}` && (
							<div className="size-full flex flex-col gap-2">
								<h2 className="text-xl font-semibold">Mapa</h2>
								<LoadChildOnClick title="Prikaži mapu susreta">
									<MapComponent
										// biome-ignore lint/suspicious/noExplicitAny: <explanation>
										defaultMapData={event.mapData as any}
										readOnly={true}
									/>
								</LoadChildOnClick>
							</div>
						)}
					<ReviewsOverview type="event" typeId={event.id} />
				</div>
			</div>
		</div>
	);
}
