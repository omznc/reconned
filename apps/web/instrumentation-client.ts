import posthog from "posthog-js";

const POSTHOG_PUBLIC_KEY =
	process.env.NODE_ENV === "development" ? "" : "phc_Til0zz9j32sG49ojKjcns9mPsrj03jR0yQCX38uOeb1";

posthog.init(POSTHOG_PUBLIC_KEY, {
	api_host: "/warmind",
	ui_host: "https://eu.posthog.com",
	defaults: "2025-05-24",
	capture_exceptions: true,
	// debug: process.env.NODE_ENV === "development",
});
