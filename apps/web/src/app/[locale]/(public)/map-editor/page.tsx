import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { MapEditor } from "@/components/map-editor/map-editor-wrapper";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	return {
		title: t("Test Map Editor"),
		description: t("Work in progress"),
	};
}

export default async function MapEditorPage() {
	return (
		<div className="min-h-screen w-full">
			<MapEditor visible />
		</div>
	);
}
