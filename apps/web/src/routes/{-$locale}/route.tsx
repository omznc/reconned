import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { getExtracted } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { Toaster } from "sonner";
import { IntlProvider } from "use-intl";
import { ConsentBanner } from "@/components/consent-banner";
import { FontBody } from "@/components/font-body";
import { FontProvider } from "@/components/personalization/font/font-provider";
import { SessionPersonalization } from "@/components/personalization/session-personalization";
import { ThemeProvider } from "@/components/personalization/theme/theme-provider";
import PosthogIdentify from "@/components/posthog-identify";
import { Providers } from "@/components/providers";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebMCP } from "@/components/webmcp";
import { getMessages, isLocale } from "@/i18n/messages";
import { DEFAULT_TIME_ZONE, routing } from "@/i18n/routing";
import { FeatureFlagsProvider } from "@/lib/feature-flags/client";
import { getFeatureFlagsFn, getSessionFn } from "@/lib/server-fns";
import { buildSiteSchemas } from "@/lib/site-schema";

export const Route = createFileRoute("/{-$locale}")({
	beforeLoad: async ({ params }) => {
		if (params.locale !== undefined && !isLocale(params.locale)) {
			throw notFound();
		}
		// Every route below reads `context.user`; the session is fetched once here per navigation.
		const user = await getSessionFn();
		return { user, locale: params.locale ?? routing.defaultLocale };
	},
	loader: async ({ context }) => {
		const { locale } = context;
		const t = await getExtracted({ locale });
		const [messages, flags] = await Promise.all([getMessages(locale), getFeatureFlagsFn()]);
		const description = t("The first universal platform for airsoft clubs, events, and players.");
		return {
			messages,
			flags,
			title: t("RECONNED - Airsoft clubs, events, and players"),
			description,
			keywords: t(
				"airsoft Bosnia, airsoft BiH, airsoft weapons, airsoft replicas, airsoft equipment, airsoft clubs BiH, airsoft shop BiH, airsoft store, airsoft rifles, airsoft pistols, airsoft bullets, airsoft BBs, airsoft mask, airsoft clothing, airsoft uniforms, airsoft BiH forum, airsoft events BiH, airsoft rules, airsoft tactics, airsoft players BiH, best airsoft BiH, buying airsoft BiH, selling airsoft BiH, airsoft teams BiH, airsoft locations BiH, airsoft field BiH",
			)
				.split(",")
				.map((keyword: string) => keyword.trim())
				.join(", "),
			schemas: buildSiteSchemas({ locale, description }),
		};
	},
	head: ({ loaderData }) => ({
		meta: loaderData
			? [
					{ title: loaderData.title },
					{ name: "description", content: loaderData.description },
					{ name: "keywords", content: loaderData.keywords },
				]
			: [],
		scripts: (loaderData?.schemas ?? []).map((schema) => ({
			type: "application/ld+json",
			children: JSON.stringify(schema),
		})),
	}),
	component: LocaleLayout,
	// Errors from this route's own load render without the intl provider, so the message cannot be translated.
	errorComponent: () => <p>Something went wrong</p>,
});

function LocaleLayout() {
	const { messages, flags } = Route.useLoaderData();
	const { locale } = Route.useRouteContext();

	return (
		<IntlProvider locale={locale} messages={messages} timeZone={DEFAULT_TIME_ZONE}>
			<PosthogIdentify />
			<WebMCP />
			<FontProvider initial="mono">
				<FontBody>
					<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
						<Toaster richColors toastOptions={{ classNames: { toast: "rounded-none" } }} />
						<NuqsAdapter>
							<Providers>
								<TooltipProvider>
									<FeatureFlagsProvider initialFlags={flags}>
										<SessionPersonalization />
										<ConsentBanner />
										<AlertDialogProvider>
											<Outlet />
										</AlertDialogProvider>
									</FeatureFlagsProvider>
								</TooltipProvider>
							</Providers>
						</NuqsAdapter>
					</ThemeProvider>
				</FontBody>
			</FontProvider>
		</IntlProvider>
	);
}
