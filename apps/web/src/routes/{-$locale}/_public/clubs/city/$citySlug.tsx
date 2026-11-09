import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { CalendarDays, MapPin } from "lucide-react";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ListingCard } from "@/components/listing-card";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { Link } from "@/i18n/navigation";
import { getDateFnsLocale } from "@/lib/date-locale";
import { buildSeoHead } from "@/lib/seo";
import { buildCitySeo, getCity } from "@/lib/server/city-page";

const getCityPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ citySlug: z.string(), locale: z.string() }))
	.handler(async ({ data: { citySlug, locale } }) => {
		const data = await getCity(citySlug);
		if (!data) {
			return null;
		}

		const now = new Date();
		return {
			city: data.city,
			clubs: data.clubs,
			upcomingEvents: data.events.filter((event) => new Date(event.dateEnd ?? event.dateStart) >= now),
			seo: await buildCitySeo(data, citySlug, locale),
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/clubs/city/$citySlug")({
	loader: async ({ params, context }) => {
		const page = await getCityPageFn({ data: { citySlug: params.citySlug, locale: context.locale } });
		if (!page) {
			throw notFound();
		}
		return page;
	},
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : { meta: [{ title: "City not found" }] }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: CityPage,
});

function CityPage() {
	const t = useExtracted();
	const { city: cityName, clubs, upcomingEvents } = Route.useLoaderData();
	const { locale } = Route.useRouteContext();

	return (
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
							{ city: cityName, count: clubs.length },
						)}
					</p>
					<Link href="/clubs" className="text-sm underline underline-offset-4">
						{t("See all clubs")}
					</Link>
				</div>

				<section className="space-y-4">
					<h2 className="text-xl font-semibold tracking-tight">{t("Clubs")}</h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
						{clubs.map((club) => (
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
	);
}
