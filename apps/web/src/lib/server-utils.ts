import "server-only";

export const FEATURE_FLAGS = {
	/**
	 * Club spending feature. Allows uploading receipts and tracking club spending.
	 */
	CLUBS_SPENDING: true,
	/**
	 * Event, User, and Club reviews feature. Allows leaving reviews on events, users, and clubs.
	 * When enabled, adds review schema to club/event/user pages for SEO.
	 */
	REVIEWS: false,
	/**
	 * FAQ Schema markup for SEO. Adds FAQ structured data to club and event pages.
	 * This provides rich results in Google search with frequently asked questions.
	 */
	FAQ_SCHEMA: false,
	/**
	 * Covers event registrations and attendance tracking.
	 */
	EVENT_REGISTRATION: false,
};
