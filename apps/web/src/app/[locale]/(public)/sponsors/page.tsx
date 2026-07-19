import { ArrowUpRight, MailCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getExtracted, setRequestLocale } from "next-intl/server";
import type { CollectionPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { IMAGE_SIZES } from "@/lib/image-sizes";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const sponsors = [
	{
		name: "VEIS Livno",
		logo: "/veis-logo.svg",
		description: "Prvi livanjski airsoft klub",
		website: "https://instagram.com/veis.livno",
	},
	// {
	// 	name: "Savez Airsoft Klubova Federacije BiH",
	// 	logo: "/logo-savez.png",
	// 	description: "Jedini registrirani airsoft savez/udruga",
	// 	website: "https://www.facebook.com/airsoftsavez/",
	// },
] as {
	name: string;
	logo: string;
	logoDark?: string;
	description: string;
	website: string;
}[];

export const revalidate = 86_400; // 1 day

export default async function SponsorsPage(props: PageProps<"/[locale]/sponsors">) {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	const sponsorPageSchema: WithContext<CollectionPage> = {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/sponsors`,
		name: t("Sponsors - RECONNED"),
		description: t("Our current sponsors and partners. Thank you for your support!"),
		url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/sponsors`,
		mainEntity: {
			"@type": "ItemList",
			name: "Reconned Sponsors",
			description: "Organizations supporting the Reconned airsoft platform",
			itemListElement: sponsors.map((sponsor, index) => ({
				"@type": "ListItem",
				position: index + 1,
				item: {
					"@type": "SportsOrganization",
					name: sponsor.name,
					description: sponsor.description,
					sport: "Airsoft",
					url: sponsor.website,
					logo: `${env.NEXT_PUBLIC_WEB_URL}${sponsor.logo}`,
				},
			})),
		},
	};

	return (
		<>
			<JsonLdScript data={sponsorPageSchema} />
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							{t("Sponsors and partners")}
						</h1>
						<p className="text-xl text-text/80 mb-8">
							{t(
								"It is realistic to say that this site would not exist without the engagement and support of everyone you can find below. Thank you.",
							)}
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-16 max-w-[1200px] px-4 py-16">
				<section>
					<h2 className="text-3xl font-bold mb-8">{t("Our current sponsors")}</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{sponsors.map((sponsor) => (
							<Link target="_blank" key={sponsor.name} href={sponsor.website} className="h-full group">
								<Card className="relative h-full flex flex-col justify-between group-hover:border-red-500 border transition-all">
									<ArrowUpRight className="absolute top-4 right-4 w-6 h-6 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
									<CardHeader className="flex flex-col items-center">
										<Image
											src={sponsor.logo || "/placeholder.svg"}
											alt={sponsor.name}
											data-has-dark={!!sponsor.logoDark}
											width={IMAGE_SIZES.THUMBNAIL}
											height={IMAGE_SIZES.THUMBNAIL}
											className="mb-4 size-[200px] object-contain block dark:data-[has-dark=true]:hidden"
										/>
										{sponsor.logoDark && (
											<Image
												src={sponsor.logoDark}
												alt={sponsor.name}
												width={IMAGE_SIZES.THUMBNAIL}
												height={IMAGE_SIZES.THUMBNAIL}
												className="mb-4 size-[200px] object-contain hidden dark:block"
											/>
										)}
									</CardHeader>
									<CardContent className="flex flex-col gap-1">
										<CardTitle>{sponsor.name}</CardTitle>
										<p className="opacity-80">{sponsor.description}</p>
									</CardContent>
								</Card>
							</Link>
						))}
						<Link target="_blank" href={"mailto:mail@reconned.com"} className="h-full group">
							<Card className="relative h-full flex flex-col justify-between group-hover:border-red-500 border transition-all">
								<MailCheckIcon className="absolute top-4 right-4 w-6 h-6 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
								<CardHeader className="flex flex-col items-center">
									<Image
										src={"/reconned-logo-light.svg"}
										alt={"Vi"}
										data-has-dark={true}
										width={IMAGE_SIZES.THUMBNAIL}
										height={IMAGE_SIZES.THUMBNAIL}
										className="mb-4 size-[200px] object-contain block dark:data-[has-dark=true]:hidden"
									/>
									<Image
										src={"/reconned-logo-dark.svg"}
										alt={"Vi"}
										width={IMAGE_SIZES.THUMBNAIL}
										height={IMAGE_SIZES.THUMBNAIL}
										className="mb-4 size-[200px] object-contain hidden dark:block"
									/>
								</CardHeader>
								<CardContent className="flex flex-col gap-1">
									<CardTitle>{t("You")}</CardTitle>
									<p className="opacity-80">{t("This place can be yours")}</p>
								</CardContent>
							</Card>
						</Link>
					</div>
				</section>

				<section>
					<h2 className="text-3xl font-bold mb-4">{t("Contact Us")}</h2>
					<p className="text-lg">
						{t("Want to help or have questions? ")}{" "}
						<Link
							href="mailto:mail@reconned.com"
							className="text-red-600 underline hover:text-red-400 transition-colors"
						>
							mail@reconned.com
						</Link>
						.
					</p>
				</section>
			</div>
		</>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/sponsors">): Promise<Metadata> {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	return {
		title: t("Our Sponsors & Partners - Support RECONNED Airsoft Platform"),
		description: t(
			"Meet the amazing sponsors and partners who make RECONNED possible. Support the airsoft community in Bosnia and Herzegovina by becoming a sponsor today.",
		),
		keywords: t(
			"airsoft sponsors, airsoft partners, support airsoft, airsoft donations, airsoft funding, airsoft community sponsors, airsoft BiH sponsors",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Our Sponsors & Partners - Support RECONNED Airsoft Platform"),
			description: t(
				"Meet the amazing sponsors and partners who make RECONNED possible. Support the airsoft community in Bosnia and Herzegovina by becoming a sponsor today.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/sponsors", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Our Sponsors & Partners - Support RECONNED Airsoft Platform"),
			description: t(
				"Meet the amazing sponsors and partners who make RECONNED possible. Support the airsoft community in Bosnia and Herzegovina by becoming a sponsor today.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/sponsors", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/sponsors", locale),
		},
	};
}
