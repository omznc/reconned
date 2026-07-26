import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createBreadcrumbList } from "@/lib/json-ld";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const revalidate = 3600;

const PATH = "/clubs/city";

export default async function Page(props: PageProps<"/[locale]/clubs/city">) {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	const { data, error } = await apiServer.GET("/api/public/cities", { next: { revalidate: 3600 } });

	if (error || !data) {
		return <ErrorPage title={t("Error loading cities")} />;
	}

	const breadcrumbSchema = createBreadcrumbList([
		{ name: t("Home"), url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/", locale) },
		{ name: t("Clubs"), url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale) },
		{ name: t("By city"), url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", PATH, locale) },
	]);

	return (
		<>
			<JsonLdScript data={breadcrumbSchema} />
			<div className="container max-w-7xl py-8 px-4">
				<div className="space-y-6">
					<div className="space-y-3">
						<h1 className="text-2xl font-bold tracking-tight">{t("Airsoft clubs by city")}</h1>
						<p className="text-muted-foreground max-w-3xl">
							{t("Pick a city to see the airsoft clubs based there and the events they are running.")}
						</p>
					</div>

					{data.cities.length === 0 ? (
						<p className="text-muted-foreground">{t("No cities have enough clubs listed yet.")}</p>
					) : (
						<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{data.cities.map((city) => (
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
		</>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/clubs/city">): Promise<Metadata> {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	const title = t("Airsoft Clubs by City - RECONNED");
	const description = t(
		"Browse airsoft clubs by city. Find the teams based near you, see which events they run, and get in touch.",
	);

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", PATH, locale),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", PATH, locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", PATH, locale),
		},
	};
}
