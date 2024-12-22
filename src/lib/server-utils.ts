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
