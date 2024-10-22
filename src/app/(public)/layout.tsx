import { LogoTvrdjava } from "@/components/logos/logo-tvrdjava";
import { LogoVeis } from "@/components/logos/logo-veis";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import DotPattern from "@/components/ui/dot-pattern";
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
			<DotPattern className="-z-10 opacity-30" />
			<Footer />
		</>
	);
}
