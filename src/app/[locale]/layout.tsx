import type { Metadata } from "next";
import "./globals.css";

import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { AxiomWebVitals } from "next-axiom";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { SportsOrganization, WebSite, WithContext } from "schema-dts";
import { Toaster } from "sonner";
import { FontBody } from "@/components/font-body";
import { ImpersonationAlert } from "@/components/impersonation-alert";
import JsonLdScript from "@/components/json-ld-script";
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

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
	const [user, t] = await Promise.all([isAuthenticated(), getTranslations()]);

	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	const font = user?.font ? (user.font as "sans" | "mono") : "sans";
	const theme = user?.theme ? (user.theme as "dark" | "light") : "dark";

	const websiteSchema = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Reconned",
		description: t("public.home.metadata.description"),
		url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
		logo: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-light.svg`,
		sameAs: ["https://github.com/omznc/reconned"],
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/search?q={search_term_string}`,
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
		description: t("public.home.metadata.description"),
		url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
		logo: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-light.svg`,
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
			<AxiomWebVitals />
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
		</html>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations();
	return {
		title: t("public.layout.metadata.title"),
		description: t("public.layout.metadata.description"),
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
		keywords: t("public.layout.metadata.keywords")
			.split(", ")
			.map((keyword: string) => keyword.trim()),
	};
}

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}
