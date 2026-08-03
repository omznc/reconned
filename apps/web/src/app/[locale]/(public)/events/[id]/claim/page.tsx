import { getExtracted, setRequestLocale } from "next-intl/server";
import { ClaimPlaceForm } from "@/app/[locale]/(public)/events/[id]/claim/_components/claim-place-form";
import { ErrorPage } from "@/components/error-page";
import { redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";

/**
 * Where a guest lands from their invitation email. Somebody booked a place for them by email
 * address, and this is what ties that place to an account once they have one — otherwise the
 * place would sit on the roster forever with no way for its owner to reach it.
 */
export default async function ClaimPlacePage(props: PageProps<"/[locale]/events/[id]/claim">) {
	const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
	setRequestLocale(params.locale);
	const t = await getExtracted();

	const rawToken = searchParams.token;
	const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

	if (!token) {
		return <ErrorPage title={t("This invitation link is missing its code")} />;
	}

	const user = await isAuthenticated();

	if (!user) {
		// The link keeps its code across the sign-in, so nobody has to dig the email back out.
		return redirect({
			href: `/login?redirectTo=${encodeURIComponent(
				`${env.NEXT_PUBLIC_WEB_URL}/events/${params.id}/claim?token=${token}`,
			)}`,
			locale: params.locale,
		});
	}

	const { data: eventData } = await apiServer.GET("/api/events/{id}", {
		params: { path: { id: params.id } },
	});

	return (
		<div className="container py-10 max-w-xl space-y-4">
			<h1 className="text-2xl font-bold">{t("Claim your place")}</h1>
			<p className="text-muted-foreground text-sm">
				{eventData?.event.name
					? t("Someone booked a place for you at {eventName}. Add it to your account to manage it.", {
							eventName: eventData.event.name,
						})
					: t("Someone booked a place for you. Add it to your account to manage it.")}
			</p>
			<ClaimPlaceForm token={token} eventId={params.id} />
		</div>
	);
}
