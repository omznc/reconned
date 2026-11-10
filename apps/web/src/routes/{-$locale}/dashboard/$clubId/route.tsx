import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirect } from "@/i18n/navigation";
import { loginHrefFor } from "@/lib/safe-redirect";
import { getClubAccessFn } from "@/routes/{-$locale}/dashboard/$clubId/-lib/club-access";

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId")({
	beforeLoad: async ({ context, params, location }) => {
		const { user, locale } = context;
		if (!user) {
			throw redirect({ href: loginHrefFor(location), locale });
		}
		const { role, isMember, membership } = await getClubAccessFn({ data: { clubId: params.clubId } });
		const isAdmin = user.role === "admin";
		return {
			access: {
				role,
				isMember,
				membership,
				isAdmin,
				isManager: role === "MANAGER" || role === "CLUB_OWNER" || isAdmin,
			},
		};
	},
	component: Outlet,
});
