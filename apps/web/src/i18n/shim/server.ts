import { createTranslator } from "use-intl/core";
import type { _useExtracted } from "use-intl/react";
import { getMessages as loadMessages, toLocale } from "@/i18n/messages";
import { getRequestLocale } from "@/i18n/request-locale";

type Options = { locale?: string };

async function resolveLocale(options?: Options) {
	return options?.locale ? toLocale(options.locale) : await getRequestLocale();
}

export async function getTranslations(options?: Options) {
	const locale = await resolveLocale(options);
	return createTranslator({ locale, messages: await loadMessages(locale) });
}

/** Type-only declaration; the Vite plugin rewrites `getExtracted()` to `getTranslations()`. */
export const getExtracted: (options?: Options) => Promise<ReturnType<typeof _useExtracted>> = () => {
	throw new Error("getExtracted() was not compiled. Check the next-intl extract plugin in vite.config.ts.");
};

export async function getLocale() {
	return await getRequestLocale();
}

export async function getMessages() {
	return await loadMessages(await getRequestLocale());
}

/** Kept so ported call sites compile; the locale comes from the request, never from a setter. */
export function setRequestLocale(_locale: string) {}
