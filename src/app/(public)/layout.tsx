import { Header } from "@/components/header";
import type { ReactNode } from "react";

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	return (
		<div className="w-full min-h-screen flex flex-col">
			<Header />
			<div className="flex-grow flex flex-col items-center justify-center">{children}</div>
		</div>
	);
}
