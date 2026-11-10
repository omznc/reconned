import type { EventRowState } from "@/components/redesign/event-row";

export const CLUB_TABS = ["overview", "events", "members", "posts", "rules", "reviews"] as const;
export type ClubTab = (typeof CLUB_TABS)[number];

export const USER_TABS = ["overview", "events", "clubs", "reviews"] as const;
export type UserTab = (typeof USER_TABS)[number];

type RegistrationState = "open" | "notOpenYet" | "closed" | "full";

const CLOSING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

/** Maps the backend registration state to the state of an `EventRow`. */
export function eventRowState(state: RegistrationState, closesAt: string, now = Date.now()): EventRowState {
	if (state === "notOpenYet") {
		return "pending";
	}
	if (state === "open" && new Date(closesAt).getTime() - now <= CLOSING_SOON_MS) {
		return "closing";
	}
	return state;
}
