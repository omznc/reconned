import { createRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { routeTree } from "@/routeTree.gen";

export function getRouter() {
	return createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: false,
		// Renders inside the nearest layout, below the intl provider. The root route sets its own plain one.
		defaultNotFoundComponent: NotFoundPage,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
