import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AlertDialogProvider } from "@/components/ui/alert-dialog-provider";

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

export const metadata: Metadata = {
	title: "Airsoft BIH",
	description: "Description pending",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh flex flex-col items-center justify-center`}
			>
				<AlertDialogProvider>{children}</AlertDialogProvider>
			</body>
		</html>
	);
}
