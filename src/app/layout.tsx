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

const geistSans = Geist({
	fallback: ["sans-serif"],
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	fallback: ["monospace"],
	subsets: ["latin"],
});

async function LayoutContent({ children }: { children: ReactNode }) {
	const user = await isAuthenticated();
	return (
		<html lang="en" suppressHydrationWarning>
			<FontBody
				geistMonoVariable={geistMono.className}
				geistSansVariable={geistSans.className}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					enableSystem={false}
					disableTransitionOnChange
				>
					{/* TODO: Do we even need this? */}
					<link
						rel="stylesheet"
						href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
					/>
					<Toaster />
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
	title: "AirsoftBIH",
	description: "Upravljanje vašim klubovima i događajima",
	metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL
		? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL)
		: undefined,
};
