import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { Person, ProfilePage, WithContext } from "schema-dts";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { UserOverview } from "@/components/overviews/user-overview";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { env } from "@/lib/env";
import {
	createAggregateRating,
	createBreadcrumbList,
	createPostalAddress,
	createSportsOrganizationReference,
	createReviewSchema,
	removeUndefined,
} from "@/lib/json-ld";
import { FEATURE_FLAGS } from "@/lib/server-utils";
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
	type ReviewsDataType = ApiResponse<"/api/reviews/{type}/{id}", "get">;
	let reviewsResponse: ReviewsDataType | undefined;
	if (FEATURE_FLAGS.REVIEWS) {
		const response = await apiServer.GET("/api/reviews/{type}/{id}", {
			params: {
				path: {
					type: "user",
					id: user.id,
				},
			},
		});
		reviewsResponse = response.data;
		if (response.data && response.data.reviews.length > 0) {
			const reviews = response.data.reviews;
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

	// Generate review schema
	let reviewSchema: ReturnType<typeof createReviewSchema> | undefined;
	if (FEATURE_FLAGS.REVIEWS && reviewsResponse?.reviews) {
		const reviews = reviewsResponse.reviews;
		if (reviews.length > 0) {
			reviewSchema = createReviewSchema({
				reviews: reviews.map((review) => ({
					author: review.author?.name || t("Anonymous"),
					rating: review.rating,
					content: review.content || "",
					datePublished: new Date(review.createdAt).toISOString(),
				})),
				itemReviewed: user.name,
				itemReviewedType: "Person",
			});
		}
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8 px-4">
			<JsonLdScript data={personSchema} />
			<JsonLdScript data={profilePageSchema} />
			<JsonLdScript data={breadcrumbSchema} />
			{reviewSchema && <JsonLdScript data={reviewSchema} />}
			<UserOverview user={user} />
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/users/[id]">): Promise<Metadata> {
	const params = await props.params;
	const t = await getExtracted();
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

	return {
		title: `${user.name} - RECONNED`,
		description:
			user.bio?.slice(0, 160) ||
			t(
				"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
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
