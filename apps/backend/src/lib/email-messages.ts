import bsMessages from "../messages/bs.json";
import enMessages from "../messages/en.json";
import srMessages from "../messages/sr.json";
import type { SupportedLanguage } from "./i18n";

const messages = {
	en: enMessages,
	bs: bsMessages,
	sr: srMessages,
} as const;

export function getEmailMessages(language: SupportedLanguage = "bs") {
	return messages[language] || messages.bs;
}

export type EmailMessages = ReturnType<typeof getEmailMessages>;

/**
 * Interpolate variables into a message string
 * @param message - The message string with placeholders like {variableName}
 * @param variables - Object with variable names as keys and replacement values as values
 * @returns The interpolated message
 */
export function interpolateMessage(message: string, variables: Record<string, string | number> = {}): string {
	return message.replace(/\{(\w+)\}/g, (match, key) => {
		const value = variables[key];
		return value !== undefined ? String(value) : match;
	});
}
