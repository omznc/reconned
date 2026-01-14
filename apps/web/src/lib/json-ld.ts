import type {
	AggregateRating,
	BreadcrumbList,
	ItemList,
	Person,
	PostalAddress,
	SportsEvent,
	SportsOrganization,
	WithContext,
} from "schema-dts";
import { env } from "./env";

export function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
	return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined)) as T;
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
		ratingValue: String(ratingValue),
		ratingCount,
		bestRating: String(bestRating),
		worstRating: String(worstRating),
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
