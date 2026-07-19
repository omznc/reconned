import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { MapEditor } from "@/components/map-editor/map-editor-wrapper";

export async function generateMetadata(props: PageProps<"/[locale]/map-editor">): Promise<Metadata> {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();
	return {
		title: t("Test Map Editor"),
		description: t("Work in progress"),
	};
}

export default async function MapEditorPage(props: PageProps<"/[locale]/map-editor">) {
	const { locale } = await props.params;
	setRequestLocale(locale);
	return (
		<div className="min-h-screen w-full">
			<MapEditor visible />
		</div>
	);
}
