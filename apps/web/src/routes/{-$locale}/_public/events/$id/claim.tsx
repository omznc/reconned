import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { ClaimPlaceForm } from "@/routes/{-$locale}/_public/events/$id/-components/claim-place-form";

const getClaimEventNameFn = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data: { id } }) => {
		const { data } = await apiServer.GET("/api/events/{id}", {
			params: { path: { id } },
		});
		return data?.event.name ?? null;
	});

/**
 * Where a guest lands from their invitation email. Somebody booked a place for them by email
 * address, and this is what ties that place to an account once they have one — otherwise the
 * place would sit on the roster forever with no way for its owner to reach it.
 */
export const Route = createFileRoute("/{-$locale}/_public/events/$id/claim")({
	validateSearch: z.looseObject({ token: z.string().optional().catch(undefined) }),
	beforeLoad: ({ context, params, search }) => {
		// The link keeps its code across the sign-in, so nobody has to dig the email back out.
		if (search.token && !context.user) {
			throw redirect({
				href: `/login?redirectTo=${encodeURIComponent(`/events/${params.id}/claim?token=${search.token}`)}`,
				locale: context.locale,
			});
		}
	},
	loader: async ({ params }) => ({ eventName: await getClaimEventNameFn({ data: { id: params.id } }) }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: ClaimPlacePage,
});

function ClaimPlacePage() {
	const t = useExtracted();
	const { id } = Route.useParams();
	const { token } = Route.useSearch();
	const { eventName } = Route.useLoaderData();

	if (!token) {
		return <ErrorPage title={t("This invitation link is missing its code")} />;
	}

	return (
		<div className="container py-10 max-w-xl space-y-4">
			<h1 className="text-2xl font-bold">{t("Claim your place")}</h1>
			<p className="text-muted-foreground text-sm">
				{eventName
					? t("Someone booked a place for you at {eventName}. Add it to your account to manage it.", {
							eventName,
						})
					: t("Someone booked a place for you. Add it to your account to manage it.")}
			</p>
			<ClaimPlaceForm token={token} eventId={id} />
		</div>
	);
}
