import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { AboutPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Logo } from "@/components/logos/logo";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export default async function Home() {
	const t = await getExtracted();
	const locale = await getLocale();

	const aboutPageSchema: WithContext<AboutPage> = {
		"@context": "https://schema.org",
		"@type": "AboutPage",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/about`,
		name: t("About us - RECONNED"),
		description: t(
			"About us, our platform, and how you can help. The first universal platform for airsoft clubs, events, and players.",
		),
		url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/about`,
		mainEntity: {
			"@type": "SportsOrganization",
			name: "Reconned",
			sport: "Airsoft",
			description: t(
				"About us, our platform, and how you can help. The first universal platform for airsoft clubs, events, and players.",
			),
			url: env.NEXT_PUBLIC_WEB_URL,
			logo: `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-light.svg`,
			foundingDate: "2024",
			founder: [
				{
					"@type": "Person",
					name: "Omar Zunić",
					url: "https://omarzunic.com",
				},
				{
					"@type": "Person",
					name: "Safet Pojskić",
					url: "https://safetpojskic.com",
				},
			],
			address: {
				"@type": "PostalAddress",
				addressCountry: "BA",
			},
			sameAs: ["https://github.com/omznc/reconned"],
		},
	};

	return (
		<>
			<JsonLdScript data={aboutPageSchema} />
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">{t("Who are we?")}</h1>
						<p className="text-xl text-text/80 mb-8">
							{t.rich(
								"This project was started by 2 developers from Bosnia and Herzegovina (<omar></omar> and <safet></safet>) because we wanted something better than Facebook, Viber, and others. Airsoft communities are quite new and unorganized, and we want to change that - totally transparent, totally public.",
								{
									omar: () => (
										<Link
											className="text-red-500 hover:text-red-400 transition-colors"
											href="https://omarzunic.com?utm_source=reconned&utm_medium=about-page"
										>
											Omar Zunić
										</Link>
									),
									safet: () => (
										<Link
											className="text-red-500 hover:text-red-400 transition-colors"
											href="https://safetpojskic.com?utm_source=reconned&utm_medium=about-page"
										>
											Safet Pojskić
										</Link>
									),
								},
							)}
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-16">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t("About the platform")}</h2>
					<p className="text-lg inline">
						{t.rich(
							"The ultimate goal of the <logo></logo> platform is the unification of the airsoft community, initially in Bosnia and Herzegovina, and beyond. Our platform allows clubs to present themselves, organize events, and find new members. It enables players to find clubs, events, and other players, all in one place.",
							{
								logo: () => <Logo className="h-4 w-auto mb-0.5" />,
							},
						)}
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t("Sustainability")}</h2>
					<p className="text-lg">
						{t(
							"The goal is not, and never will be pure profit. Every part of the platform is open-source, and thus available to everyone. Currently, we are completely self-funding the platform's development, but we will give clubs and individuals a chance to help with development and maintenance, with some benefits.",
						)}{" "}
						<span className="font-bold">{t("Core functionalities will always be free to use.")}</span>
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t("How to help?")}</h2>
					<p className="text-lg">
						{t(
							"If you are interested in helping with the development of the platform, please feel free to contact us. Help in the form of marketing, programming, and general sponsorship is always welcome.",
						)}{" "}
						<Link className="text-red-600" href="/sponsors">
							{t("See the list of sponsors.")}
						</Link>
					</p>
				</div>
			</div>
		</>
	);
}

export const revalidate = 86_400; // 1 day

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("About us - RECONNED"),
		description: t(
			"About us, our platform, and how you can help. The first universal platform for airsoft clubs, events, and players.",
		),
		keywords: t(
			"airsoft Bosnia, airsoft BiH, airsoft weapons, airsoft replicas, airsoft equipment, airsoft clubs BiH, airsoft shop BiH, airsoft store, airsoft rifles, airsoft pistols, airsoft bullets, airsoft BBs, airsoft mask, airsoft clothing, airsoft uniforms, airsoft BiH forum, airsoft events BiH, airsoft rules, airsoft tactics, airsoft players BiH, best airsoft BiH, buying airsoft BiH, selling airsoft BiH, airsoft teams BiH, airsoft locations BiH, airsoft field BiH",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("About us - RECONNED"),
			description: t(
				"About us, our platform, and how you can help. The first universal platform for airsoft clubs, events, and players.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/about", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("About us - RECONNED"),
			description: t(
				"About us, our platform, and how you can help. The first universal platform for airsoft clubs, events, and players.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/about", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/about", locale),
		},
	};
}
