import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { buildCatchAllHead, getNotFoundData, readNotFoundData } from "@/lib/not-found";

/** Catch-all for unmatched URLs. Throws in the loader (not `beforeLoad`) so the layout's messages are loaded first. */
export const Route = createFileRoute("/{-$locale}/$")({
	loader: async ({ context }) => {
		throw notFound({ data: await getNotFoundData(context.locale) });
	},
	head: ({ match }) => {
		const data = readNotFoundData(match.error);
		return data ? buildCatchAllHead(data) : {};
	},
	notFoundComponent: NotFoundPage,
});
