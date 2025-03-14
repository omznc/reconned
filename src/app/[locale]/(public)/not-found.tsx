import { Button } from "@/components/ui/button";
import { Frown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function NotFound() {
	const t = useTranslations("public.notFound");

	return (
		<main className="flex fade-in-up flex-col items-center justify-between p-24">
			<Frown className="size-24 mb-4" />
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
