import { isAfter, isBefore } from "date-fns";
import { Eye, EyeOff, MapPin, Pencil, UserIcon } from "lucide-react";
import Image from "next/image";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import AddEventToCalendarButton from "@/components/add-event-to-calendar-button";
import { BadgeSoon } from "@/components/badge-soon";
import { ClubCard } from "@/components/club-card";
import { LoadChildOnClick } from "@/components/load-child-on-click";
import { normalizeMapData, snapshotHasData } from "@/components/map-editor/map-data";
import { MapViewer } from "@/components/map-editor/map-viewer-wrapper";
import { ExpandableDescription } from "@/components/overviews/expandable-description";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { ClubRule, Event } from "@/lib/api/api-type-helpers";
import { isFeatureEnabled } from "@/lib/feature-flags";

interface EventOverviewProps {
	event: Event & {
		_count: {
			eventRegistration: number;
		};
		rules: ClubRule[];
		club?: {
			id: string;
			name: string;
			slug: string | null;
			logo: string | null;
			verified: boolean;
		};
	};
	clubId?: string;
	user?: import("better-auth").User | null;
}

export async function EventOverview({ event, clubId, user }: EventOverviewProps) {
	const t = await getExtracted();
	const membershipPromise =
		user && clubId
			? apiServer.GET("/api/clubs/{id}/membership", {
					params: {
						path: {
							id: clubId,
						},
					},
				})
			: Promise.resolve({ data: null, error: null });

	const membershipResult = await membershipPromise;

	const role = membershipResult.data?.membership?.role;

	const canEdit = !!clubId && !!user && (role === "MANAGER" || role === "CLUB_OWNER");
	const mapSnapshot = normalizeMapData(event.mapData);
	const hasMap = snapshotHasData(mapSnapshot);

	const canApplyToEvent = (event: Event) => {
		const now = new Date();
		return (
			isAfter(now, new Date(event.dateRegistrationsOpen)) && isBefore(now, new Date(event.dateRegistrationsClose))
		);
	};

	const eventRegistrationEnabled = await isFeatureEnabled("EVENT_REGISTRATION");

	return (
		<div className="relative flex flex-col gap-4">
			{/* Hero Banner Section */}
			{event.image ? (
				<div className="relative w-full aspect-[21/9] md:aspect-video rounded-lg overflow-hidden">
					<Image
						suppressHydrationWarning={true}
						src={event.image}
						alt={event.name}
						fill
						className="object-cover"
						draggable={false}
						priority={true}
						sizes="(max-width: 1200px) 100vw, 1200px"
					/>
					{/* Gradient overlay for text readability */}
					<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

					{/* Content overlaid on banner */}
					<div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
						<div className="flex flex-col gap-4">
							<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
								<h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg">
									{event.name}
								</h1>
								{clubId ? (
									canEdit && (
										<Button asChild={true} className="w-full md:w-auto md:shrink-0 shadow-lg">
											<Link
												className="flex items-center gap-1"
												href={`/dashboard/${clubId}/events/create?id=${event.id}`}
											>
												<Pencil className="size-4" />
												{t("Edit event")}
											</Link>
										</Button>
									)
								) : (
									<div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto md:shrink-0">
										{eventRegistrationEnabled && (
											<>
												{user && canApplyToEvent(event) ? (
													<Link
														href={`/events/${event.id}/apply`}
														className="w-full md:w-auto"
													>
														<Button
															variant="default"
															size="sm"
															className="w-full shadow-lg"
														>
															{t("Login")} <BadgeSoon className="ml-2" />
														</Button>
													</Link>
												) : user ? (
													<p className="text-sm text-white/80">{t("Applications closed")}</p>
												) : null}
												<AddEventToCalendarButton event={event} />
											</>
										)}
									</div>
								)}
							</div>
							<div className="flex flex-wrap gap-2">
								{event._count?.eventRegistration > 0 && (
									<Badge className="flex h-fit items-center gap-1 bg-white/90 text-black hover:bg-white">
										<UserIcon className="size-4" />
										{t("{count} registered", {
											count: String(event._count?.eventRegistration),
										})}
									</Badge>
								)}
								<Badge className="flex h-fit items-center gap-1 bg-white/90 text-black hover:bg-white">
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
									<Badge className="flex h-fit items-center gap-1 bg-white/90 text-black hover:bg-white">
										<MapPin className="size-4" />
										{event.location}
									</Badge>
								)}
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="rounded-md border p-6 md:p-8 bg-background">
					<div className="flex flex-col gap-4">
						<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
							<h1 className="text-4xl font-semibold">{event.name}</h1>
							{clubId ? (
								canEdit && (
									<Button asChild={true} className="w-full md:w-auto md:shrink-0">
										<Link
											className="flex items-center gap-1"
											href={`/dashboard/${clubId}/events/create?id=${event.id}`}
										>
											<Pencil className="size-4" />
											{t("Edit event")}
										</Link>
									</Button>
								)
							) : (
								<div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto md:shrink-0">
									{eventRegistrationEnabled && (
										<>
											{user && canApplyToEvent(event) ? (
												<Link href={`/events/${event.id}/apply`} className="w-full md:w-auto">
													<Button variant="outline" size="sm" className="w-full">
														{t("Login")} <BadgeSoon className="ml-2" />
													</Button>
												</Link>
											) : user ? (
												<p className="text-sm text-muted-foreground">
													{t("Applications closed")}
												</p>
											) : null}
											<AddEventToCalendarButton event={event} />
										</>
									)}
								</div>
							)}
						</div>
						<div className="flex flex-wrap gap-2">
							{event._count?.eventRegistration > 0 && (
								<Badge className="flex h-fit items-center gap-1">
									<UserIcon className="size-4" />
									{t("{count} registered", {
										count: String(event._count?.eventRegistration),
									})}
								</Badge>
							)}
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
						</div>
					</div>
				</div>
			)}

			{/* Description and other content */}
			<div className="space-y-4">
				<Card>
					<CardHeader className="border-b">
						<CardTitle>{t("Description")}</CardTitle>
					</CardHeader>
					<CardContent className="pt-4">
						<ExpandableDescription description={event.description || ""} />
					</CardContent>
				</Card>

				{event.club && (
					<Card>
						<CardHeader className="border-b">
							<div className="flex flex-col gap-4">
								<CardTitle>{t("Hosted by")}</CardTitle>
								<p className="text-sm text-muted-foreground">{t("The club hosting this event")}</p>
							</div>
						</CardHeader>
						<CardContent className="pt-4">
							<ClubCard club={event.club} showDescription />
						</CardContent>
					</Card>
				)}

				{event.googleMapsLink && (
					<Card>
						<CardHeader className="border-b">
							<div className="flex flex-col gap-4">
								<CardTitle>{t("Location")}</CardTitle>
								<p className="text-sm text-muted-foreground">{t("Event location details")}</p>
							</div>
						</CardHeader>
						<CardContent className="pt-4">
							<LoadChildOnClick title={t("Show location")}>
								<iframe
									src={event.googleMapsLink}
									loading="lazy"
									referrerPolicy="no-referrer-when-downgrade"
									className="w-full h-96 border rounded-md"
									title={t("Google Maps")}
								/>
							</LoadChildOnClick>
						</CardContent>
					</Card>
				)}

				{hasMap && (
					<Card>
						<CardHeader className="border-b">
							<div className="flex flex-col gap-4">
								<CardTitle>{t("Match Map")}</CardTitle>
								<p className="text-sm text-muted-foreground">{t("Interactive map for this event")}</p>
							</div>
						</CardHeader>
						<CardContent className="pt-4">
							<LoadChildOnClick title={t("Show match map")}>
								<MapViewer data={mapSnapshot} height={800} />
							</LoadChildOnClick>
						</CardContent>
					</Card>
				)}
			</div>

			<Suspense fallback={null}>
				<ReviewsOverview type="event" typeId={event.id} entityName={event.name} />
			</Suspense>
		</div>
	);
}
