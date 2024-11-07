import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = localFont({
	src: "./fonts/GeistVF.woff",
	variable: "--font-geist-sans",
	weight: "100 900",
});
const geistMono = localFont({
	src: "./fonts/GeistMonoVF.woff",
	variable: "--font-geist-mono",
	weight: "100 900",
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh flex flex-col items-center justify-center`}
				suppressHydrationWarning
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
						integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
					/>
					<Toaster />
					<NuqsAdapter>
						<TooltipProvider>
							<AlertDialogProvider>{children}</AlertDialogProvider>
						</TooltipProvider>
					</NuqsAdapter>
				</ThemeProvider>
			</body>
		</html>
	);
}

export const metadata: Metadata = {
	title: "AirsoftBIH",
	description: "Upravljanje vašim klubovima i događajima",
	metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL
		? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL)
		: undefined,
};
