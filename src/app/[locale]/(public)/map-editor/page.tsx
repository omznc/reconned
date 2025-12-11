import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
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
	if (!env.NEXT_PUBLIC_BETA) {
		notFound();
	}

	return (
		<div className="min-h-screen w-full">
			<MapEditor visible />
		</div>
	);
}
