// global.d.ts

import type { formats } from "@/i18n/request";
import type ba from "./messages/bs.json";

declare module "next-intl" {
	interface AppConfig {
		Messages: typeof ba;
		Formats: typeof formats;
	}
}
