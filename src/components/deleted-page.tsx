import Error404 from "@public/errors/404.webp";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateDeletedMetadata(): Promise<Metadata> {
	const t = await getTranslations();

	return {
		title: t("public.deleted.title"),
		description: t("public.deleted.metadata.description"),
	};
}

export default async function DeletedPage() {
	const t = await getTranslations();

	return (
		<main className="flex h-dvh w-full fade-in-up flex-col items-center justify-center p-8">
			<Image src={Error404} alt="Deleted" draggable={false} className="w-full max-w-[400px] dark:invert" />
			<h1 className="text-4xl font-bold mb-4 text-center">{t("public.deleted.title")}</h1>
			<p className="text-lg mb-8 text-center">{t("public.deleted.message")}</p>
			<Button asChild={true}>
				<Link
					href="/"
					className="text-lg text-center hover:bg-accent transition-all bg-background px-4 py-2 rounded-md border"
				>
					{t("public.deleted.backHome")}
				</Link>
			</Button>
		</main>
	);
}
