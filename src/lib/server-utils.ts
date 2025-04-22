import "server-only";

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
