"use client";

import type { User } from "better-auth";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { HeaderProvider } from "@/components/header-context";
import { PublicTopBanners } from "@/components/public-top-banners";

export function PublicLayoutClient({ children, user }: { children: React.ReactNode; user: User | null }) {
	return (
		<HeaderProvider>
			<div className="w-full min-h-screen flex flex-col items-center">
				<PublicTopBanners />
				<Header user={user} />
				<main className="grow size-full flex flex-col items-center">
					<div className="absolute -z-10 inset-0 bg-linear-to-b from-red-600/30 to-transparent h-[70dvh]" />
					{children}
				</main>
			</div>
			<Footer />
		</HeaderProvider>
	);
}
