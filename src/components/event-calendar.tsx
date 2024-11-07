"use client";

import type { Event } from "@prisma/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
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
} from "date-fns";
import React from "react";
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

interface EventCalendarProps {
	events: (Event & { club: { name: string }; image?: string | null })[];
}

export function EventCalendar(props: EventCalendarProps) {
	const params = useParams<{ clubId: string }>();
	const [currentDate, setCurrentDate] = useState(new Date());

	const monthStart = startOfMonth(currentDate);
	const monthEnd = endOfMonth(currentDate);
	const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
	const calendarEnd = endOfMonth(monthEnd);
	const calendarDays = eachDayOfInterval({
		start: calendarStart,
		end: calendarEnd,
	});

	const weeks = React.useMemo(() => {
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
			? `/dashboard/club/${event.clubId}/events/${event.id}`
			: `/events/${event.id}`;
	};

	const getEventsForDay = (day: Date) => {
		return props.events.filter(
			(event) =>
				isSameDay(day, event.dateStart) ||
				(event.dateEnd && day >= event.dateStart && day <= event.dateEnd),
		);
	};

	const isEventStarting = (event: Event) => (date: Date) => {
		return isSameDay(event.dateStart, date);
	};

	const getEventDisplayProperties = (event: Event, week: Date[]) => {
		const firstDayInWeek = week.find((day) =>
			isWithinInterval(day, {
				start: event.dateStart,
				end: event.dateEnd ?? event.dateStart,
			}),
		);

		if (!firstDayInWeek) {
			return null;
		}

		const startDayIndex = week.findIndex((day) =>
			isSameDay(day, firstDayInWeek),
		);
		const endDayIndex = week.findIndex(
			(day) =>
				isSameDay(day, event.dateEnd ?? event.dateStart) ||
				isSameDay(day, week[week.length - 1]),
		);

		return {
			startIndex: startDayIndex,
			span: endDayIndex - startDayIndex + 1,
			isStart: isSameDay(firstDayInWeek, event.dateStart),
			isEnd: isSameDay(week[endDayIndex], event.dateEnd ?? event.dateStart),
		};
	};

	const getEventPositions = (events: Event[], week: Date[]) => {
		const positions = new Map<string, number>();
		const maxLayer = new Array(7).fill(0);
		const layerEvents = new Map<number, number>();
		const sortedEvents = [...events].sort(
			(a, b) => a.dateStart.getTime() - b.dateStart.getTime(),
		);

		for (const event of sortedEvents) {
			const display = getEventDisplayProperties(event, week);
			if (!display) {
				continue;
			}

			// Try each layer starting from 0 until we find a free slot
			let selectedLayer = 0;
			let layerFound = false;

			while (!layerFound) {
				layerFound = true;
				// Check if this layer is free for the entire event span
				for (
					let i = display.startIndex;
					i < display.startIndex + display.span;
					i++
				) {
					if (maxLayer[i] > selectedLayer) {
						layerFound = false;
						selectedLayer++;
						break;
					}
				}
			}

			// Found a free layer, now occupy it
			for (
				let i = display.startIndex;
				i < display.startIndex + display.span;
				i++
			) {
				maxLayer[i] = selectedLayer + 1;
			}

			// Track number of events in each layer
			layerEvents.set(selectedLayer, (layerEvents.get(selectedLayer) || 0) + 1);

			// If this layer has more than 1 event and this is the first event in the layer
			if (layerEvents.get(selectedLayer) === 1 && positions.size > 0) {
				positions.set(event.id, selectedLayer - 1);
			} else {
				positions.set(event.id, selectedLayer);
			}
		}

		return {
			positions,
			maxLayer: Math.max(...maxLayer),
		};
	};

	const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
	const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
	const handleToday = () => setCurrentDate(new Date());

	return (
		<div className="flex flex-col h-full w-full bg-background text-foreground">
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
								? "Već je danas"
								: "Idi na trenutni mjesec"
						}
					>
						Danas
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
					{["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"].map((day) => (
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
							<React.Fragment key={week.map((day) => day.toISOString()).join()}>
								{week.map((day) => (
									<div
										key={day.toISOString()}
										className={cn(
											"border-b border-r p-1",
											"flex flex-col",
											isSameMonth(day, currentDate)
												? ""
												: "text-muted-foreground",
										)}
										style={{ minHeight: `${weekHeight}rem` }}
									>
										<div className="font-medium mb-1">
											{format(day, "d", { locale: bs })}
										</div>
										<div className="flex-1 relative">
											{Array.from(new Set(getEventsForDay(day))).map(
												(event) => {
													const display = getEventDisplayProperties(
														event,
														week,
													);
													if (!(display && isEventStarting(event)(day))) {
														return null;
													}

													return (
														<HoverCard key={event.id} openDelay={0}>
															<HoverCardTrigger>
																<Link href={getEventUrl(event)}>
																	<Button
																		variant="ghost"
																		style={{
																			position: "absolute",
																			zIndex: 10,
																			left: 0,
																			width: `calc(${display.span * 100}% - ${display.span * 2}px)`,
																			top: `${
																				(eventPositions.get(event.id) ?? 1) * 30
																			}px`,
																		}}
																		className={cn(
																			"text-left px-2 py-1 text-xs font-medium text-background h-6",
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
																</Link>
															</HoverCardTrigger>
															<HoverCardContent
																align="center"
																side="left"
																className="w-80 bg-sidebar"
															>
																{event.coverImage && (
																	<Image
																		width={200}
																		height={200}
																		src={event.coverImage}
																		alt={event.name}
																		className="object-cover w-full h-auto mb-2"
																	/>
																)}
																<div className="space-y-3">
																	<div>
																		<h4 className="font-semibold">
																			{event.name}
																		</h4>
																		<p className="text-sm text-muted-foreground">
																			{event.club.name}
																		</p>
																	</div>

																	<div className="text-sm space-y-1">
																		<div className="grid grid-cols-[auto,1fr] gap-2">
																			<span className="font-medium">
																				Početak:
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
																						Kraj:
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
																						Lokacija:
																					</span>
																					<span>{event.location}</span>
																				</>
																			)}

																			{event?.costPerPerson && (
																				<>
																					<span className="font-medium">
																						Cijena:
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
																	<Link
																		href={`${getEventUrl(event)}?signup=true`}
																	>
																		<Button
																			variant="default"
																			className="w-full mt-2"
																		>
																			<Plus className="h-4 w-4 mr-2" />
																			Prijavi se
																		</Button>
																	</Link>
																</div>
															</HoverCardContent>
														</HoverCard>
													);
												},
											)}
										</div>
									</div>
								))}
							</React.Fragment>
						);
					})}
				</div>
			</div>
		</div>
	);
}
