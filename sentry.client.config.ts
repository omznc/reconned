// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: "https://5c40f191f8fefa48c98bcb854e94e3b0@o4507024650403840.ingest.us.sentry.io/4508650279075840",

	// Setting this option to true will print useful information to the console while you're setting up Sentry.
	debug: false,
	integrations: [
		Sentry.feedbackIntegration({
			colorScheme: "system",
			enableScreenshot: false,
		}),
	],
});
