import type { EventRowState } from "@/components/redesign/event-row";
import { toDate } from "@/components/redesign/format-event-date";

interface RegistrationWindow {
	dateRegistrationsOpen: string;
	dateRegistrationsClose: string;
	placesLeft: number | null;
}

/** The state of the registration at `now`. A full event inside the window still takes a waiting list. */
export function registrationState(event: RegistrationWindow, now: Date): EventRowState {
	if (now < toDate(event.dateRegistrationsOpen)) {
		return "pending";
	}
	if (now > toDate(event.dateRegistrationsClose)) {
		return "closed";
	}
	return event.placesLeft === 0 ? "full" : "open";
}

/** The three steps of the registration time line. A step is done when its date has passed. */
export function timelineSteps(
	event: { dateRegistrationsOpen: string; dateRegistrationsClose: string; dateStart: string },
	now: Date,
) {
	const dates = [event.dateRegistrationsOpen, event.dateRegistrationsClose, event.dateStart];
	return dates.map((date) => ({ date, done: now >= toDate(date) }));
}
