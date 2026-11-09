/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts, useLocation, useMatch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";
import { NotFoundPage } from "@/components/not-found-page";
import { getLocaleFromPathname } from "@/i18n/messages";
import { DEFAULT_TIME_ZONE } from "@/i18n/routing";
import appCss from "@/styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "darkreader-lock" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	shellComponent: RootDocument,
	component: Outlet,
	notFoundComponent: RootNotFound,
});

/**
 * Last-resort 404. A `notFoundComponent` replaces the whole route it sits on, so it renders outside the
 * `{-$locale}` layout's intl provider. This re-provides the messages when that layout got far enough to
 * load them. Routes that want the 404 inside their layout set `notFoundComponent: NotFoundPage` themselves.
 */
function RootNotFound() {
	const localeMatch = useMatch({ from: "/{-$locale}", shouldThrow: false });
	const { pathname } = useLocation();
	const messages = localeMatch?.loaderData?.messages;

	if (!messages) {
		// Untranslated on purpose: no messages exist here (an invalid first segment fails the layout's beforeLoad).
		// React 19 hoists <title> and <meta> into the document head.
		return (
			<>
				<title>You are lost</title>
				<meta name="description" content="The page you are looking for does not exist." />
				<p>Page not found</p>
			</>
		);
	}
	return (
		<IntlProvider locale={getLocaleFromPathname(pathname)} messages={messages} timeZone={DEFAULT_TIME_ZONE}>
			<NotFoundPage />
		</IntlProvider>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	const { pathname } = useLocation();

	return (
		<html lang={getLocaleFromPathname(pathname)} suppressHydrationWarning>
			{/* biome-ignore lint/style/noHeadElement: TanStack Start renders <head> in the root shell */}
			<head>
				<HeadContent />
			</head>
			<body
				className="font-geist-sans antialiased min-h-dvh flex flex-col items-center justify-center"
				suppressHydrationWarning
			>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
