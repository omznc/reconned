import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AboutPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Logo } from "@/components/logos/logo";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";

export default async function Home() {
	const t = await getTranslations();

	const aboutPageSchema: WithContext<AboutPage> = {
		"@context": "https://schema.org",
		"@type": "AboutPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/about`,
		name: t("public.about.metadata.title"),
		description: t("public.about.metadata.description"),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/about`,
		mainEntity: {
			"@type": "SportsOrganization",
			name: "Reconned",
			sport: "Airsoft",
			description: t("public.about.metadata.description"),
			url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
			logo: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-light.svg`,
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
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							{t("public.about.title")}
						</h1>
						<p className="text-xl text-text/80 mb-8">
							{t.rich("subtitle", {
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
							})}
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-16">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t("public.about.platform.title")}</h2>
					<p className="text-lg inline">
						{t.rich("public.about.platform.description", {
							logo: () => <Logo className="h-4 w-auto mb-0.5" />,
						})}
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t("public.about.sustainability.title")}</h2>
					<p className="text-lg">
						{t("public.about.sustainability.description")}{" "}
						<span className="font-bold">{t("public.about.sustainability.emphasis")}</span>
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t("public.about.help.title")}</h2>
					<p className="text-lg">
						{t("public.about.help.description")}{" "}
						<Link className="text-red-600" href="/sponsors">
							{t("public.about.help.sponsors")}
						</Link>
					</p>
				</div>
			</div>
		</>
	);
}

export const revalidate = 86_400; // 1 day

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations();

	return {
		title: t("public.about.metadata.title"),
		description: t("public.about.metadata.description"),
		keywords: t("public.layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
