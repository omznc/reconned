import { Button } from "@/components/ui/button";
import { Frown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
	const t = await getTranslations("public.notFound");
	return (
		<html lang="en">
			<body>
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
			</body>
		</html>
	);
}
