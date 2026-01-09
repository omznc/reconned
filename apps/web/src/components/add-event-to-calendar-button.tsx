"use client";

import { AddToCalendarButton as CalendarButtonBase } from "add-to-calendar-button-react";
import { format } from "date-fns";
import { useExtracted } from "next-intl";
import type { ClubRule, Event } from "@/lib/api/api-type-helpers";

export default function AddEventToCalendarButton({ event }: { event: Event & { rules: ClubRule[] } }) {
	const t = useExtracted();
	const formatDate = (date: string) => format(new Date(date), "yyyy-MM-dd");

	const startDate = formatDate(event.dateStart);
	let description = `${event.description}\n\n`;

	if (event.googleMapsLink) {
		description += `${t("Location:")} ${event.googleMapsLink}\n\n`;
	}

	if (event.costPerPerson > 0) {
		description += `${t("Cost: {amount}", { amount: `${event.costPerPerson.toFixed(2)}` })}\n\n`;
	}

	const features = [
		event.hasBreakfast && t("Breakfast"),
		event.hasLunch && t("Lunch"),
		event.hasDinner && t("Dinner"),
		event.hasSnacks && t("Snacks"),
		event.hasDrinks && t("Drinks"),
		event.hasPrizes && t("Awards"),
	].filter(Boolean);

	if (features.length > 0) {
		description += `${t("The rest")}: ${features.join(", ")}\n\n`;
	}

	if (Array.isArray(event.rules) && event.rules.length > 0) {
		description += `${t("Rules")}:\n`;
		for (const rule of event.rules) {
			if (rule?.name && rule?.description) {
				description += `- ${rule?.name}: ${rule?.description}\n`;
			}
		}
		description += "\n";
	}

	if (event.gearRequirements && event.gearRequirements.length > 0) {
		description += `${t("Equipment")}:\n`;
		for (const gear of event.gearRequirements) {
			// @ts-expect-error
			description += `- ${gear.name}: ${gear.description}\n`;
		}
	}

	if (event.isPrivate) {
		description += `\n${t("This is a private event for club members only.")}\n`;
	}

	if (event.allowFreelancers) {
		description += `\n${t("Freelancers are welcome to register for this meetup.")}\n`;
	}
	return (
		<CalendarButtonBase
			name={event.name}
			description={description}
			startDate={startDate}
			timeZone="Europe/Sarajevo"
			location={event.location}
			options={t("Options")}
			label={t("Add to calendar")}
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
