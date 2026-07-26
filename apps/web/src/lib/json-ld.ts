import type {
	AggregateRating,
	BreadcrumbList,
	FAQPage,
	ItemList,
	ItemPage,
	Person,
	PostalAddress,
	Rating,
	Review,
	SportsEvent,
	SportsOrganization,
	WebPage,
	WithContext,
} from "schema-dts";
import { env } from "./env";

// Validate environment variables for schema generation
if (!env.NEXT_PUBLIC_WEB_URL) {
	console.warn("NEXT_PUBLIC_WEB_URL is not set - schemas may have invalid URLs");
}

export function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
	return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined)) as T;
}

/**
 * Freshness signal for an entity detail page.
 *
 * `dateModified` is a `CreativeWork` property, so it cannot hang off the
 * `SportsOrganization` / `SportsEvent` node describing the entity itself — those are
 * an Organization and an Event. It belongs on the *page*, which is what consumers
 * read for recency anyway. `mainEntity` points back at the entity node by `@id`
 * rather than repeating it, so the two nodes stay linked without duplication.
 */
export function createWebPageSchema({
	pageUrl,
	name,
	dateModified,
	datePublished,
}: {
	pageUrl: string;
	name: string;
	dateModified?: string | null;
	datePublished?: string | null;
}): WithContext<WebPage> {
	return removeUndefined({
		"@context": "https://schema.org" as const,
		"@type": "WebPage" as const,
		"@id": `${pageUrl}#webpage`,
		url: pageUrl,
		name,
		...(dateModified && { dateModified: new Date(dateModified).toISOString() }),
		...(datePublished && { datePublished: new Date(datePublished).toISOString() }),
		mainEntity: { "@id": pageUrl },
	}) satisfies WithContext<WebPage>;
}

export interface BreadcrumbItem {
	name: string;
	url: string;
}

export function createBreadcrumbList(items: BreadcrumbItem[]): WithContext<BreadcrumbList> {
	return removeUndefined({
		"@context": "https://schema.org" as const,
		"@type": "BreadcrumbList" as const,
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem" as const,
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	}) satisfies WithContext<BreadcrumbList>;
}

export function createSportsOrganizationReference({
	clubId,
	clubSlug,
	clubName,
	locale,
	logo,
	url,
}: {
	clubId: string;
	clubSlug: string | null;
	clubName: string;
	locale: string;
	logo?: string | null;
	url?: string;
}): SportsOrganization {
	return removeUndefined({
		"@type": "SportsOrganization" as const,
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${clubSlug || clubId}`,
		name: clubName,
		sport: "Airsoft",
		...(url && { url }),
		...(logo && { logo }),
	}) satisfies SportsOrganization;
}

export function createPostalAddress({ location, country }: { location: string; country?: string }): PostalAddress {
	return removeUndefined({
		"@type": "PostalAddress" as const,
		addressLocality: location,
		...(country && { addressCountry: country }),
	}) satisfies PostalAddress;
}

export function createGeoCoordinates({ latitude, longitude }: { latitude: number; longitude: number }) {
	return {
		"@type": "GeoCoordinates" as const,
		latitude,
		longitude,
	};
}

export function createAggregateRating({
	ratingValue,
	ratingCount,
	bestRating = 5,
	worstRating = 1,
}: {
	ratingValue: number;
	ratingCount: number;
	bestRating?: number;
	worstRating?: number;
}): AggregateRating {
	return {
		"@type": "AggregateRating" as const,
		ratingValue,
		ratingCount,
		bestRating,
		worstRating,
	};
}

export interface FAQItem {
	question: string;
	answer: string;
}

export function createFAQPage({
	faqs,
	name,
	description,
}: {
	faqs: FAQItem[];
	name: string;
	description?: string;
}): WithContext<FAQPage> {
	type FAQQuestion = {
		"@type": "Question";
		name: string;
		acceptedAnswer: {
			"@type": "Answer";
			text: string;
		};
	};

	const mainEntity: FAQQuestion[] = faqs.map((faq) => ({
		"@type": "Question",
		name: faq.question,
		acceptedAnswer: {
			"@type": "Answer",
			text: faq.answer,
		},
	}));

	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		...(description && { description }),
		...(name && { name }),
		mainEntity,
	};
}

export interface ReviewData {
	author: string;
	rating: number;
	content: string;
	datePublished: string;
}

export function createReviewSchema({
	reviews,
	itemReviewed,
	itemReviewedType,
}: {
	reviews: ReviewData[];
	itemReviewed: string;
	itemReviewedType: "SportsOrganization" | "SportsEvent" | "Person";
}): WithContext<ItemPage> {
	const averageRating =
		reviews.length > 0 ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length : 0;

	const aggregateRating =
		reviews.length > 0
			? ({
					"@type": "AggregateRating",
					ratingValue: averageRating,
					ratingCount: reviews.length,
					bestRating: 5,
					worstRating: 1,
				} satisfies AggregateRating)
			: undefined;

	const reviewArray = reviews.map(
		(review): Review => ({
			"@type": "Review",
			author: {
				"@type": "Person",
				name: review.author,
			} satisfies Person,
			reviewRating: {
				"@type": "Rating",
				ratingValue: review.rating,
				bestRating: 5,
				worstRating: 1,
			} satisfies Rating,
			reviewBody: review.content,
			datePublished: review.datePublished,
		}),
	);

	let mainEntity: SportsOrganization | SportsEvent | Person;

	if (itemReviewedType === "SportsOrganization") {
		mainEntity = {
			"@type": "SportsOrganization",
			name: itemReviewed,
			...(aggregateRating && { aggregateRating }),
			...(reviewArray.length > 0 && { review: reviewArray }),
		} satisfies SportsOrganization;
	} else if (itemReviewedType === "SportsEvent") {
		mainEntity = {
			"@type": "SportsEvent",
			name: itemReviewed,
			...(aggregateRating && { aggregateRating }),
			...(reviewArray.length > 0 && { review: reviewArray }),
		} satisfies SportsEvent;
	} else {
		mainEntity = {
			"@type": "Person",
			name: itemReviewed,
			...(aggregateRating && { aggregateRating }),
			...(reviewArray.length > 0 && { review: reviewArray }),
		} satisfies Person;
	}

	return {
		"@context": "https://schema.org",
		"@type": "ItemPage",
		mainEntity,
	};
}

export interface EventItemListData {
	id: string;
	slug: string | null;
	name: string;
	description: string | null;
	image: string | null;
	dateStart: string;
	dateEnd: string | null;
	location: string;
	clubId?: string;
	clubSlug?: string | null;
	clubName?: string;
	clubLogo?: string | null;
}

export function createItemListWithEvents({
	events,
	page,
	itemsPerPage,
	total,
	locale,
	name,
	description,
}: {
	events: EventItemListData[];
	page: number;
	itemsPerPage: number;
	total: number;
	locale: string;
	name: string;
	description: string;
}): WithContext<ItemList> {
	return removeUndefined({
		"@context": "https://schema.org" as const,
		"@type": "ItemList" as const,
		name,
		description,
		numberOfItems: total,
		itemListElement: events.map((event, index) => {
			const position = index + 1 + (page - 1) * itemsPerPage;
			const eventUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug || event.id}`;
			const item = removeUndefined({
				"@type": "SportsEvent" as const,
				"@id": eventUrl,
				name: event.name,
				...(event.description && { description: event.description }),
				sport: "Airsoft",
				startDate: event.dateStart,
				...(event.dateEnd && { endDate: event.dateEnd }),
				url: eventUrl,
				...(event.image && { image: event.image }),
				location: {
					"@type": "Place" as const,
					name: event.location,
					address: event.location,
				},
				eventStatus: "https://schema.org/EventScheduled" as const,
				...(event.clubId &&
					event.clubName && {
						organizer: createSportsOrganizationReference({
							clubId: event.clubId,
							clubSlug: event.clubSlug || null,
							clubName: event.clubName,
							locale,
							logo: event.clubLogo || null,
							url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${event.clubSlug || event.clubId}`,
						}),
						performer: createSportsOrganizationReference({
							clubId: event.clubId,
							clubSlug: event.clubSlug || null,
							clubName: event.clubName,
							locale,
						}),
					}),
			}) satisfies SportsEvent;

			return {
				"@type": "ListItem" as const,
				position,
				item,
			};
		}),
	}) satisfies WithContext<ItemList>;
}

export interface ClubItemListData {
	id: string;
	slug: string | null;
	name: string;
	description: string | null;
	logo: string | null;
	location: string | null;
	latitude?: number | null;
	longitude?: number | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	dateFounded?: string | null;
	verified: boolean;
}

export function createItemListWithClubs({
	clubs,
	page,
	itemsPerPage,
	total,
	locale,
	name,
	description,
}: {
	clubs: ClubItemListData[];
	page: number;
	itemsPerPage: number;
	total: number;
	locale: string;
	name: string;
	description: string;
}): WithContext<ItemList> {
	return removeUndefined({
		"@context": "https://schema.org" as const,
		"@type": "ItemList" as const,
		name,
		description,
		numberOfItems: total,
		itemListElement: clubs.map((club, index) => {
			const position = index + 1 + (page - 1) * itemsPerPage;
			const clubUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${club.slug || club.id}`;
			const item = removeUndefined({
				"@type": "SportsOrganization" as const,
				"@id": clubUrl,
				name: club.name,
				...(club.description && { description: club.description }),
				sport: "Airsoft",
				url: clubUrl,
				...(club.logo && { logo: club.logo }),
				...(club.location && {
					address: createPostalAddress({
						location: club.location,
						country: "BA",
					}),
				}),
				...(club.latitude &&
					club.longitude && {
						geo: createGeoCoordinates({
							latitude: club.latitude,
							longitude: club.longitude,
						}),
					}),
				...(club.contactEmail || club.contactPhone
					? {
							contactPoint: removeUndefined({
								"@type": "ContactPoint" as const,
								...(club.contactEmail && { email: club.contactEmail }),
								...(club.contactPhone && { telephone: club.contactPhone }),
								contactType: "customer service",
							}),
						}
					: {}),
				...(club.dateFounded && { foundingDate: club.dateFounded }),
				...(club.verified && {
					memberOf: {
						"@type": "Organization" as const,
						name: "Verified Airsoft Clubs",
					},
				}),
			}) satisfies SportsOrganization;

			return {
				"@type": "ListItem" as const,
				position,
				item,
			};
		}),
	}) satisfies WithContext<ItemList>;
}

export interface UserItemListData {
	id: string;
	slug: string | null;
	name: string;
	image: string | null;
	callsign: string | null;
	location: string | null;
	clubMembership?: Array<{
		clubId: string;
		clubSlug: string | null;
		clubName: string;
	}>;
}

export function createItemListWithUsers({
	users,
	page,
	itemsPerPage,
	total,
	locale,
	name,
	description,
}: {
	users: UserItemListData[];
	page: number;
	itemsPerPage: number;
	total: number;
	locale: string;
	name: string;
	description: string;
}): WithContext<ItemList> {
	return removeUndefined({
		"@context": "https://schema.org" as const,
		"@type": "ItemList" as const,
		name,
		description,
		numberOfItems: total,
		itemListElement: users.map((user, index) => {
			const position = index + 1 + (page - 1) * itemsPerPage;
			const userUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/users/${user.slug || user.id}`;
			const item = removeUndefined({
				"@type": "Person" as const,
				"@id": userUrl,
				name: user.name,
				url: userUrl,
				...(user.image && { image: user.image }),
				...(user.location && {
					address: createPostalAddress({
						location: user.location,
					}),
				}),
				...(user.callsign && { additionalName: user.callsign }),
				knowsAbout: ["Airsoft", "Military Simulation", "Team Sports"],
				hasOccupation: {
					"@type": "Occupation" as const,
					name: "Airsoft Player",
				},
				...(user.clubMembership && user.clubMembership.length > 0
					? {
							memberOf: user.clubMembership.map((membership) =>
								createSportsOrganizationReference({
									clubId: membership.clubId,
									clubSlug: membership.clubSlug,
									clubName: membership.clubName,
									locale,
								}),
							),
						}
					: {}),
			}) satisfies Person;

			return {
				"@type": "ListItem" as const,
				position,
				item,
			};
		}),
	}) satisfies WithContext<ItemList>;
}
