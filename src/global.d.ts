// global.d.ts

import type { formats } from "@/i18n/request";
import type { ActionError as ActionErrorClass } from "@/lib/action-error";
import type messages from "./messages/en.json";

declare global {
	var ActionError: typeof ActionErrorClass;
}

declare module "next-intl" {
	interface AppConfig {
		Locale: (typeof routing.locales)[number];
		Messages: typeof messages;
		Formats: typeof formats;
	}
}
