import type { Metadata } from "next";
import "./globals.css";

import { Archivo, Archivo_Narrow, Geist, Geist_Mono } from "next/font/google";
import { AxiomWebVitals } from "next-axiom";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getExtracted, getMessages, setRequestLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { SportsOrganization, WebSite, WithContext } from "schema-dts";
import { Toaster } from "sonner";
import { ErrorPage } from "@/components/error-page";
import { FeatureFlagsWrapper } from "@/components/feature-flags-wrapper";
import { FontBody } from "@/components/font-body";
import JsonLdScript from "@/components/json-ld-script";
import { FontProvider } from "@/components/personalization/font/font-provider";
import { SessionPersonalization } from "@/components/personalization/session-personalization";
import { ThemeProvider } from "@/components/personalization/theme/theme-provider";
import PosthogIdentify from "@/components/posthog-identify";
import { Providers } from "@/components/providers";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebMCP } from "@/components/webmcp";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const geistSans = Geist({
	fallback: ["sans-serif"],
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	fallback: ["monospace"],
	subsets: ["latin"],
});

// Identity marks only — club and person initials. Exposed as CSS variables on
// <html> rather than applied to <body>, so they survive the user's Sans/Mono
// body-font preference: an avatar's initials are part of the mark, not the copy.
// latin-ext carries the diacritics in Bosnian, Croatian and Serbian names.
const archivo = Archivo({
	fallback: ["sans-serif"],
	subsets: ["latin", "latin-ext"],
	weight: ["600"],
	variable: "--font-archivo",
	display: "swap",
});

const archivoNarrow = Archivo_Narrow({
	fallback: ["sans-serif"],
	subsets: ["latin", "latin-ext"],
	weight: ["700"],
	variable: "--font-archivo-narrow",
	display: "swap",
});

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		const tFallback = await getExtracted();
		return <ErrorPage title={tFallback("Page not found")} />;
	}

	// Required for static rendering. Without it every next-intl server API falls
	// back to reading the locale from a request header, which reads `headers()`
	// and opts the whole route out of static generation.
	setRequestLocale(locale);

	// NOTE: `await getExtracted()` must stay in this exact `const x = await ...`
	// form. The next-intl SWC extractor only rewrites that pattern into
	// `getTranslations`; wrapping the call in `Promise.all(...)` leaves a bare
	// `getExtracted` reference in the output and throws at render time.
	const t = await getExtracted();
	const messages = await getMessages();

	// Built-in defaults only. The signed-in user's stored preferences are applied
	// client-side by `<SessionPersonalization />` below — reading the session here
	// meant an HTTP round-trip to the backend on every render (including anonymous
	// traffic) and forced the whole route tree to render dynamically.
	const font = "mono" as const;
	const theme = "dark" as const;

	const websiteSchema = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Reconned",
		description: t("The first universal platform for airsoft clubs, events, and players."),
		url: env.NEXT_PUBLIC_WEB_URL,
		logo: `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-light.svg`,
		sameAs: ["https://github.com/omznc/reconned"],
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
		about: {
			"@type": "SportsOrganization",
			name: "Airsoft Community",
			sport: "Airsoft",
			description: "Platform connecting airsoft clubs and players",
		},
	} as WithContext<WebSite>;

	const organizationSchema: WithContext<SportsOrganization> = {
		"@context": "https://schema.org",
		"@type": "SportsOrganization",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/#organization`,
		name: "Reconned",
		sport: "Airsoft",
		description: t("The first universal platform for airsoft clubs, events, and players."),
		url: env.NEXT_PUBLIC_WEB_URL,
		logo: `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-light.svg`,
		foundingDate: "2024",
		address: {
			"@type": "PostalAddress",
			addressCountry: "BA",
		},
		sameAs: ["https://github.com/omznc/reconned"],
	};

	return (
		<html lang={locale} className={`${archivo.variable} ${archivoNarrow.variable}`} suppressHydrationWarning>
			<head>
				<meta name="darkreader-lock" />
				<JsonLdScript data={websiteSchema} />
				<JsonLdScript data={organizationSchema} />
			</head>
			<PosthogIdentify />
			<AxiomWebVitals />
			<WebMCP />
			<NextIntlClientProvider locale={locale} messages={messages}>
				<FontProvider initial={font}>
					<FontBody geistMonoVariable={geistMono.className} geistSansVariable={geistSans.className}>
						<ThemeProvider
							attribute="class"
							defaultTheme={theme}
							enableSystem={false}
							disableTransitionOnChange
						>
							<Toaster
								richColors
								toastOptions={{
									classNames: {
										toast: "rounded-none",
									},
								}}
							/>
							<NuqsAdapter>
								<Providers>
									<TooltipProvider>
										<FeatureFlagsWrapper>
											<SessionPersonalization />
											<AlertDialogProvider>{children}</AlertDialogProvider>
										</FeatureFlagsWrapper>
									</TooltipProvider>
								</Providers>
							</NuqsAdapter>
						</ThemeProvider>
					</FontBody>
				</FontProvider>
			</NextIntlClientProvider>
		</html>
	);
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
	const { locale } = await params;
	if (hasLocale(routing.locales, locale)) {
		setRequestLocale(locale);
	}

	const t = await getExtracted();
	return {
		title: t("RECONNED - Airsoft clubs, events, and players"),
		description: t("The first universal platform for airsoft clubs, events, and players."),
		metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
		keywords: t(
			"airsoft Bosnia, airsoft BiH, airsoft weapons, airsoft replicas, airsoft equipment, airsoft clubs BiH, airsoft shop BiH, airsoft store, airsoft rifles, airsoft pistols, airsoft bullets, airsoft BBs, airsoft mask, airsoft clothing, airsoft uniforms, airsoft BiH forum, airsoft events BiH, airsoft rules, airsoft tactics, airsoft players BiH, best airsoft BiH, buying airsoft BiH, selling airsoft BiH, airsoft teams BiH, airsoft locations BiH, airsoft field BiH",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
	};
}

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}
