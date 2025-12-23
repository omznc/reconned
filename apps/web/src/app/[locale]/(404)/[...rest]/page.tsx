import { getExtracted } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";

export default async function CatchAllPage() {
	const t = await getExtracted();
	return <ErrorPage title={t("Page not found")} />;
}
