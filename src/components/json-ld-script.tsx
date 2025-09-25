import type { JSX } from "react";
import type {
	AboutPage,
	AggregateRating,
	Article,
	BreadcrumbList,
	CollectionPage,
	ContactPage,
	Event,
	GeoCoordinates,
	Graph,
	ImageObject,
	ItemList,
	ListItem,
	LocalBusiness,
	Organization,
	Person,
	Place,
	PostalAddress,
	ProfilePage,
	Review,
	SearchAction,
	SportsEvent,
	SportsOrganization,
	SportsTeam,
	WebSite,
	WithContext,
} from "schema-dts";

type JsonLdScriptProps = {
	data:
		| Graph
		| WithContext<Organization>
		| WithContext<SportsOrganization>
		| WithContext<LocalBusiness>
		| WithContext<CollectionPage>
		| WithContext<AboutPage>
		| WithContext<ContactPage>
		| WithContext<BreadcrumbList>
		| WithContext<Person>
		| WithContext<Event>
		| WithContext<SportsEvent>
		| WithContext<SportsTeam>
		| WithContext<Place>
		| WithContext<Review>
		| WithContext<AggregateRating>
		| WithContext<PostalAddress>
		| WithContext<GeoCoordinates>
		| WithContext<ImageObject>
		| WithContext<WebSite>
		| WithContext<SearchAction>
		| WithContext<ItemList>
		| WithContext<ListItem>
		| WithContext<Article>
		| WithContext<ProfilePage>;
};

export default function JsonLdScript({ data }: JsonLdScriptProps): JSX.Element {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: Scripts to these are being passed in from the server
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
