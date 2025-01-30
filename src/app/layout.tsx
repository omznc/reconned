import type { Metadata } from "next";
import "./globals.css";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { env } from "@/lib/env";
import { ThemeProvider } from "@/components/personalization/theme/theme-provider";
import { Toaster } from "sonner";
import { FontProvider } from "@/components/personalization/font/font-provider";

import { Geist_Mono, Geist } from "next/font/google";
import { FontBody } from "@/components/font-body";
import type { ReactNode } from "react";
import { isAuthenticated } from "@/lib/auth";
import { ImpersonationAlert } from "@/components/impersonation-alert";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { LanguageProvider } from "@/components/personalization/language/language-provider";

const geistSans = Geist({
	fallback: ["sans-serif"],
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	fallback: ["monospace"],
	subsets: ["latin"],
});

async function LayoutContent({ children }: { children: ReactNode }) {
	const [messages, user, locale] = await Promise.all([
		getMessages(),
		isAuthenticated(),
		getLocale(),
	]);

	const font = user?.font ? (user.font as "sans" | "mono") : "sans";
	const theme = user?.theme ? (user.theme as "dark" | "light") : "dark";

	const isBeta = env.NEXT_PUBLIC_BETTER_AUTH_URL?.includes("beta");

	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<meta name="darkreader-lock" />
				{/* Beta site should never be indexed */}
				{isBeta && <meta name="robots" content="noindex" />}
				<Script
					defer
					data-domain={env.PLAUSIBLE_SITE_ID}
					src={`${env.PLAUSIBLE_HOST}/js/script.outbound-links.tagged-events.js`}
				/>
			</head>
			<NextIntlClientProvider messages={messages}>
				<FontProvider initial={font}>
					<FontBody
						geistMonoVariable={geistMono.className}
						geistSansVariable={geistSans.className}
					>
						<ThemeProvider
							attribute="class"
							defaultTheme={theme}
							enableSystem={false}
							disableTransitionOnChange
						>
							{/* TODO: Do we even need this? */}
							<link
								rel="stylesheet"
								href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
							/>
							<Toaster
								richColors
								toastOptions={{
									className:
										"rounded-none bg-background text-foreground border-border text-md shadow-none",
								}}
							/>
							<NuqsAdapter>
								<TooltipProvider>
									<LanguageProvider initial={locale}>
										{user?.session?.impersonatedBy && <ImpersonationAlert />}
										<AlertDialogProvider>{children}</AlertDialogProvider>
									</LanguageProvider>
								</TooltipProvider>
							</NuqsAdapter>
						</ThemeProvider>
					</FontBody>
				</FontProvider>
			</NextIntlClientProvider>
		</html>
	);
}

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	return <LayoutContent>{children}</LayoutContent>;
}

export const metadata: Metadata = {
	title: "RECONNED - Airsoft klubovi, susreti, i igrači",
	description:
		"Prva univerzalna platforma za airsoft klubove, susrete, i igrače u Bosni i Hercegovini.",
	metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL
		? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL)
		: undefined,
	keywords: [
		"airsoft Bosna",
		"airsoft BiH",
		"airsoft oružje",
		"airsoft replike",
		"airsoft oprema",
		"airsoft klubovi BiH",
		"airsoft shop BiH",
		"airsoft trgovina",
		"airsoft puške",
		"airsoft pištolji",
		"airsoft metci",
		"airsoft kuglice",
		"airsoft maska",
		"airsoft odjeća",
		"airsoft uniforme",
		"airsoft BiH forum",
		"airsoft događaji BiH",
		"airsoft pravila",
		"airsoft taktike",
		"airsoft igrači BiH",
		"najbolji airsoft BiH",
		"kupovina airsoft BiH",
		"prodaja airsoft BiH",
		"airsoft timovi BiH",
		"airsoft lokacije BiH",
		"airsoft teren BiH",
	],
};
