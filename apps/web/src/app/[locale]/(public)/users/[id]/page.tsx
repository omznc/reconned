import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { Person, ProfilePage, WithContext } from "schema-dts";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { UserOverview } from "@/components/overviews/user-overview";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
	createAggregateRating,
	createBreadcrumbList,
	createPostalAddress,
	createSportsOrganizationReference,
	removeUndefined,
} from "@/lib/json-ld";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export const revalidate = 3600;

export default async function Page(props: PageProps<"/[locale]/users/[id]">) {
	const params = await props.params;
	const t = await getExtracted();

	const { data: user, error } = await apiServer.GET("/api/users/{id}/profile", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !user) {
		return <ErrorPage title={t("User not found.")} />;
	}

	const userUrl = `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/users/${user.slug || user.id}`;

	let aggregateRating: ReturnType<typeof createAggregateRating> | undefined;
	const reviewsEnabled = await isFeatureEnabled("REVIEWS");
	if (reviewsEnabled) {
		const { data: reviewsData } = await apiServer.GET("/api/reviews/{type}/{id}", {
			params: {
				path: {
					type: "user",
					id: user.id,
				},
			},
		});
		if (reviewsData && reviewsData.reviews.length > 0) {
			const reviews = reviewsData.reviews;
			const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
			aggregateRating = createAggregateRating({
				ratingValue: averageRating,
				ratingCount: reviews.length,
			});
		}
	}

	const personSchema = removeUndefined({
		"@context": "https://schema.org",
		"@type": "Person",
		"@id": userUrl,
		name: user.name,
		url: userUrl,
		...(user.image && { image: user.image }),
		...(user.bio && { description: user.bio }),
		...(user.location && {
			address: createPostalAddress({
				location: user.location,
			}),
		}),
		...(user.callsign && { additionalName: user.callsign }),
		...(user.website && { sameAs: [user.website] }),
		...(user.clubMembership && user.clubMembership.length > 0
			? {
					memberOf: user.clubMembership
						.filter((membership) => membership.club)
						.map((membership) =>
							createSportsOrganizationReference({
								clubId: membership.club.id,
								clubSlug: membership.club.slug,
								clubName: membership.club.name,
								locale: params.locale,
							}),
						),
				}
			: {}),
		knowsAbout: ["Airsoft", "Military Simulation", "Team Sports"],
		hasOccupation: {
			"@type": "Occupation",
			name: "Airsoft Player",
		},
		...(aggregateRating && { aggregateRating }),
	}) as WithContext<Person>;

	const profilePageSchema: WithContext<ProfilePage> = {
		"@context": "https://schema.org",
		"@type": "ProfilePage",
		"@id": `${userUrl}#profile`,
		mainEntity: {
			"@id": userUrl,
		},
		about: {
			"@id": userUrl,
		},
	};

	const breadcrumbSchema = createBreadcrumbList([
		{ name: t("Home"), url: `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}` },
		{ name: t("Players"), url: `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/users` },
		{ name: user.name, url: userUrl },
	]);

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8 px-4">
			<JsonLdScript data={personSchema} />
			<JsonLdScript data={profilePageSchema} />
			<JsonLdScript data={breadcrumbSchema} />
			<UserOverview user={user} />
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/users/[id]">): Promise<Metadata> {
	const params = await props.params;
	const locale = await getLocale();

	const { data: user, error } = await apiServer.GET("/api/users/{id}/profile", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !user) {
		return {
			title: "User not found.",
		};
	}

	const pathPrefix = "/users";
	const slugOrId = user.slug || user.id;
	const canonicalUrl = constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", `${pathPrefix}/${slugOrId}`, locale);

	const clubNames = user.clubMembership?.map((m) => m.club.name).filter(Boolean) || [];

	const userKeywords = [
		"airsoft player",
		"airsoft gamer",
		"verified airsoft player",
		"airsoft player BiH",
		"airsoft player Bosnia",
		user.name,
		user.callsign || null,
		user.location || null,
		`airsoft player ${user.location || ""}`,
		user.callsign ? `airsoft ${user.callsign}` : null,
		...clubNames.map((name) => `airsoft ${name}`),
	]
		.filter(Boolean)
		.join(", ");

	const description = user.bio
		? user.bio.length > 150
			? `${user.bio.slice(0, 147)}...`
			: user.bio
		: `${user.name}${user.callsign ? ` (${user.callsign})` : ""} is an airsoft player${user.location ? ` from ${user.location}` : ""}${clubNames.length > 0 ? `, member of ${clubNames.join(", ")}` : ""}.`;

	return {
		title: `${user.name} - RECONNED`,
		description,
		keywords: userKeywords,
		openGraph: {
			title: `${user.name} - RECONNED`,
			description,
			type: "profile",
			url: canonicalUrl,
			...(user.image && { images: [{ url: user.image, alt: user.name }] }),
		},
		twitter: {
			card: "summary_large_image",
			title: `${user.name} - RECONNED`,
			description,
		},
		alternates: {
			canonical: canonicalUrl,
			languages: generateHreflangAlternatesForSluggableEntity(
				env.NEXT_PUBLIC_WEB_URL || "",
				pathPrefix,
				user.id,
				locale,
				user.slug || undefined,
			),
		},
		metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
	};
}
