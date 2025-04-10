import "server-only";
import { isBefore, isAfter, startOfDay } from "date-fns";

export function hasActiveClubMembership(props: {
	startDate: Date | null | undefined;
	endDate: Date | null | undefined;
}) {
	const today = startOfDay(new Date());

	// If there's no start date, membership is not active
	if (!props.startDate) {
		return false;
	}

	// Check if membership has started
	const hasStarted =
		(props.startDate && isBefore(props.startDate, today)) ||
		props.startDate.getTime() === today.getTime();

	// Check if membership hasn't ended
	const hasNotEnded = !props.endDate || isAfter(props.endDate, today);

	return hasStarted && hasNotEnded;
}

export const FEATURE_FLAGS = {
	/**
	 * Club spending feature. Allows uploading receipts and tracking club spending.
	 */
	CLUBS_SPENDING: true,
	/**
	 * Event, User, and Club reviews feature. Allows leaving reviews on events, users, and clubs.
	 */
	REVIEWS: false,
	/**
	 * Covers event registrations and attendance tracking.
	 */
	EVENT_REGISTRATION: false,
};
