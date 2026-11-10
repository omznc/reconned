import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@/i18n/navigation";

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/")({
	beforeLoad: ({ context, params }) => {
		throw redirect({ href: `/dashboard/${params.clubId}/club`, locale: context.locale });
	},
});
