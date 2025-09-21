import type { Metadata } from "next";
import "./globals.css";

import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import notFound from "@/app/not-found";
import { FontBody } from "@/components/font-body";
import { ImpersonationAlert } from "@/components/impersonation-alert";
import { FontProvider } from "@/components/personalization/font/font-provider";
import { ThemeProvider } from "@/components/personalization/theme/theme-provider";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing } from "@/i18n/routing";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";

const geistSans = Geist({
	fallback: ["sans-serif"],
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	fallback: ["monospace"],
	subsets: ["latin"],
});

type Props = {
	children: React.ReactNode;
	params: Promise<{locale: string}>;
  };
   
  export default async function LocaleLayout({children, params}: Props) {
	const [messages, user] = await Promise.all([getMessages(), isAuthenticated()]);

	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	const font = user?.font ? (user.font as "sans" | "mono") : "sans";
	const theme = user?.theme ? (user.theme as "dark" | "light") : "dark";

	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<meta name="darkreader-lock" />
				<Script
					defer
					data-domain={env.PLAUSIBLE_SITE_ID}
					src={`${env.PLAUSIBLE_HOST}/js/script.outbound-links.tagged-events.js`}
				/>
			</head>
			<NextIntlClientProvider messages={messages}>
				<FontProvider initial={font}>
					<FontBody geistMonoVariable={geistMono.className} geistSansVariable={geistSans.className}>
						<ThemeProvider
							attribute="class"
							defaultTheme={theme}
							enableSystem={false}
							disableTransitionOnChange
						>
							{/* TODO: Do we even need this? */}
							<link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
							<Toaster
								richColors
								toastOptions={{
									classNames: {
										toast: "rounded-none",
									},
								}}
							/>
							<NuqsAdapter>
								<TooltipProvider>
									{user?.session?.impersonatedBy && <ImpersonationAlert />}
									<AlertDialogProvider>{children}</AlertDialogProvider>
								</TooltipProvider>
							</NuqsAdapter>
						</ThemeProvider>
					</FontBody>
				</FontProvider>
			</NextIntlClientProvider>
		</html>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("public.layout.metadata");
	return {
		title: t("title"),
		description: t("description"),
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
		keywords: t("keywords")
			.split(", ")
			.map((keyword) => keyword.trim()),
	};
}

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}