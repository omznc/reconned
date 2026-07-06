import posthog from "posthog-js";

const POSTHOG_PUBLIC_KEY =
	process.env.NODE_ENV === "development" ? "" : "phc_Til0zz9j32sG49ojKjcns9mPsrj03jR0yQCX38uOeb1";

posthog.init(POSTHOG_PUBLIC_KEY, {
	api_host: "/warmind",
	ui_host: "https://eu.posthog.com",
	defaults: "2025-05-24",
	capture_exceptions: true,
	// debug: process.env.NODE_ENV === "development",
	before_send: (event) => {
		// Drop opaque, stack-less "Script error." exceptions. These come from
		// cross-origin scripts (e.g. Cloudflare Turnstile) and carry no actionable
		// detail, so they only add noise to error tracking.
		if (event?.event === "$exception") {
			const values = event.properties?.$exception_list;
			const isOpaqueScriptError =
				Array.isArray(values) &&
				values.length > 0 &&
				values.every(
					(exception) => exception?.value === "Script error." || exception?.value === "Script error",
				);

			if (isOpaqueScriptError) {
				return null;
			}
		}

		return event;
	},
});
