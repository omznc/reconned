import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { env } from "@/lib/env";

export const metadata: Metadata = {
	metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
};

// is required, even if it's just passing children through.
export default function RootLayout({ children }: { children: ReactNode }) {
	return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
