import AddEventToCalendarButton from "@/components/add-event-to-calendar-button";
import { MapComponent } from "@/components/map-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Event } from "@prisma/client";
import { Eye, EyeOff, MapPin, Pencil, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface EventOverviewProps {
	event: Event & {
		_count: {
			invites: number;
			registrations: number;
		};
	};
	clubId?: string;
}

export function EventOverview({ event, clubId }: EventOverviewProps) {
	return (
		<div className="relative flex flex-col items-center justify-center gap-4 ">
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
					"peer-hover:opacity-25 peer-hover:mt-[50%] z-10 mt-[150px] border transition-all h-4/5 min-h-fit p-4 bg-background w-3/4 flex flex-col gap-1":
						event.coverImage,
					"border p-4 bg-background w-full flex flex-col gap-1":
						!event.coverImage,
				})}
			>
				<div className="relative flex select-none flex-col gap-3">
					{clubId ? (
						<Button asChild={true}>
							<Link
								className="absolute top-0 right-0 flex items-center gap-1 h-fit w-fit"
								href={`/dashboard/${clubId}/events/create?id=${event.id}`}
							>
								<Pencil className="size-4" />
								Izmjeni susret
							</Link>
						</Button>
					) : (
						<div className="absolute top-0 right-0 flex items-center gap-1 h-fit w-fit">
							<AddEventToCalendarButton event={event} />
						</div>
					)}
					<h1 className="text-4xl font-semibold w-full w-[calc(100%-150px)]">
						{event.name}
					</h1>

					<div className="flex flex-wrap gap-1 -mt-2">
						<Badge variant="outline" className="flex h-fit items-center gap-1">
							<User className="size-4" />
							{event._count?.invites + event._count?.registrations}
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
					</div>
					<p className="text-accent-foreground/80">{event.description}</p>
					{event.googleMapsLink && (
						<div className="size-full flex flex-col gap-2">
							<h2 className="text-xl font-semibold">Lokacija</h2>
							<iframe
								src={event.googleMapsLink}
								loading="lazy"
								referrerPolicy="no-referrer-when-downgrade"
								className="w-full h-96 border"
								title="Google Maps"
							/>
						</div>
					)}
					{event.mapData &&
						JSON.stringify(event.mapData) !== `{"pois":[],"areas":[]}` && (
							<div className="size-full flex flex-col gap-2">
								<h2 className="text-xl font-semibold">Mapa</h2>
								<MapComponent
									// biome-ignore lint/suspicious/noExplicitAny: <explanation>
									defaultMapData={event.mapData as any}
									readOnly={true}
								/>
							</div>
						)}
				</div>
			</div>
		</div>
	);
}
