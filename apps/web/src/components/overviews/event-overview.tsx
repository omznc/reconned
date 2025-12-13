import type { ClubRule, Event } from "@generated/client";
import { isAfter, isBefore } from "date-fns";
import { Eye, EyeOff, MapPin, Pencil, UserIcon } from "lucide-react";
import Image from "next/image";
import { getExtracted } from "next-intl/server";
import AddEventToCalendarButton from "@/components/add-event-to-calendar-button";
import { BadgeSoon } from "@/components/badge-soon";
import { LoadChildOnClick } from "@/components/load-child-on-click";
import { normalizeMapData, snapshotHasData } from "@/components/map-editor/map-data";
import { MapViewer } from "@/components/map-editor/map-viewer";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getPageViews } from "@/lib/analytics";
import { isAuthenticated } from "@/lib/auth";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { cn } from "@/lib/utils";

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
	const t = await getExtracted();
	const user = await isAuthenticated();
	const canEdit = user?.managedClubs.some((club) => club === clubId);
	const [analyticsId, analyticsSlug] = await Promise.all([
		getPageViews(`/events/${event.id}`),
		getPageViews(`/events/${event.slug}`),
	]);
	const visitors = analyticsId.results.visitors.value + analyticsSlug.results.visitors.value;
	const mapSnapshot = normalizeMapData(event.mapData);
	const hasMap = snapshotHasData(mapSnapshot);

	const canApplyToEvent = (event: Event) => {
		const now = new Date();
		return (
			isAfter(now, new Date(event.dateRegistrationsOpen)) && isBefore(now, new Date(event.dateRegistrationsClose))
		);
	};

	return (
		<div className="relative flex flex-col items-center justify-center gap-4">
			{event.image && (
				<>
					<Eye className="size-8 z-20 text-black bg-white border p-0.5 absolute top-4 right-4 peer" />

					<Image
						suppressHydrationWarning={true}
						src={event.image}
						alt={event.name}
						width={680}
						height={380}
						className="absolute aspect-video rounded-md top-0 object-cover transition-all w-full h-auto"
						draggable={false}
						priority={true}
					/>
				</>
			)}
			<div
				className={cn("rounded-md", {
					"peer-hover:opacity-25 peer-hover:mt-[50%] z-10 mt-[150px] border transition-all h-4/5 min-h-fit p-4 bg-background w-full md:w-3/4 flex flex-col gap-1":
						event.image,
					"border p-4 bg-background w-full flex flex-col gap-1": !event.image,
				})}
			>
				<div className="relative flex select-none flex-col gap-3">
					{clubId ? (
						canEdit && (
							<Button asChild={true}>
								<Link
									className="absolute top-0 md:right-0 transition-all flex items-center gap-1 h-fit w-full md:w-fit"
									href={`/dashboard/${clubId}/events/create?id=${event.id}`}
								>
									<Pencil className="size-4" />
									{t("Edit event")}
								</Link>
							</Button>
						)
					) : (
						<div className="absolute top-0 md:right-0 transition-all flex items-center gap-2 h-fit w-full md:w-fit">
							{FEATURE_FLAGS.EVENT_REGISTRATION && (
								<>
									{user && canApplyToEvent(event) ? (
										<Link href={`/events/${event.id}/apply`}>
											<Button variant="outline" size="sm" className="w-full md:w-auto">
												{t("Login")} <BadgeSoon className="ml-2" />
											</Button>
										</Link>
									) : user ? (
										<p className="text-sm text-muted-foreground">{t("Applications closed")}</p>
									) : null}
									<AddEventToCalendarButton event={event} />
								</>
							)}
						</div>
					)}
					<div className="flex items-center gap-2">
						<h1 className="text-4xl font-semibold w-[calc(100%-150px)] mt-12 md:mt-0 transition-all">
							{event.name}
						</h1>
					</div>
					<div className="flex flex-wrap -mt-2 gap-2">
						<Badge className="flex h-fit items-center gap-1">
							<UserIcon className="size-4" />
							{t("{count} registered", {
								count: String(event._count?.eventRegistration),
							})}
						</Badge>
						<Badge className="flex h-fit items-center gap-1">
							{event.isPrivate ? (
								<>
									<EyeOff className="size-4" />
									{t("Private event")}
								</>
							) : (
								<>
									<Eye className="size-4" />
									{t("Public event")}
								</>
							)}
						</Badge>
						{event.location && (
							<Badge className="flex h-fit items-center gap-1">
								<MapPin className="size-4" />
								{event.location}
							</Badge>
						)}
						<Badge className="h-fit">{t("{count} views", { count: String(visitors) })}</Badge>
					</div>
					<p className="text-accent-foreground/80">{event.description}</p>
					{event.googleMapsLink && (
						<div className="size-full flex flex-col gap-2">
							<h2 className="text-xl font-semibold">{t("Location")}</h2>
							<LoadChildOnClick title={t("Show location")}>
								<iframe
									src={event.googleMapsLink}
									loading="lazy"
									referrerPolicy="no-referrer-when-downgrade"
									className="w-full h-96 border rounded-md"
									title={t("Google Maps")}
								/>
							</LoadChildOnClick>
						</div>
					)}
					{hasMap ? (
						<div className="size-full flex flex-col gap-2">
							<h2 className="text-xl font-semibold">{t("Map")}</h2>
							<LoadChildOnClick title={t("Show match map")}>
								<MapViewer data={mapSnapshot} height={800} />
							</LoadChildOnClick>
						</div>
					) : null}
					<ReviewsOverview type="event" typeId={event.id} />
				</div>
			</div>
		</div>
	);
}
