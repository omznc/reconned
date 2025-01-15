import type { Metadata } from "next";
import "./globals.css";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { env } from "@/lib/env";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { FontProvider } from "@/components/font-switcher";

import { Geist_Mono, Geist } from "next/font/google";
import { FontBody } from "@/components/font-body";
import type { ReactNode } from "react";
import { isAuthenticated } from "@/lib/auth";
import { ImpersonationAlert } from "@/components/impersonation-alert";
import Script from "next/script";

const geistSans = Geist({
	fallback: ["sans-serif"],
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	fallback: ["monospace"],
	subsets: ["latin"],
});

async function LayoutContent({ children }: { children: ReactNode; }) {
	const user = await isAuthenticated();
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta name="darkreader-lock" />
				<Script defer data-domain="reconned.com" src="https://scout.reconned.com/js/script.outbound-links.tagged-events.js" />
			</head>
			<FontBody
				geistMonoVariable={geistMono.className}
				geistSansVariable={geistSans.className}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
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
							{user?.session?.impersonatedBy && <ImpersonationAlert />}
							<AlertDialogProvider>{children}</AlertDialogProvider>
						</TooltipProvider>
					</NuqsAdapter>
				</ThemeProvider>
			</FontBody>
		</html>
	);
}

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	return (
		<FontProvider>
			<LayoutContent>{children}</LayoutContent>
		</FontProvider>
	);
}

export const metadata: Metadata = {
	title: "RECONNED - Airsoft klubovi, susreti, i igrači",
	description: "Prva univerzalna platforma za airsoft klubove, susrete, i igrače u Bosni i Hercegovini.",
	metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL
		? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL)
		: undefined,
};
