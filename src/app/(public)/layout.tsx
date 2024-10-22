import { LogoTvrdjava } from "@/app/(public)/logo-tvrdjava";
import { LogoVeis } from "@/app/(public)/logo-veis";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import Link from "next/link";
import type { ReactNode } from "react";

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	return (
		<>
			<div className="w-full min-h-screen flex flex-col items-center">
				<Header />
				<div className="flex-grow p-2 size-full flex flex-col items-center max-w-[1200px]">{children}</div>
			</div>
			<Footer />
		</>
	);
}
