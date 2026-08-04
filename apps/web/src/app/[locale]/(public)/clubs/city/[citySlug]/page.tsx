import { format } from "date-fns";
import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
import JsonLdScript from "@/components/json-ld-script";
import { ListingCard } from "@/components/listing-card";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { getDateFnsLocale } from "@/lib/date-locale";
import { env } from "@/lib/env";
import type { LogoTile } from "@/lib/identity";
import { createBreadcrumbList, createItemListWithClubs, createWebPageSchema } from "@/lib/json-ld";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const revalidate = 3600;

type CityData = {
	city: string | null;
	citySlug: string;
	clubs: Array<{
		id: string;
		slug: string | null;
		name: string;
		description: string | null;
		location: string | null;
		logo: string | null;
		logoTile: LogoTile;
		latitude: number | null;
		longitude: number | null;
		verified: boolean;
		updatedAt: string;
		_count: { members: number };
	}>;
	events: Array<{
		id: string;
		slug: string | null;
		name: string;
		description: string | null;
		location: string | null;
		dateStart: string;
		dateEnd: string | null;
		clubName: string;
	}>;
};

/**
 * A city page exists only as long as the city still has clubs. Returning `null`
 * here (rather than an empty page) is what makes an emptied-out city 404 instead
 * of lingering in the index as a blank result.
 */
async function getCity(citySlug: string): Promise<CityData | null> {
	const { data, error } = await apiServer.GET("/api/public/cities/{citySlug}", {
		params: { path: { citySlug } },
		next: { revalidate: 3600 },
	});

	if (error || !data || data.clubs.length === 0 || !data.city) {
		return null;
	}

	return data as CityData;
}

export default async function Page(props: PageProps<"/[locale]/clubs/city/[citySlug]">) {
	const { locale, citySlug } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	const data = await getCity(citySlug);
	if (!data?.city) {
		notFound();
	}

	const cityName = data.city;
	const path = `/clubs/city/${citySlug}`;
	const pageUrl = constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", path, locale);

	const now = new Date();
	const upcomingEvents = data.events.filter((event) => new Date(event.dateEnd ?? event.dateStart) >= now);

	// The clubs are already the complete set for this city, so the list is a single
	// page of itself — there is no pagination to describe.
	const itemListSchema = createItemListWithClubs({
		clubs: data.clubs.map((club) => ({
			id: club.id,
			slug: club.slug,
			name: club.name,
			description: club.description,
			logo: club.logo,
			location: club.location,
			latitude: club.latitude,
			longitude: club.longitude,
			contactEmail: null,
			contactPhone: null,
			dateFounded: null,
			verified: club.verified,
		})),
		page: 1,
		itemsPerPage: data.clubs.length,
		total: data.clubs.length,
		locale,
		name: t("Airsoft clubs in {city}", { city: cityName }),
		description: t("Every airsoft club based in {city}, with the events they are running.", { city: cityName }),
	});

	const breadcrumbSchema = createBreadcrumbList([
		{ name: t("Home"), url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/", locale) },
		{ name: t("Clubs"), url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale) },
		{ name: cityName, url: pageUrl },
	]);

	// The freshest club in the city stands in for the page's own modification date:
	// the page is nothing but its clubs, so it is as current as they are.
	const lastModified = data.clubs.reduce<string | null>(
		(newest, club) => (newest === null || club.updatedAt > newest ? club.updatedAt : newest),
		null,
	);

	const webPageSchema = createWebPageSchema({
		pageUrl,
		name: t("Airsoft clubs in {city}", { city: cityName }),
		dateModified: lastModified,
	});

	return (
		<>
			<JsonLdScript data={webPageSchema} />
			<JsonLdScript data={breadcrumbSchema} />
			<JsonLdScript data={itemListSchema} />
			<div className="container max-w-7xl py-8 px-4">
				<div className="space-y-8">
					<div className="space-y-3">
						<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
							<MapPin className="size-6 shrink-0" />
							{t("Airsoft clubs in {city}", { city: cityName })}
						</h1>
						<p className="text-muted-foreground max-w-3xl">
							{t(
								"{count, plural, one {# airsoft club is} other {# airsoft clubs are}} based in {city}. Browse them below, see who is running events, and get in touch with the one closest to you.",
								{ city: cityName, count: data.clubs.length },
							)}
						</p>
						<Link href="/clubs" className="text-sm underline underline-offset-4">
							{t("See all clubs")}
						</Link>
					</div>

					<section className="space-y-4">
						<h2 className="text-xl font-semibold tracking-tight">{t("Clubs")}</h2>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
							{data.clubs.map((club) => (
								<ListingCard
									key={club.id}
									type="club"
									image={club.logo}
									tile={club.logoTile}
									title={club.name}
									description={club.description}
									href={`/clubs/${club.slug || club.id}`}
									verified={club.verified}
									memberCount={club._count.members}
									meta={club.location || undefined}
								/>
							))}
						</div>
					</section>

					{upcomingEvents.length > 0 && (
						<section className="space-y-4">
							<h2 className="text-xl font-semibold tracking-tight">
								{t("Upcoming events in {city}", { city: cityName })}
							</h2>
							<ul className="space-y-2">
								{upcomingEvents.map((event) => (
									<li key={event.id}>
										<Link
											href={`/events/${event.slug || event.id}`}
											className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-sidebar p-3 transition-colors hover:border-red-500"
										>
											<span className="font-medium">{event.name}</span>
											<span className="text-muted-foreground text-sm flex items-center gap-1">
												<CalendarDays className="size-4 shrink-0" />
												{format(new Date(event.dateStart), "d. MMMM yyyy.", {
													locale: getDateFnsLocale(locale),
												})}
											</span>
											<span className="text-muted-foreground text-sm">{event.clubName}</span>
										</Link>
									</li>
								))}
							</ul>
						</section>
					)}
				</div>
			</div>
		</>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/clubs/city/[citySlug]">): Promise<Metadata> {
	const { locale, citySlug } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	const data = await getCity(citySlug);
	if (!data?.city) {
		return { title: t("City not found") };
	}

	const cityName = data.city;
	const path = `/clubs/city/${citySlug}`;
	const title = t("Airsoft clubs in {city} - RECONNED", { city: cityName });
	const description = t(
		"{count, plural, one {# airsoft club} other {# airsoft clubs}} in {city}. See who plays nearby, which events they run, and how to join.",
		{ city: cityName, count: data.clubs.length },
	);

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", path, locale),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", path, locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", path, locale),
		},
	};
}
