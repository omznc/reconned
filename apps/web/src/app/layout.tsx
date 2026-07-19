import type { Metadata } from "next";
import type { ReactNode } from "react";
import { env } from "@/lib/env";

export const metadata: Metadata = {
	metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
};

/**
 * Root layout — deliberately does no i18n work.
 *
 * `NextIntlClientProvider` used to live here, fed by `getLocale()` + `getMessages()`.
 * This layout sits *above* the `[locale]` segment, so it has no locale param, which
 * meant next-intl had to resolve the locale from a request header — reading
 * `headers()` and opting every route in the app out of static rendering.
 *
 * The provider now lives in `app/[locale]/layout.tsx`, where the locale is known
 * from `params` and `setRequestLocale()` has already run.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
	return children;
}
