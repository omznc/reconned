import { createFileRoute } from "@tanstack/react-router";
import { getExtracted } from "next-intl/server";
import { MapEditor } from "@/components/map-editor/map-editor-wrapper";

export const Route = createFileRoute("/{-$locale}/_public/map-editor")({
	loader: async ({ context }) => {
		const t = await getExtracted({ locale: context.locale });
		return { title: t("Test Map Editor"), description: t("Work in progress") };
	},
	head: ({ loaderData }) => ({
		meta: loaderData ? [{ title: loaderData.title }, { name: "description", content: loaderData.description }] : [],
	}),
	component: MapEditorPage,
});

function MapEditorPage() {
	return (
		<div className="min-h-screen w-full">
			<MapEditor visible />
		</div>
	);
}
