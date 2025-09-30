import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { SportsOrganization, WithContext } from "schema-dts";
import NotFoundTemporary from "@/app/[locale]/not-found";
import JsonLdScript from "@/components/json-ld-script";
import { ClubOverview } from "@/components/overviews/club-overview";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

interface PageProps {
	params: Promise<{
		id: string;
		locale: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	const userMembership = user
		? await prisma.clubMembership.findFirst({
				where: {
					userId: user?.id,
					club: {
						OR: [{ id: params.id }, { slug: params.id }],
					},
				},
			})
		: null;

	const isMemberOfClub = !!userMembership;

	const club = await prisma.club.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			isPrivate: false,
		},
		include: {
			_count: {
				select: {
					members: true,
				},
			},
			posts: {
				orderBy: {
					createdAt: "desc",
				},
				...(isMemberOfClub ? {} : { where: { isPublic: true } }),
			},
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							callsign: true,
							slug: true,
							image: true,
							role: true,
						},
					},
				},
			},
		},
	});

	if (!club) {
		// TODO https://github.com/vercel/next.js/issues/63388
		// notFound();
		return <NotFoundTemporary />;
	}

	const sportsOrganizationSchema: WithContext<SportsOrganization> = {
		"@context": "https://schema.org",
		"@type": "SportsOrganization",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs/${club.slug ?? club.id}`,
		name: club.name,
		numberOfEmployees: {
			"@type": "QuantitativeValue",
			value: club._count.members,
		},
		description: club.description || undefined,
		sport: "Airsoft",
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs/${club.slug ?? club.id}`,
		logo: club.logo || undefined,
		foundingDate: club.dateFounded?.toISOString() || undefined,
		address: club.location
			? {
					"@type": "PostalAddress",
					addressLocality: club.location,
					addressCountry: "BA",
				}
			: undefined,
		...(club.latitude && club.longitude
			? {
					geo: {
						"@type": "GeoCoordinates",
						latitude: club.latitude,
						longitude: club.longitude,
					},
				}
			: {}),
		contactPoint:
			club.contactEmail || club.contactPhone
				? {
						"@type": "ContactPoint",
						email: club.contactEmail || undefined,
						telephone: club.contactPhone || undefined,
						contactType: "customer service",
					}
				: undefined,
		sameAs: club.website ? [club.website] : undefined,
		member: club.members.map((member) => ({
			"@type": "Person",
			name: member.user.name,
			url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/users/${member.user.slug ?? member.user.id}`,
			image: member.user.image || undefined,
			additionalName: member.user.callsign || undefined,
		})),
		aggregateRating: club.verified
			? {
					"@type": "AggregateRating",
					ratingValue: "5",
					ratingCount: "1",
					bestRating: "5",
					worstRating: "1",
				}
			: undefined,
	};

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] pb-8 px-4">
			<JsonLdScript data={sportsOrganizationSchema} />
			<ClubOverview
				club={club}
				isManager={user?.managedClubs.includes(club.id)}
				isMember={isMemberOfClub}
				currentUserMembership={userMembership}
			/>
		</div>
	);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const params = await props.params;
	const t = await getTranslations();

	const club = await prisma.club.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			isPrivate: false,
		},
	});

	if (!club) {
		notFound();
	}

	const ogUrl = new URL(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/og/club`);
	ogUrl.searchParams.set("name", club.name);
	if (club.description) {
		ogUrl.searchParams.set("description", club.description);
	}
	if (club.logo) {
		ogUrl.searchParams.set("logo", club.logo);
	}

	const canonicalUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs/${club.slug || club.id}`;

	return {
		title: `${club.name} - RECONNED`,
		description: club.description?.slice(0, 160) ?? t("public.clubs.metadata.description"),
		alternates: {
			canonical: canonicalUrl,
		},
		openGraph: {
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: club.name,
				},
			],
		},
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
	};
}
