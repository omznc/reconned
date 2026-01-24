import { House } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AnimationWrapper } from "@/app/[locale]/(auth)/_components/animation-wrapper";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import background from "./background-blur.webp";
import backgroundLight from "./background-blur-light.webp";

export default async function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const t = await getExtracted();

	return (
		<>
			<Image
				src={background}
				alt="Background"
				className="absolute dark:block hidden inset-0 object-cover w-full h-full blur-md"
				quality={50}
				priority
			/>
			<Image
				src={backgroundLight}
				alt="Background"
				className="block dark:hidden absolute inset-0 object-cover w-full h-full blur-md"
				quality={50}
				priority
			/>
			<Card className="w-full z-10 border-0 mx-auto md:border flex flex-col items-center justify-start min-h-dvh md:min-h-auto shadow-none md:max-w-sm overflow-y-auto md:overflow-hidden md:h-fit">
				<div className="flex w-full gap-2 pt-6 px-6">
					<div className="w-full">
						<Button variant={"outline"} className="shadow-none w-full" asChild={true}>
							<Link href="/" className="flex items-center gap-2">
								<House className="w-4 h-4" />
								{t("Homepage")}
							</Link>
						</Button>
					</div>
					<div className="w-full">
						<LanguageSwitcher className="w-full items-center justify-center" variant="outline" />
					</div>
				</div>
				<AnimationWrapper>{children}</AnimationWrapper>
			</Card>
		</>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Sign In & Join RECONNED - Airsoft Community Platform"),
		description: t(
			"Access your RECONNED account to manage your airsoft profile, join clubs, and register for events. Sign in or create an account today.",
		),
		keywords: t(
			"airsoft login, airsoft register, airsoft account, join airsoft community, airsoft platform sign in, airsoft player account",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Sign In & Join RECONNED - Airsoft Community Platform"),
			description: t(
				"Access your RECONNED account to manage your airsoft profile, join clubs, and register for events. Sign in or create an account today.",
			),
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title: t("Sign In & Join RECONNED - Airsoft Community Platform"),
			description: t(
				"Access your RECONNED account to manage your airsoft profile, join clubs, and register for events. Sign in or create an account today.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/login", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/login", locale),
		},
	};
}
