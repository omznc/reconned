// Static pages under `events/`. Any other segment there is an event id (`events/$id`).
const EVENT_PAGES = new Set(["calendar", "create", "rules"]);

/**
 * Returns the dashboard path of `toClubId` for the same page as `pathname` (without the locale).
 * An event id belongs to the old club, so an event page goes to the event list.
 */
export function switchClubPath(pathname: string, fromClubId: string | undefined, toClubId: string): string {
	const prefix = `/dashboard/${fromClubId}`;
	if (!(fromClubId && (pathname === prefix || pathname.startsWith(`${prefix}/`)))) {
		return `/dashboard/${toClubId}`;
	}
	const rest = pathname.slice(prefix.length);
	const eventSegment = rest.match(/^\/events\/([^/]+)/)?.[1];
	if (eventSegment && !EVENT_PAGES.has(eventSegment)) {
		return `/dashboard/${toClubId}/events`;
	}
	return `/dashboard/${toClubId}${rest}`;
}
