import type { Metadata } from "next";
import "./globals.css";

import { Geist, Geist_Mono } from "next/font/google";
import { AxiomWebVitals } from "next-axiom";
import { hasLocale } from "next-intl";
import { getExtracted } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { SportsOrganization, WebSite, WithContext } from "schema-dts";
import { Toaster } from "sonner";
import { ErrorPage } from "@/components/error-page";
import { FeatureFlagsWrapper } from "@/components/feature-flags-wrapper";
import { FontBody } from "@/components/font-body";
import { ImpersonationAlert } from "@/components/impersonation-alert";
import JsonLdScript from "@/components/json-ld-script";
import { FontProvider } from "@/components/personalization/font/font-provider";
import { StyleProvider } from "@/components/personalization/style/style-provider";
import { ThemeProvider } from "@/components/personalization/theme/theme-provider";
import PosthogIdentify from "@/components/posthog-identify";
import { Providers } from "@/components/providers";
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

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
	const session = await isAuthenticated();
	const t = await getExtracted();

	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		return <ErrorPage title={t("Page not found")} />;
	}

	const font = (session?.font as "sans" | "mono" | null | undefined) || "mono";
	const style = (session?.style as "sharp" | "relaxed" | null | undefined) || "relaxed";
	const theme = (session?.theme as "dark" | "light" | null | undefined) || "dark";

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
		<html lang={locale} suppressHydrationWarning>
			<head>
				<meta name="darkreader-lock" />
				<JsonLdScript data={websiteSchema} />
				<JsonLdScript data={organizationSchema} />
			</head>
			<PosthogIdentify />
			<AxiomWebVitals />
			<FontProvider initial={font}>
				<StyleProvider initial={style}>
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
											{session?.session?.impersonatedBy && <ImpersonationAlert />}
											<AlertDialogProvider>{children}</AlertDialogProvider>
										</FeatureFlagsWrapper>
									</TooltipProvider>
								</Providers>
							</NuqsAdapter>
						</ThemeProvider>
					</FontBody>
				</StyleProvider>
			</FontProvider>
		</html>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	return {
		title: t("RECONNED - Airsoft clubs, events, and players"),
		description: t("The first universal platform for airsoft clubs, events, and players."),
		metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
		keywords: t(
			"airsoft Bosnia, airsoft BiH, airsoft weapons, airsoft replicas, airsoft equipment, airsoft clubs BiH, airsoft shop BiH, airsoft store, airsoft rifles, airsoft pistols, airsoft bullets, airsoft BBs, airsoft mask, airsoft clothing, airsoft uniforms, airsoft BiH forum, airsoft events BiH, airsoft rules, airsoft tactics, airsoft players BiH, best airsoft BiH, buying airsoft BiH, selling airsoft BiH, airsoft teams BiH, airsoft locations BiH, airsoft field BiH",
		)
			.split(", ")
			.map((keyword: string) => keyword.trim()),
	};
}

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}
