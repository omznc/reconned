import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PublicTopBanners } from "@/components/public-top-banners";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";

export default async function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const user = await isAuthenticated();
	const isBeta = env.NEXT_PUBLIC_BETA || false;

	return (
		<>
			<div className="w-full min-h-screen flex flex-col items-center">
				<PublicTopBanners isBeta={isBeta} />
				<Header user={user} />
				<main className="grow size-full flex flex-col items-center">
					<div className="absolute -z-10 inset-0 bg-linear-to-b from-red-600/30 to-transparent h-[70dvh]" />
					{children}
				</main>
			</div>
			<Footer />
		</>
	);
}
