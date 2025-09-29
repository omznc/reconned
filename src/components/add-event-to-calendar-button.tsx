"use client";

import type { ClubRule, Event } from "@generated/client";
import { AddToCalendarButton as CalendarButtonBase } from "add-to-calendar-button-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

export default function AddEventToCalendarButton({ event }: { event: Event & { rules: ClubRule[] } }) {
	const t = useTranslations();
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
		event.hasBreakfast && t("components.addToCalendar.features.breakfast"),
		event.hasLunch && t("components.addToCalendar.features.lunch"),
		event.hasDinner && t("components.addToCalendar.features.dinner"),
		event.hasSnacks && t("components.addToCalendar.features.snacks"),
		event.hasDrinks && t("components.addToCalendar.features.drinks"),
		event.hasPrizes && t("components.addToCalendar.features.prizes"),
	].filter(Boolean);

	if (features.length > 0) {
		description += `${t("components.addToCalendar.sections.other")}: ${features.join(", ")}\n\n`;
	}

	if (Array.isArray(event.rules) && event.rules.length > 0) {
		description += `${t("components.addToCalendar.sections.rules")}:\n`;
		for (const rule of event.rules) {
			if (rule?.name && rule?.description) {
				description += `- ${rule?.name}: ${rule?.description}\n`;
			}
		}
		description += "\n";
	}

	if (event.gearRequirements.length > 0) {
		description += `${t("components.addToCalendar.sections.gear")}:\n`;
		for (const gear of event.gearRequirements) {
			// @ts-expect-error
			description += `- ${gear.name}: ${gear.description}\n`;
		}
	}

	if (event.isPrivate) {
		description += `\n${t("components.addToCalendar.sections.private")}\n`;
	}

	if (event.allowFreelancers) {
		description += `\n${t("components.addToCalendar.sections.freelancers")}\n`;
	}
	return (
		<CalendarButtonBase
			name={event.name}
			description={description}
			startDate={startDate}
			timeZone="Europe/Sarajevo"
			location={event.location}
			options={["Apple", "Google", "Outlook.com"]}
			label={t("components.addToCalendar.addToCalendar")}
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
