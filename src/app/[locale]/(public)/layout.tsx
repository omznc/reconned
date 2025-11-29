import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";

export default async function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const user = await isAuthenticated({ bypassCache: true });
	const t = await getTranslations();

	const isBeta = env.NEXT_PUBLIC_BETA ?? false;

	return (
		<>
			<div className="w-full min-h-screen flex flex-col items-center">
				{isBeta && (
					<div className="top-0 left-0 z-50 w-full bg-background/40 text-center py-1.5">
						<p className="text-sm">{t("components.sidebar.betaMessage")}</p>
					</div>
				)}
				<Link
					href="https://github.com/omznc/reconned?utm_source=reconned.com"
					className="top-0 left-0 z-50 w-full bg-background/20 text-center py-1.5"
				>
					<p className="text-sm">{t("components.sidebar.githubMessage")}</p>
				</Link>
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
