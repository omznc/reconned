import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import Error404 from "@public/errors/404.webp";

export default async function NotFound() {
	const t = await getTranslations("public.notFound");

	return (
		<main className="flex h-dvh w-full fade-in-up flex-col items-center justify-center p-8">
			<Image src={Error404} alt="404" draggable={false} className="w-full max-w-[400px] dark:invert" />
			<h1 className="text-4xl font-bold mb-4 text-center">{t("title")}</h1>
			<p className="text-lg mb-8 text-center">{t("message")}</p>
			<Button asChild={true}>
				<Link
					href="/"
					className="text-lg text-center hover:bg-accent transition-all bg-background px-4 py-2 rounded-md border"
				>
					{t("backHome")}
				</Link>
			</Button>
		</main>
	);
}
