import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";

/** Catch-all for unmatched URLs. Throws in the loader (not `beforeLoad`) so the layout's messages are loaded first. */
export const Route = createFileRoute("/{-$locale}/$")({
	loader: () => {
		throw notFound();
	},
	notFoundComponent: NotFoundPage,
});
