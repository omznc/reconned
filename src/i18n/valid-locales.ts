import { routing } from "./routing";

export const LANGUAGE_TRANSLATIONS = {
	bs: "Bosanski",
	en: "English",
	sr: "Српски",
} as Record<(typeof routing.locales)[number], string>;

export const VALID_LOCALES = routing.locales;
