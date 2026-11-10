import type { _useExtracted } from "use-intl/react";

export * from "use-intl";
export { IntlProvider as NextIntlClientProvider } from "use-intl";

/**
 * Type-only declaration. The Vite plugin in `vite/next-intl-extract.ts` rewrites every
 * `useExtracted()` call to `useTranslations()` with the hashed key before this runs.
 */
export const useExtracted: typeof _useExtracted = () => {
	throw new Error("useExtracted() was not compiled. Check the next-intl extract plugin in vite.config.ts.");
};
