import type { Locale } from "@/i18n/messages";
import type messages from "../messages/en.json";

declare module "use-intl" {
	interface AppConfig {
		Locale: Locale;
		Messages: typeof messages;
	}
}
