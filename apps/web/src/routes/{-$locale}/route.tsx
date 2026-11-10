import { createFileRoute, type NotFoundRouteProps, notFound, Outlet } from "@tanstack/react-router";
import { getExtracted } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { IntlProvider } from "use-intl";
import { ConsentBanner } from "@/components/consent-banner";
import { FontBody } from "@/components/font-body";
import { NotFoundPage } from "@/components/not-found-page";
import { FontProvider } from "@/components/personalization/font/font-provider";
import { SessionPersonalization } from "@/components/personalization/session-personalization";
import { ThemeProvider } from "@/components/personalization/theme/theme-provider";
import PosthogIdentify from "@/components/posthog-identify";
import { Providers } from "@/components/providers";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebMCP } from "@/components/webmcp";
import { getMessages, isLocale, type Locale } from "@/i18n/messages";
import { DEFAULT_TIME_ZONE, routing } from "@/i18n/routing";
import { FeatureFlagsProvider } from "@/lib/feature-flags/client";
import { buildCatchAllHead, getNotFoundData, readNotFoundData } from "@/lib/not-found";
import { scriptSafeJson } from "@/lib/seo";
import { getFeatureFlagsFn, getSessionFn } from "@/lib/server-fns";
import { buildSiteSchemas } from "@/lib/site-schema";

export const Route = createFileRoute("/{-$locale}")({
	beforeLoad: async ({ params }) => {
		if (params.locale !== undefined && !isLocale(params.locale)) {
			// An unprefixed unknown URL (`/nonexistent`) lands here: the optional locale segment takes its first
			// segment. Render the 404 inside the full layout in the default locale, like `/en/nonexistent`.
			const locale = routing.defaultLocale;
			const [notFoundData, messages, flags] = await Promise.all([
				getNotFoundData(locale),
				getMessages(locale),
				getFeatureFlagsFn(),
			]);
			throw notFound({ data: { ...notFoundData, locale, messages, flags } });
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
	head: ({ loaderData, match }) => {
		const notFoundData = readNotFoundData(match.error);
		if (notFoundData) {
			return buildCatchAllHead(notFoundData);
		}
		return {
			meta: loaderData
				? [
						{ title: loaderData.title },
						{ name: "description", content: loaderData.description },
						{ name: "keywords", content: loaderData.keywords },
					]
				: [],
			scripts: (loaderData?.schemas ?? []).map((schema) => ({
				type: "application/ld+json",
				children: scriptSafeJson(JSON.stringify(schema)),
			})),
		};
	},
	component: LocaleLayout,
	notFoundComponent: InvalidLocaleNotFound,
	// Errors from this route's own load render without the intl provider, so the message cannot be translated.
	errorComponent: () => <p>Something went wrong</p>,
});

type LayoutData = {
	locale: Locale;
	messages: Record<string, string>;
	flags: Awaited<ReturnType<typeof getFeatureFlagsFn>>;
};

function isLayoutData(data: unknown): data is LayoutData {
	return typeof data === "object" && data !== null && "locale" in data && "messages" in data && "flags" in data;
}

function LocaleLayout() {
	const { messages, flags } = Route.useLoaderData();
	const { locale } = Route.useRouteContext();

	return (
		<LocaleProviders locale={locale} messages={messages} flags={flags}>
			<Outlet />
		</LocaleProviders>
	);
}

/** The `beforeLoad` of this route threw (unknown locale segment), so the loader never ran: the data travels on the error. */
function InvalidLocaleNotFound({ data }: NotFoundRouteProps) {
	if (!isLayoutData(data)) {
		return <NotFoundPage />;
	}
	return (
		<LocaleProviders locale={data.locale} messages={data.messages} flags={data.flags}>
			<NotFoundPage />
		</LocaleProviders>
	);
}

function LocaleProviders({ locale, messages, flags, children }: LayoutData & { children: ReactNode }) {
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
										<AlertDialogProvider>{children}</AlertDialogProvider>
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
