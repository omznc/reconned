import Error404 from "@public/errors/404.webp";
import { useExtracted } from "next-intl";
import { Image } from "@/components/image";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Body of every 404. Render it from a route `notFoundComponent`; the router sets the 404 status. */
export function NotFoundPage() {
	const t = useExtracted();

	return (
		<main className="flex h-dvh w-full fade-in-up flex-col items-center justify-center p-8">
			<Image
				src={Error404}
				alt="404"
				draggable={false}
				sizes="100vw"
				className="w-full max-w-[400px] dark:invert"
			/>
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
