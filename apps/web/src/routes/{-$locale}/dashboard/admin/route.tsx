import { createFileRoute, Outlet } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { redirect } from "@/i18n/navigation";

export const Route = createFileRoute("/{-$locale}/dashboard/admin")({
	beforeLoad: ({ context }) => {
		if (context.user.role !== "admin") {
			throw redirect({ href: "/dashboard", locale: context.locale });
		}
	},
	notFoundComponent: NotFoundPage,
	component: Outlet,
});
