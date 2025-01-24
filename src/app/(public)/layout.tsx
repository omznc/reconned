import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export default async function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const user = await isAuthenticated();
	const t = await getTranslations("components.sidebar");

	// TODO: We'll do beta only now, but otherwise we'll keep this only on the beta subdomain.
	const isBeta = env.NEXT_PUBLIC_BETTER_AUTH_URL?.includes("beta") || true;

	return (
		<>
			<div className="w-full min-h-screen flex flex-col items-center">
				{
					isBeta && (
						<div className="top-0 left-0 z-50 w-full bg-background/20 text-center py-2">
							<p className="text-sm">
								{t('betaMessage')}
							</p>
						</div>
					)
				}
				<Header user={user} />
				<div className="flex-grow size-full flex flex-col items-center">
					<div className="absolute -z-10 inset-0 bg-gradient-to-b from-red-600/30 to-transparent h-[70dvh]" />
					{children}
				</div>
			</div>
			<Footer />
		</>
	);
}
