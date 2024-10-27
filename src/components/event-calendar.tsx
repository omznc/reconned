"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { Event } from "@prisma/client";
import { useParams } from "next/navigation";
import Link from "next/link";

interface EventCalendarProps {
	events: (Event & { club: { name: string } })[];
}

export function EventCalendar(props: EventCalendarProps) {
	const params = useParams<{ clubId: string }>();

	return (
		<>
			<FullCalendar
				plugins={[dayGridPlugin]}
				initialView="dayGridMonth"
				events={props.events.map((event) => ({
					title: event.name,
					start: event.dateStart,
					end:
						event.dateEnd ??
						new Date(event.dateStart.getTime() + 48 * 60 * 60 * 1000),

					extendedProps: {
						description:
							event.description.length > 50
								? `${event.description.slice(0, 50)}...`
								: event.description,
						clubName: event.club.name,
						url: `${params.clubId ? `/dashboard/${event.clubId}` : ""}/events/${event.id}`,
					},
				}))}
				locale={"bs"}
				height="auto"
				eventDisplay="block"
				eventContent={(eventInfo) => (
					<Link
						href={eventInfo.event.extendedProps.url}
						className="text-sm hover:brightness-125 transition-all whitespace-normal"
					>
						{eventInfo.event.title} - {eventInfo.event.extendedProps.clubName}
						<span className="block opacity-80">
							{eventInfo.event.extendedProps.description}
						</span>
					</Link>
				)}
				buttonText={{
					today: "Danas",
					month: "Mjesec",
					week: "Sedmica",
					day: "Dan",
					list: "Lista",
				}}
				weekends={true}
				dayHeaderClassNames="bg-black text-white"
			/>
		</>
	);
}
