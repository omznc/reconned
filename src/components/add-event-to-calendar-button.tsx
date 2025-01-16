"use client";

import { AddToCalendarButton as CalendarButtonBase } from "add-to-calendar-button-react";
import { format } from "date-fns";
import type { ClubRule, Event } from "@prisma/client";

export default function AddEventToCalendarButton({
	event,
}: { event: Event & { rules: ClubRule[]; }; }) {
	const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

	const startDate = formatDate(event.dateStart);
	let description = `${event.description}\n\n`;

	if (event.googleMapsLink) {
		description += `Lokacija: ${event.googleMapsLink}\n\n`;
	}

	if (event.costPerPerson > 0) {
		description += `Kotizacija: $${event.costPerPerson.toFixed(2)}\n\n`;
	}

	const features = [
		event.hasBreakfast && "Doručak",
		event.hasLunch && "Ručak",
		event.hasDinner && "Večera",
		event.hasSnacks && "Užina",
		event.hasDrinks && "Piće",
		event.hasPrizes && "Nagrade",
	].filter(Boolean);

	if (features.length > 0) {
		description += `Ostalo: ${features.join(", ")}\n\n`;
	}

	if (Array.isArray(event.rules) && event.rules.length > 0) {
		description += "Pravila:\n";
		for (const rule of event.rules) {
			if (rule?.name && rule?.description) {
				description += `- ${rule?.name}: ${rule?.description}\n`;
			}
		}
		description += "\n";
	}

	if (event.gearRequirements.length > 0) {
		description += "Oprema:\n";
		for (const gear of event.gearRequirements) {
			// @ts-expect-error
			description += `- ${gear.name}: ${gear.description}\n`;
		}
	}

	if (event.isPrivate) {
		description += "\nOvo je privatni susret samo za članove kluba.\n";
	}

	if (event.allowFreelancers) {
		description +=
			"\nFreelanceri su dobrodošli da se registruju za ovaj susret.\n";
	}
	return (
		<CalendarButtonBase
			name={event.name}
			description={description}
			startDate={startDate}
			timeZone="Europe/Sarajevo"
			location={event.location}
			options={["Apple", "Google", "Outlook.com"]}
			label="Dodaj u kalendar"
			hideBackground={true}
			hideBranding={true}
			size="2"
			trigger="click"
			hideIconButton={true}
			listStyle="overlay"
			styleLight="--btn-background: black;--list-border-radius: 0; --list-shadow: none; --list-hover-background: white; --btn-text: white; --btn-border-radius: 0; --btn-shadow: none; --btn-hover-shadow: none; --btn-active-shadow: none;"
		/>
	);
}
