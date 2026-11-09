import "server-only";

import { getExtracted } from "next-intl/server";
import type { Person, ProfilePage, WithContext } from "schema-dts";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
	createAggregateRating,
	createBreadcrumbList,
	createPostalAddress,
	createSportsOrganizationReference,
	removeUndefined,
} from "@/lib/json-ld";
import type { SeoInput } from "@/lib/seo";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

type UserProfile = ApiResponse<"/api/users/{id}/profile", "get">;

type Reviews = ApiResponse<"/api/reviews/{type}/{id}", "get">["reviews"];

/** The reviews of a user, or `undefined` when the `REVIEWS` flag is off. */
export async function fetchUserReviews(userId: string) {
	if (!(await isFeatureEnabled("REVIEWS"))) {
		return undefined;
	}
	const { data } = await apiServer.GET("/api/reviews/{type}/{id}", {
		params: { path: { type: "user", id: userId } },
	});
	return data?.reviews;
}

function buildAggregateRating(reviews: Reviews | undefined) {
	if (!reviews || reviews.length === 0) {
		return undefined;
	}
	const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
	return createAggregateRating({ ratingValue: averageRating, ratingCount: reviews.length });
}

function buildPersonSchema(
	user: UserProfile,
	userUrl: string,
	locale: string,
	aggregateRating: ReturnType<typeof createAggregateRating> | undefined,
) {
	return removeUndefined({
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
								locale,
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
}

function buildDescription(user: UserProfile, clubNames: string[]) {
	if (user.bio) {
		return user.bio.length > 150 ? `${user.bio.slice(0, 147)}...` : user.bio;
	}
	return `${user.name}${user.callsign ? ` (${user.callsign})` : ""} is an airsoft player${user.location ? ` from ${user.location}` : ""}${clubNames.length > 0 ? `, member of ${clubNames.join(", ")}` : ""}.`;
}

export function buildUserSeo(user: UserProfile, locale: string, schemas: string[]): SeoInput {
	const pathPrefix = "/users";
	const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
	const clubNames = user.clubMembership?.map((m) => m.club.name).filter(Boolean) || [];
	const keywords = [
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

	return {
		title: `${user.name} - RECONNED`,
		description: buildDescription(user, clubNames),
		keywords,
		canonical: constructCanonicalUrl(baseUrl, `${pathPrefix}/${user.slug || user.id}`, locale),
		languages: generateHreflangAlternatesForSluggableEntity(
			baseUrl,
			pathPrefix,
			user.id,
			locale,
			user.slug || undefined,
		),
		image: user.image ? { url: user.image, alt: user.name } : undefined,
		schemas,
	};
}

export async function buildUserSchemas(user: UserProfile, locale: string, reviews: Reviews | undefined) {
	const t = await getExtracted({ locale });
	const userUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/users/${user.slug || user.id}`;
	const aggregateRating = buildAggregateRating(reviews);

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
		{ name: t("Home"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}` },
		{ name: t("Players"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/users` },
		{ name: user.name, url: userUrl },
	]);

	return [buildPersonSchema(user, userUrl, locale, aggregateRating), profilePageSchema, breadcrumbSchema].map(
		(schema) => JSON.stringify(schema),
	);
}
