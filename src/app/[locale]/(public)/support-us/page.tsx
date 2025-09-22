import { Button } from "@components/ui/button";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export const revalidate = 86_400; // 1 day

export default async function Page() {
	const t = await getTranslations();

	return (
		<div className="flex flex-col gap-4">
			<h1>{t("public.supportUs.title")}</h1>
			<Button type="button" variant="secondary">
				<Link href="/">{t("common.actions.back")}</Link>
			</Button>
		</div>
	);
}
