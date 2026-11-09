import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createBreadcrumbList } from "@/lib/json-ld";
import { buildSeoHead, type SeoInput } from "@/lib/seo";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const PATH = "/clubs/city";

const getCitiesPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ locale: z.string() }))
	.handler(async ({ data: { locale } }) => {
		const t = await getExtracted({ locale });
		const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
		const seo: SeoInput = {
			title: t("Airsoft Clubs by City - RECONNED"),
			description: t(
				"Browse airsoft clubs by city. Find the teams based near you, see which events they run, and get in touch.",
			),
			canonical: constructCanonicalUrl(baseUrl, PATH, locale),
			languages: generatePageLanguages(baseUrl, PATH, locale),
		};

		const { data, error } = await apiServer.GET("/api/public/cities");
		if (error || !data) {
			return { kind: "error" as const, seo };
		}

		const breadcrumbSchema = createBreadcrumbList([
			{ name: t("Home"), url: constructCanonicalUrl(baseUrl, "/", locale) },
			{ name: t("Clubs"), url: constructCanonicalUrl(baseUrl, "/clubs", locale) },
			{ name: t("By city"), url: constructCanonicalUrl(baseUrl, PATH, locale) },
		]);

		return {
			kind: "ok" as const,
			cities: data.cities,
			seo: { ...seo, schemas: [JSON.stringify(breadcrumbSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/clubs/city/")({
	loader: ({ context }) => getCitiesPageFn({ data: { locale: context.locale } }),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: CitiesPage,
});

function CitiesPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();

	if (page.kind === "error") {
		return <ErrorPage title={t("Error loading cities")} />;
	}

	return (
		<div className="container max-w-7xl py-8 px-4">
			<div className="space-y-6">
				<div className="space-y-3">
					<h1 className="text-2xl font-bold tracking-tight">{t("Airsoft clubs by city")}</h1>
					<p className="text-muted-foreground max-w-3xl">
						{t("Pick a city to see the airsoft clubs based there and the events they are running.")}
					</p>
				</div>

				{page.cities.length === 0 ? (
					<p className="text-muted-foreground">{t("No cities have enough clubs listed yet.")}</p>
				) : (
					<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{page.cities.map((city) => (
							<li key={city.citySlug}>
								<Link href={`/clubs/city/${city.citySlug}`} className="block group">
									<Card className="flex flex-row items-center gap-3 border bg-sidebar p-4 transition-colors hover:border-red-500">
										<MapPin className="size-5 shrink-0 text-muted-foreground" />
										<span className="font-medium">{city.city}</span>
										<span className="ml-auto text-sm text-muted-foreground">
											{t("{count, plural, one {# club} other {# clubs}}", {
												count: city.clubCount,
											})}
										</span>
									</Card>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
