"use client";

import { Button } from "@components/ui/button";
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	format,
	format as formatDateFns,
	isAfter,
	isBefore,
	isSameDay,
	isSameMonth,
	isWithinInterval,
	parse as parseDateFns,
	startOfMonth,
	startOfWeek,
	subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Square } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { useQueryState } from "nuqs";
import { Fragment, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeSoon } from "@/components/badge-soon";
import { VerifiedClubIcon } from "@/components/icons";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { authClient, useIsAuthenticated } from "@/lib/auth-client";
import { getDateFnsLocale } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

type Event = ApiResponse<"/api/events/calendar", "get">["events"][number];

type ManagedClub = Event["club"];

interface EventCalendarProps {
	events: Event[];
	managedClubs?: ManagedClub[];
}

type Months = "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec";

export function EventCalendar(props: EventCalendarProps) {
	const t = useExtracted();
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const locale = useLocale();
	const dateLocale = getDateFnsLocale(locale);

	// Parse string dates from API to Date objects
	const eventsWithParsedDates = useMemo(() => {
		return props.events.map((event) => ({
			...event,
			dateStart: new Date(event.dateStart),
			dateEnd: event.dateEnd ? new Date(event.dateEnd) : null,
			dateRegistrationsOpen: new Date(event.dateRegistrationsOpen),
			dateRegistrationsClose: new Date(event.dateRegistrationsClose),
		}));
	}, [props.events]);

	const monthNames = {
		jan: t("January"),
		feb: t("February"),
		mar: t("March"),
		apr: t("April"),
		may: t("May"),
		jun: t("June"),
		jul: t("July"),
		aug: t("August"),
		sep: t("September"),
		oct: t("October"),
		nov: t("November"),
		dec: t("December"),
	};
	const [currentDate, setCurrentDate] = useQueryState("month", {
		defaultValue: parseDateFns(formatDateFns(new Date(), "yyyy-MM"), "yyyy-MM", new Date()),
		shallow: false,
		clearOnDefault: true,
		parse: (value: string) => parseDateFns(value, "yyyy-MM", new Date()),
		serialize: (date: Date) => formatDateFns(date, "yyyy-MM"),
	});
	const [message, setMessage] = useQueryState("message");
	const session = useIsAuthenticated();
	const isDashboardCalendar = Boolean(params.clubId);
	const [clubSelectorOpen, setClubSelectorOpen] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const canCreateEvent = isDashboardCalendar || (props.managedClubs && props.managedClubs.length > 0);

	const filteredClubs: NonNullable<ManagedClub>[] = useMemo(() => {
		if (!props.managedClubs) {
			return [];
		}

		const clubs = props.managedClubs.filter((club) => club !== null);

		if (!searchQuery.trim()) {
			return clubs;
		}

		const query = searchQuery.toLowerCase();
		return clubs.filter((club) => club?.name?.toLowerCase().includes(query));
	}, [props.managedClubs, searchQuery]);

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
		return params.clubId ? `/dashboard/${event.clubId}/events/${event.id}` : `/events/${event.id}`;
	};

	const getEventsForDay = (day: Date) => {
		return eventsWithParsedDates.filter(
			(event) =>
				isSameDay(day, event.dateStart) || (event.dateEnd && day >= event.dateStart && day <= event.dateEnd),
		);
	};

	const getEventDisplayProperties = (event: (typeof eventsWithParsedDates)[number], day: Date, week: Date[]) => {
		const eventStart = event.dateStart;
		const eventEnd = event.dateEnd || event.dateStart;

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

	const getEventPositions = (events: typeof eventsWithParsedDates) => {
		const positions = new Map<string, number>();
		const layers = [] as Set<string>[];

		const sortedEvents = [...events].sort((a, b) => {
			const aDuration = (a.dateEnd ? a.dateEnd.getTime() : a.dateStart.getTime()) - a.dateStart.getTime();
			const bDuration = (b.dateEnd ? b.dateEnd.getTime() : b.dateStart.getTime()) - b.dateStart.getTime();
			return bDuration - aDuration || a.dateStart.getTime() - b.dateStart.getTime();
		});

		for (const event of sortedEvents) {
			const eventStart = event.dateStart;
			const eventEnd = event.dateEnd || event.dateStart;

			// Find the first layer where this event can fit
			let layerIndex = 0;
			while (true) {
				if (!layers[layerIndex]) {
					layers[layerIndex] = new Set();
				}

				let canFit = true;
				for (const existingEvent of layers[layerIndex] || []) {
					const existing = events.find((e) => e.id === existingEvent);
					if (!existing) {
						continue;
					}

					const existingStart = existing.dateStart;
					const existingEnd = existing.dateEnd || existing.dateStart;

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

	const handleDayClick = (day: Date) => {
		const formattedDate = formatDateFns(day, "yyyy-MM-dd");

		if (isDashboardCalendar && params.clubId) {
			router.push(`/dashboard/${params.clubId}/events/create?date=${formattedDate}`);
			return;
		}

		if (!props.managedClubs || props.managedClubs.length === 0) {
			return;
		}

		if (props.managedClubs.length === 1) {
			router.push(`/dashboard/${props.managedClubs[0]}/events/create?date=${formattedDate}`);
			return;
		}

		setSelectedDate(day);
		setClubSelectorOpen(true);
	};

	const handleDayKeyDown = (event: KeyboardEvent<HTMLDivElement>, day: Date) => {
		if (!isDashboardCalendar && !(props.managedClubs && props.managedClubs.length > 0)) {
			return;
		}

		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handleDayClick(day);
		}
	};

	const canApplyToEvent = (event: Event) => {
		const now = new Date();
		return (
			isAfter(now, new Date(event.dateRegistrationsOpen)) && isBefore(now, new Date(event.dateRegistrationsClose))
		);
	};

	const handleClubSelectorOpenChange = (open: boolean) => {
		setClubSelectorOpen(open);
		if (!open) {
			setSelectedDate(null);
			setSearchQuery("");
		}
	};

	const handleClubSelection = (clubId: string) => {
		if (!selectedDate) {
			return;
		}

		router.push(`/dashboard/${clubId}/events/create?date=${formatDateFns(selectedDate, "yyyy-MM-dd")}`);
		setClubSelectorOpen(false);
		setSelectedDate(null);
		setSearchQuery("");
	};

	return (
		<div className="flex flex-col h-full w-full text-foreground">
			<header className="flex py-4 items-center justify-between">
				<h2 className="text-2xl font-bold">
					{monthNames[format(currentDate, "MMM", { locale: dateLocale }).toLowerCase() as Months]}{" "}
					{format(currentDate, "yyyy")}
				</h2>
				<div className="flex items-center gap-2">
					<Button
						variant={isSameMonth(new Date(), currentDate) ? "outline" : "default"}
						onClick={handleToday}
						disabled={isSameMonth(new Date(), currentDate)}
						title={isSameMonth(new Date(), currentDate) ? t("It's already today") : t("Go to today")}
					>
						{t("Today")}
					</Button>
					<div className="flex gap-2">
						<Button variant="outline" onClick={handlePreviousMonth}>
							<ChevronLeft className="h-4 w-4" aria-label={t("Previous month")} />
						</Button>
						<Button variant="outline" onClick={handleNextMonth}>
							<ChevronRight className="h-4 w-4" aria-label={t("Next month")} />
						</Button>
					</div>
				</div>
			</header>

			<div className="flex-1 overflow-auto border-t rounded-t-md">
				<div className="grid grid-cols-7 ">
					{/* Day headers */}
					{[t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat"), t("Sun")].map((day, index) => (
						<div
							key={day}
							className={cn(
								"h-12 border-b bg-sidebar flex justify-center items-center border-r px-2 py-1 font-medium",
								index === 0 && "border-l rounded-tl-md",
								index === 6 && "rounded-tr-md",
							)}
						>
							{day}
						</div>
					))}

					{weeks.map((week, weekIndex) => {
						const weekEvents = eventsWithParsedDates.filter((event) => {
							for (const day of week) {
								const eventsForDay = getEventsForDay(day);
								for (const dayEvent of eventsForDay) {
									if (dayEvent.id === event.id) {
										return true;
									}
								}
							}
							return false;
						});

						const { positions: eventPositions, maxLayer } = getEventPositions(weekEvents);
						const weekHeight = Math.max(8, (maxLayer + 1) * 2); // 8rem minimum, 2rem per layer
						const isLastWeek = weekIndex === weeks.length - 1;

						return (
							<Fragment key={week.map((day) => day.toISOString()).join()}>
								{week.map((day, dayIndex) => {
									const isFirstDay = dayIndex === 0;
									const isLastDay = dayIndex === week.length - 1;
									const interactiveProps = canCreateEvent
										? {
												role: "button" as const,
												tabIndex: 0,
												onClick: () => handleDayClick(day),
												onKeyDown: (event: KeyboardEvent<HTMLDivElement>) =>
													handleDayKeyDown(event, day),
												"aria-label": t("Create event on {date}", {
													date: format(day, "d. MMMM yyyy", { locale: dateLocale }),
												}),
											}
										: {};

									return (
										<div
											key={day.toISOString()}
											className={cn(
												"border-r border-b p-1",
												isFirstDay && "border-l",
												"flex flex-col",
												isSameMonth(day, currentDate) ? "" : "text-muted-foreground",
												getEventsForDay(day).length > 0 ? "bg-sidebar" : "",
												isSameDay(day, new Date()) ? "bg-accent" : "",
												canCreateEvent && "cursor-pointer hover:bg-sidebar transition-colors",
												isLastWeek && isFirstDay && "rounded-bl-md",
												isLastWeek && isLastDay && "rounded-br-md",
											)}
											style={{
												minHeight: `${weekHeight}rem`,
											}}
											{...interactiveProps}
										>
											<div
												className={cn(
													"font-medium mb-1",
													isSameDay(day, new Date()) ? "text-accent-foreground" : "",
												)}
											>
												{format(day, "d", { locale: dateLocale })}
											</div>
											<div className="flex-1 relative">
												{Array.from(new Set(getEventsForDay(day))).map((event) => {
													const display = getEventDisplayProperties(event, day, week);
													if (!display || !display.shouldRender) {
														return null;
													}

													return (
														<HoverCard key={event.id} openDelay={300}>
															<HoverCardTrigger>
																<Button
																	onClick={(clickEvent) => {
																		clickEvent.stopPropagation();
																		router.push(
																			getEventUrl({
																				...event,
																				dateStart:
																					event.dateStart.toISOString(),
																				dateEnd: event.dateEnd
																					? event.dateEnd.toISOString()
																					: "",
																				dateRegistrationsOpen:
																					event.dateRegistrationsOpen.toISOString(),
																				dateRegistrationsClose:
																					event.dateRegistrationsClose.toISOString(),
																			}),
																		);
																	}}
																	variant="ghost"
																	style={{
																		position: "absolute",
																		zIndex: eventPositions.get(event.id) || 1,
																		left: 0,
																		width: `calc(${display.span * 100}% - ${display.span * 2}px)`,
																		top: `${(eventPositions.get(event.id) || 0) * 32}px`,
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
																		locale: dateLocale,
																	})}
																	{event.dateEnd &&
																		` - ${format(event.dateEnd, "HH:mm", {
																			locale: dateLocale,
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
																		<h4 className="font-semibold">{event.name}</h4>
																		<p className="text-sm flex items-center gap-2 text-muted-foreground">
																			{event.club?.name || ""}{" "}
																			{event.club?.verified && (
																				<VerifiedClubIcon />
																			)}
																		</p>
																	</div>

																	<div className="text-sm space-y-1">
																		<div className="grid grid-cols-[auto_1fr] gap-2">
																			<span className="font-medium">
																				{t("Start")}:
																			</span>
																			<span>
																				{format(
																					event.dateStart,
																					"d. MMMM yyyy. HH:mm",
																					{
																						locale: dateLocale,
																					},
																				)}
																			</span>

																			{event.dateEnd && (
																				<>
																					<span className="font-medium">
																						{t("End")}:
																					</span>
																					<span>
																						{format(
																							event.dateEnd,
																							"d. MMMM yyyy. HH:mm",
																							{
																								locale: dateLocale,
																							},
																						)}
																					</span>
																				</>
																			)}

																			{event.location && (
																				<>
																					<span className="font-medium">
																						{t("Location")}:
																					</span>
																					<span>{event.location}</span>
																				</>
																			)}

																			{event?.costPerPerson && (
																				<>
																					<span className="font-medium">
																						{t("Price")}:
																					</span>
																					<span>
																						{event.costPerPerson} KM
																					</span>
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

																	{canApplyToEvent({
																		...event,
																		dateStart: event.dateStart.toISOString(),
																		dateEnd: event.dateEnd
																			? event.dateEnd.toISOString()
																			: "",
																		dateRegistrationsOpen:
																			event.dateRegistrationsOpen.toISOString(),
																		dateRegistrationsClose:
																			event.dateRegistrationsClose.toISOString(),
																	}) ? (
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
																			{t("Log in")}
																			<BadgeSoon className="ml-2" />
																		</Button>
																	) : (
																		<p className="text-sm text-muted-foreground text-center mt-2">
																			{t(
																				"Registrations for this event are currently not open",
																			)}
																		</p>
																	)}
																</div>
															</HoverCardContent>
														</HoverCard>
													);
												})}
											</div>
										</div>
									);
								})}
							</Fragment>
						);
					})}
				</div>
			</div>

			{props.managedClubs && props.managedClubs.length > 1 && (
				<Credenza open={clubSelectorOpen} onOpenChange={handleClubSelectorOpenChange}>
					<CredenzaContent className="md:max-w-md">
						<CredenzaHeader>
							<CredenzaTitle>{t("Select a club")}</CredenzaTitle>
							<CredenzaDescription>
								{t("Choose which club should create this event.")}
							</CredenzaDescription>
						</CredenzaHeader>
						<CredenzaBody className="space-y-4">
							<Input
								type="text"
								placeholder={t("Search clubs...")}
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full"
							/>
							<ScrollArea className={cn("w-full", props.managedClubs.length > 4 && "h-[300px]")}>
								<div className="flex flex-col gap-2">
									{filteredClubs.length === 0 ? (
										<div className="text-center text-sm text-muted-foreground py-8">
											{t("No clubs found")}
										</div>
									) : (
										filteredClubs.map((club) => (
											<Button
												key={club.id}
												variant="outline"
												onClick={() => handleClubSelection(club.id)}
												className="justify-start h-auto py-3 px-4"
											>
												<div className="flex items-center gap-3 w-full">
													<div className="flex aspect-square size-10 items-center justify-center rounded-lgshrink-0">
														{club.logo ? (
															<Image
																width={40}
																height={40}
																src={club.logo}
																alt={club.name || ""}
																className="rounded-lg object-cover"
															/>
														) : (
															<Square className="size-5 text-muted-foreground" />
														)}
													</div>
													<span className="text-left font-medium truncate flex-1">
														{club.name}
													</span>
												</div>
											</Button>
										))
									)}
								</div>
							</ScrollArea>
						</CredenzaBody>
					</CredenzaContent>
				</Credenza>
			)}
		</div>
	);
}
