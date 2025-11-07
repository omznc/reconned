import { House } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AnimationWrapper } from "@/app/[locale]/(auth)/_components/animation-wrapper";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import background from "./background-blur.webp";
import backgroundLight from "./background-blur-light.webp";

export default async function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const t = await getTranslations();

	return (
		<>
			<Image
				src={background}
				alt="Background"
				className="absolute dark:block hidden inset-0 object-cover w-full h-full blur-md"
				quality={100}
				priority
			/>
			<Image
				src={backgroundLight}
				alt="Background"
				className="block dark:hidden absolute inset-0 object-cover w-full h-full blur-md"
				quality={100}
				priority
			/>
			<Card className="w-full z-10 border-0 mx-auto md:border flex flex-col items-center justify-start min-h-dvh md:min-h-auto shadow-none md:max-w-sm overflow-y-auto md:overflow-hidden md:h-fit">
				<div className="flex w-full gap-2 pt-6 px-6">
					<div className="w-full">
						<Button variant={"outline"} className="shadow-none w-full" asChild={true}>
							<Link href="/" className="flex items-center gap-2">
								<House className="w-4 h-4" />
								{t("components.sidebar.home")}
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
	const t = await getTranslations();

	return {
		title: t("public.auth.metadata.title"),
		description: t("public.auth.metadata.description"),
		keywords: t("public.layout.metadata.keywords")
			.split(",")
			.map((keyword: string) => keyword.trim()),
	};
}
