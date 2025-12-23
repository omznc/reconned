import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import { MapEditor } from "@/components/map-editor/map-editor";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	return {
		title: t("Test Map Editor"),
		description: t("Work in progress"),
	};
}

export default async function MapEditorPage() {
	const t = await getExtracted();
	if (!env.NEXT_PUBLIC_BETA) {
		return <ErrorPage title={t("Page not found")} />;
	}

	return (
		<div className="min-h-screen w-full">
			<MapEditor visible />
		</div>
	);
}
