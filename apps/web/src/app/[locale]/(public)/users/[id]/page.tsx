import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { Person, ProfilePage, WithContext } from "schema-dts";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { UserOverview } from "@/components/overviews/user-overview";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

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

	const personSchema: WithContext<Person> = {
		"@context": "https://schema.org",
		"@type": "Person",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/users/${user.slug || user.id}`,
		name: user.name,
		url: `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/users/${user.slug || user.id}`,
		image: user.image || undefined,
		description: user.bio || undefined,
		address: user.location
			? {
					"@type": "PostalAddress",
					addressLocality: user.location,
				}
			: undefined,
		additionalName: user.callsign || undefined,
		sameAs: user.website ? [user.website] : undefined,
		memberOf: user.clubMembership
			.filter((membership) => membership.club)
			.map((membership) => ({
				"@type": "SportsOrganization",
				"@id": `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/clubs/${membership.club.slug || membership.club.id}`,
				name: membership.club.name,
				sport: "Airsoft",
			})),
		knowsAbout: ["Airsoft", "Military Simulation", "Team Sports"],
		hasOccupation: {
			"@type": "Occupation",
			name: "Airsoft Player",
		},
	};

	const userUrl = `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/users/${user.slug || user.id}`;
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

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8 px-4">
			<JsonLdScript data={personSchema} />
			<JsonLdScript data={profilePageSchema} />
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
