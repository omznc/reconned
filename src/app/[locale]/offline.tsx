import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function OfflinePage() {
	const t = await getTranslations("public.offline");

	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
			<div className="mb-4 text-red-500">
				<AlertCircle size={48} />
			</div>
			<h1 className="mb-6 text-4xl font-bold">{t("title")}</h1>
			<p className="mb-8 text-xl">{t("message")}</p>
			<Button asChild>
				<Link href="/">{t("returnHome")}</Link>
			</Button>
		</div>
	);
}
