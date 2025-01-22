"use client";

import { useQueryState } from "nuqs";
import type { Event } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";
import {
	startOfMonth,
	endOfMonth,
	startOfWeek,
	eachDayOfInterval,
	addMonths,
	isSameDay,
	subMonths,
	format,
	isSameMonth,
	isWithinInterval,
	isAfter,
	isBefore,
} from "date-fns";
import { Fragment, useEffect, useMemo } from "react";
import Image from "next/image";
import {
	HoverCard,
	HoverCardTrigger,
	HoverCardContent,
} from "@/components/ui/hover-card";
import { Button } from "@components/ui/button";
import { bs } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parse as parseDateFns, format as formatDateFns } from "date-fns";
import { authClient, useIsAuthenticated } from "@/lib/auth-client";
import { toast } from "sonner";
import { BadgeSoon } from "@/components/badge-soon";
import { useTranslations } from "next-intl";
import { VerifiedClubIcon } from "@/components/icons";

interface EventCalendarProps {
	events: (Event & { club: { name: string, verified: boolean; }; image?: string | null; })[];
}

export function EventCalendar(props: EventCalendarProps) {
	const t = useTranslations("components.calendar");
	const params = useParams<{ clubId: string; }>();
	const router = useRouter();
	const [currentDate, setCurrentDate] = useQueryState("month", {
		defaultValue: parseDateFns(
			formatDateFns(new Date(), "yyyy-MM"),
			"yyyy-MM",
			new Date(),
		),
		shallow: false,
		clearOnDefault: true,
		parse: (value: string) => parseDateFns(value, "yyyy-MM", new Date()),
		serialize: (date: Date) => formatDateFns(date, "yyyy-MM"),
	});
	const [message, setMessage] = useQueryState("message");
	const session = useIsAuthenticated();

	useEffect(() => {
		if (!(session.loading || session?.user)) {
			authClient.oneTap();
		}
	}, [session.loading]);

	useEffect(() => {
		if (message) {
			toast.info(decodeURIComponent(message));
			setMessage(null, { shallow: true });
		}
	}, [message, setMessage]);

	const monthStart = startOfMonth(currentDate);
	const monthEnd = endOfMonth(currentDate);
	const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
	const calendarEnd = endOfMonth(monthEnd);
	const calendarDays = eachDayOfInterval({
		start: calendarStart,
		end: calendarEnd,
	});

	const weeks = useMemo(() => {
		const weeks = [] as Date[][];
		let currentWeek = [] as Date[];

		for (const day of calendarDays) {
			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}
			currentWeek.push(day);
		}
		if (currentWeek.length > 0) {
			weeks.push(currentWeek);
		}
		return weeks;
	}, [calendarDays]);

	const getEventUrl = (event: Event) => {
		return params.clubId
			? `/dashboard/${event.clubId}/events/${event.id}`
			: `/events/${event.id}`;
	};

	const getEventsForDay = (day: Date) => {
		return props.events.filter(
			(event) =>
				isSameDay(day, event.dateStart) ||
				(event.dateEnd && day >= event.dateStart && day <= event.dateEnd),
		);
	};

	const getEventDisplayProperties = (event: Event, day: Date, week: Date[]) => {
		const eventStart = event.dateStart;
		const eventEnd = event.dateEnd ?? event.dateStart;

		// Get the first and last day of this event in the current week

		// biome-ignore lint/style/noNonNullAssertion: A week will always have at least one day
		const startInWeek = week[0]! > eventStart ? week[0] : eventStart;
		const endInWeek =
			// biome-ignore lint/style/noNonNullAssertion: Same as above
			week[week.length - 1]! < eventEnd ? week[week.length - 1] : eventEnd;

		// Find indices in the week array
		const startIndex = week.findIndex((d) => isSameDay(d, startInWeek as Date));
		const endIndex = week.findIndex((d) => isSameDay(d, endInWeek as Date));

		if (startInWeek === undefined || endInWeek === undefined) {
			return null;
		}

		// Calculate if this day is the day we should render the event on
		const shouldRender = isSameDay(day, startInWeek);

		return {
			startIndex,
			span: endIndex - startIndex + 1,
			isStart: isSameDay(eventStart, week[startIndex] as Date),
			isEnd: isSameDay(eventEnd, week[endIndex] as Date),
			shouldRender,
		};
	};

	const getEventPositions = (events: Event[], week: Date[]) => {
		const positions = new Map<string, number>();
		const layers = [] as Set<string>[];

		const sortedEvents = [...events].sort((a, b) => {
			const aDuration =
				(a.dateEnd?.getTime() ?? a.dateStart.getTime()) - a.dateStart.getTime();
			const bDuration =
				(b.dateEnd?.getTime() ?? b.dateStart.getTime()) - b.dateStart.getTime();
			return (
				bDuration - aDuration || a.dateStart.getTime() - b.dateStart.getTime()
			);
		});

		for (const event of sortedEvents) {
			const eventStart = event.dateStart;
			const eventEnd = event.dateEnd ?? event.dateStart;

			// Find the first layer where this event can fit
			let layerIndex = 0;
			while (true) {
				if (!layers[layerIndex]) {
					layers[layerIndex] = new Set();
				}

				let canFit = true;
				for (const existingEvent of layers[layerIndex] ?? []) {
					const existing = events.find((e) => e.id === existingEvent);
					if (!existing) {
						continue;
					}

					const existingStart = existing.dateStart;
					const existingEnd = existing.dateEnd ?? existing.dateStart;

					if (
						isWithinInterval(eventStart, {
							start: existingStart,
							end: existingEnd,
						}) ||
						isWithinInterval(eventEnd, {
							start: existingStart,
							end: existingEnd,
						}) ||
						isWithinInterval(existingStart, {
							start: eventStart,
							end: eventEnd,
						})
					) {
						canFit = false;
						break;
					}
				}

				if (canFit) {
					layers[layerIndex]?.add(event.id);
					positions.set(event.id, layerIndex);
					break;
				}

				layerIndex++;
			}
		}

		return {
			positions,
			maxLayer: layers.length,
		};
	};

	const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
	const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
	const handleToday = () => setCurrentDate(new Date());

	const canApplyToEvent = (event: Event) => {
		const now = new Date();
		return (
			isAfter(now, new Date(event.dateRegistrationsOpen)) &&
			isBefore(now, new Date(event.dateRegistrationsClose))
		);
	};

	return (
		<div className="flex flex-col h-full w-full text-foreground">
			<header className="flex py-4 items-center justify-between border-b">
				<h1 className="text-2xl font-bold">
					{format(currentDate, "LLLL yyyy", { locale: bs })}
				</h1>
				<div className="flex items-center gap-2">
					<Button
						variant={
							isSameMonth(new Date(), currentDate) ? "outline" : "default"
						}
						onClick={handleToday}
						disabled={isSameMonth(new Date(), currentDate)}
						title={
							isSameMonth(new Date(), currentDate)
								? t("alreadyToday")
								: t("goToToday")
						}
					>
						{t("today")}
					</Button>
					<div className="flex">
						<Button
							variant="outline"
							className="border-r-0"
							onClick={handlePreviousMonth}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button variant="outline" onClick={handleNextMonth}>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</header>

			<div className="flex-1 overflow-auto">
				<div className="grid grid-cols-7 border-l">
					{/* Day headers */}
					{[
						t("days.mon"),
						t("days.tue"),
						t("days.wed"),
						t("days.thu"),
						t("days.fri"),
						t("days.sat"),
						t("days.sun"),
					].map((day) => (
						<div
							key={day}
							className="h-12 border-b border-r px-2 py-1 font-medium"
						>
							{day}
						</div>
					))}

					{weeks.map((week) => {
						const weekEvents = props.events.filter((event) =>
							week.some((day) => getEventsForDay(day).includes(event)),
						);
						const { positions: eventPositions, maxLayer } = getEventPositions(
							weekEvents,
							week,
						);
						const weekHeight = Math.max(8, (maxLayer + 1) * 2); // 8rem minimum, 2rem per layer

						return (
							<Fragment key={week.map((day) => day.toISOString()).join()}>
								{week.map((day) => (
									<div
										key={day.toISOString()}
										className={cn(
											"border-b border-r p-1",
											"flex flex-col",
											isSameMonth(day, currentDate)
												? ""
												: "text-muted-foreground",
											getEventsForDay(day).length > 0 ? "bg-sidebar" : "",
											isSameDay(day, new Date()) ? "bg-accent" : "", // Add this line to highlight today
										)}
										style={{ minHeight: `${weekHeight}rem` }}
									>
										<div
											className={cn(
												"font-medium mb-1",
												isSameDay(day, new Date())
													? "text-accent-foreground"
													: "", // Add this line to style today's text
											)}
										>
											{format(day, "d", { locale: bs })}
										</div>
										<div className="flex-1 relative">
											{Array.from(new Set(getEventsForDay(day))).map(
												(event) => {
													const display = getEventDisplayProperties(
														event,
														day,
														week,
													);
													if (!display || !display.shouldRender) {
														return null;
													}

													return (
														<HoverCard key={event.id} openDelay={300}>
															<HoverCardTrigger>
																<Button
																	onClick={() => {
																		router.push(getEventUrl(event));
																	}}
																	variant="ghost"
																	style={{
																		position: "absolute",
																		zIndex: eventPositions.get(event.id) ?? 1,
																		left: 0,
																		width: `calc(${display.span * 100}% - ${display.span * 2}px)`,
																		top: `${(eventPositions.get(event.id) ?? 0) * 32}px`,
																		height: "28px",
																	}}
																	className={cn(
																		"text-left px-2 py-1 text-xs font-medium text-background",
																		"bg-primary hover:bg-primary/90 hover:text-background",
																		{
																			"rounded-l-none": !display.isStart,
																			"rounded-r-none": !display.isEnd,
																		},
																	)}
																>
																	{format(event.dateStart, "HH:mm", {
																		locale: bs,
																	})}
																	{event.dateEnd &&
																		` - ${format(event.dateEnd, "HH:mm", {
																			locale: bs,
																		})}`}{" "}
																	{event.name}
																</Button>
															</HoverCardTrigger>
															<HoverCardContent
																align="center"
																side="left"
																className="w-80 bg-sidebar"
															>
																{event.image && (
																	<Image
																		width={200}
																		height={200}
																		src={event.image}
																		alt={event.name}
																		className="object-cover w-full h-auto mb-2"
																	/>
																)}
																<div className="space-y-3">
																	<div>
																		<h4 className="font-semibold">
																			{event.name}
																		</h4>
																		<p className="text-sm flex items-center gap-2 text-muted-foreground">
																			{event.club.name} {event.club.verified && <VerifiedClubIcon />}
																		</p>
																	</div>

																	<div className="text-sm space-y-1">
																		<div className="grid grid-cols-[auto,1fr] gap-2">
																			<span className="font-medium">
																				{t("eventDetails.start")}:
																			</span>
																			<span>
																				{format(
																					event.dateStart,
																					"d. MMMM yyyy. HH:mm",
																					{ locale: bs },
																				)}
																			</span>

																			{event.dateEnd && (
																				<>
																					<span className="font-medium">
																						{t("eventDetails.end")}:
																					</span>
																					<span>
																						{format(
																							event.dateEnd,
																							"d. MMMM yyyy. HH:mm",
																							{ locale: bs },
																						)}
																					</span>
																				</>
																			)}

																			{event.location && (
																				<>
																					<span className="font-medium">
																						{t("eventDetails.location")}:
																					</span>
																					<span>{event.location}</span>
																				</>
																			)}

																			{event?.costPerPerson && (
																				<>
																					<span className="font-medium">
																						{t("eventDetails.cost")}:
																					</span>
																					<span>{event.costPerPerson} KM</span>
																				</>
																			)}
																		</div>
																	</div>

																	{event.description && (
																		<div className="text-sm border-t pt-2">
																			<p className="text-muted-foreground">
																				{event.description}
																			</p>
																		</div>
																	)}

																	{canApplyToEvent(event) ? (
																		<Button
																			variant="default"
																			className="w-full mt-2"
																			onClick={() => {
																				router.push(
																					`/events/${event.id}/apply`,
																				);
																			}}
																		>
																			<Plus className="h-4 w-4 mr-2" />
																			{t("eventDetails.apply")}{" "}
																			<BadgeSoon className="ml-2" />
																		</Button>
																	) : (
																		<p className="text-sm text-muted-foreground text-center mt-2">
																			{t("eventDetails.registrationsClosed")}
																		</p>
																	)}
																</div>
															</HoverCardContent>
														</HoverCard>
													);
												},
											)}
										</div>
									</div>
								))}
							</Fragment>
						);
					})}
				</div>
			</div>
		</div>
	);
}
