import { createFileRoute, Outlet } from "@tanstack/react-router";
import { House } from "lucide-react";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import background from "@/assets/auth/background-blur.webp";
import backgroundLight from "@/assets/auth/background-blur-light.webp";
import { AnimationWrapper } from "@/components/auth/animation-wrapper";
import { Image } from "@/components/image";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";
import { RouteErrorPage } from "@/components/route-error-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { buildSeoHead } from "@/lib/seo";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const Route = createFileRoute("/{-$locale}/_auth")({
	loader: async ({ context }) => {
		const { locale } = context;
		const t = await getExtracted({ locale });
		const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
		const title = t("Sign In & Join RECONNED - Airsoft Community Platform");
		const description = t(
			"Access your RECONNED account to manage your airsoft profile, join clubs, and register for events. Sign in or create an account today.",
		);
		return {
			title,
			description,
			keywords: t(
				"airsoft login, airsoft register, airsoft account, join airsoft community, airsoft platform sign in, airsoft player account",
			)
				.split(",")
				.map((keyword: string) => keyword.trim())
				.join(", "),
			canonical: constructCanonicalUrl(baseUrl, "/login", locale),
			languages: generatePageLanguages(baseUrl, "/login", locale),
		};
	},
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData) : {}),
	component: AuthLayout,
	errorComponent: RouteErrorPage,
});

function AuthLayout() {
	const t = useExtracted();

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
				<AnimationWrapper>
					<Outlet />
				</AnimationWrapper>
			</Card>
		</>
	);
}
