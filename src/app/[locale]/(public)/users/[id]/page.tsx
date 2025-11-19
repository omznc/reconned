import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Person, ProfilePage, WithContext } from "schema-dts";
import NotFoundTemporary from "@/app/[locale]/not-found";
import JsonLdScript from "@/components/json-ld-script";
import { UserOverview } from "@/components/overviews/user-overview";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export default async function Page(props: PageProps<"/[locale]/users/[id]">) {
	const params = await props.params;

	const user = await prisma.user.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			isPrivate: false,
		},
		include: {
			clubMembership: {
				include: {
					club: true,
				},
			},
			eventRegistration: {
				include: {
					event: {
						include: {
							club: {
								select: {
									id: true,
									isPrivate: true,
								},
							},
						},
					},
				},
			},
			badges: {
				include: {
					badge: true,
				},
				orderBy: {
					earnedAt: "desc",
				},
			},
		},
	});

	if (!user) {
		// TODO https://github.com/vercel/next.js/issues/63388
		// notFound();
		return <NotFoundTemporary />;
	}

	// Filter out private events and private clubs
	user.eventRegistration = user.eventRegistration.filter((reg) => !(reg.event.isPrivate || reg.event.club.isPrivate));
	user.clubMembership = user.clubMembership.filter((membership) => !membership.club.isPrivate);

	const personSchema: WithContext<Person> = {
		"@context": "https://schema.org",
		"@type": "Person",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${params.locale}/users/${user.slug ?? user.id}`,
		name: user.name,
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${params.locale}/users/${user.slug ?? user.id}`,
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
		memberOf: user.clubMembership.map((membership) => ({
			"@type": "SportsOrganization",
			"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${params.locale}/clubs/${membership.club.slug ?? membership.club.id}`,
			name: membership.club.name,
			sport: "Airsoft",
		})),
		knowsAbout: ["Airsoft", "Military Simulation", "Team Sports"],
		hasOccupation: {
			"@type": "Occupation",
			name: "Airsoft Player",
		},
	};

	const userUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${params.locale}/users/${user.slug ?? user.id}`;
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
	const [params, t, locale] = await Promise.all([props.params, getTranslations(), getLocale()]);

	const user = await prisma.user.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			isPrivate: false,
		},
	});

	if (!user) {
		return notFound();
	}

	const ogUrl = new URL(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/og/user`);
	ogUrl.searchParams.set("name", user.name);
	if (user.bio) {
		ogUrl.searchParams.set("bio", user.bio);
	}
	if (user.callsign) {
		ogUrl.searchParams.set("callsign", user.callsign);
	}
	if (user.image) {
		ogUrl.searchParams.set("avatar", user.image);
	}

	const canonicalPathname = `/${locale}/users/${user.slug || user.id}`;
	const canonicalUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}${canonicalPathname}`;

	return {
		title: `${user.name} - RECONNED`,
		description: user.bio?.slice(0, 160) ?? t("public.users.metadata.description"),
		alternates: {
			canonical: canonicalUrl,
			languages: generateHreflangAlternatesForSluggableEntity(canonicalPathname, user.id, locale),
		},
		openGraph: {
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: user.name,
				},
			],
		},
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
	};
}
