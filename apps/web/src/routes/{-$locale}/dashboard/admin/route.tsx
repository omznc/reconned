import { createFileRoute, Outlet } from "@tanstack/react-router";
import { NoAccessPage } from "@/components/error-page";
import { NotFoundPage } from "@/components/not-found-page";
import { RouteErrorPage } from "@/components/route-error-page";

// Matched by message: the error is serialized between server and client, so `instanceof` would fail.
const NO_ACCESS = "admin-no-access";

export const Route = createFileRoute("/{-$locale}/dashboard/admin")({
	// Throwing here stops the admin loaders; the error component renders inside the dashboard layout.
	beforeLoad: ({ context }) => {
		if (context.user.role !== "admin") {
			throw new Error(NO_ACCESS);
		}
	},
	notFoundComponent: NotFoundPage,
	errorComponent: (props) =>
		props.error instanceof Error && props.error.message === NO_ACCESS ? (
			<NoAccessPage />
		) : (
			<RouteErrorPage {...props} />
		),
	component: Outlet,
});
