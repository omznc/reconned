import Error404 from "@public/errors/404.webp";
import type { Metadata } from "next";
import Image from "next/image";
import { getExtracted } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();

	return {
		title: t("You are lost"),
		description: t("The page you are looking for does not exist."),
		keywords: t("404, not found, page not found, airsoft, Bosnia, BiH")
			.split(",")
			.map((keyword: string) => keyword.trim()),
	};
}

export default async function NotFound() {
	const t = await getExtracted();

	return (
		<main className="flex h-dvh w-full fade-in-up flex-col items-center justify-center p-8">
			<Image src={Error404} alt="404" draggable={false} className="w-full max-w-[400px] dark:invert" />
			<h1 className="text-4xl font-bold mb-4 text-center">{t("You are lost")}</h1>
			<p className="text-lg mb-8 text-center">{t("Page not found")}</p>
			<Button asChild={true}>
				<Link
					href="/"
					className="text-lg text-center hover:bg-accent transition-all bg-background px-4 py-2 rounded-md border"
				>
					{t("Return to homepage")}
				</Link>
			</Button>
		</main>
	);
}
