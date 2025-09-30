import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { WebPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";

const lastUpdated = new Date("2025-04-13");

export const revalidate = 86_400; // 1 day

export default async function PrivacyPolicyPage() {
	const t = await getTranslations();
	const locale = await getLocale();

	const privacyPageSchema: WithContext<WebPage> = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/privacy-policy`,
		name: t("public.privacy.metadata.title"),
		description: t("public.privacy.metadata.description"),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/privacy-policy`,
		dateModified: lastUpdated.toISOString(),
		datePublished: lastUpdated.toISOString(),
		publisher: {
			"@type": "Organization",
			name: "Reconned",
			url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
			logo: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-light.svg`,
		},
		about: {
			"@type": "Thing",
			name: "Privacy Policy",
			description: "Data privacy and protection policies",
		},
	};

	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<JsonLdScript data={privacyPageSchema} />
			<h1 className="text-3xl font-bold mb-8">{t("public.privacy.title")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6">
					{t("public.privacy.lastUpdated", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.introduction.title")}</h2>
					<p>{t("public.privacy.introduction.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.dataCollection.title")}</h2>
					<p>{t("public.privacy.dataCollection.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.privacy.dataCollection.personalInfo")}</li>
						<li>{t("public.privacy.dataCollection.accountInfo")}</li>
						<li>{t("public.privacy.dataCollection.clubInfo")}</li>
						<li>{t("public.privacy.dataCollection.eventInfo")}</li>
						<li>{t("public.privacy.dataCollection.socialInfo")}</li>
						<li>{t("public.privacy.dataCollection.usageInfo")}</li>
						<li>{t("public.privacy.dataCollection.deviceInfo")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.dataUse.title")}</h2>
					<p>{t("public.privacy.dataUse.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.privacy.dataUse.provideService")}</li>
						<li>{t("public.privacy.dataUse.improveService")}</li>
						<li>{t("public.privacy.dataUse.communicate")}</li>
						<li>{t("public.privacy.dataUse.security")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.dataSecurity.title")}</h2>
					<p>{t("public.privacy.dataSecurity.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.dataSharing.title")}</h2>
					<p>{t("public.privacy.dataSharing.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.privacy.dataSharing.clubMembers")}</li>
						<li>{t("public.privacy.dataSharing.eventParticipants")}</li>
						<li>{t("public.privacy.dataSharing.serviceProviders")}</li>
						<li>{t("public.privacy.dataSharing.legal")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.cookies.title")}</h2>
					<p>{t("public.privacy.cookies.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.userRights.title")}</h2>
					<p>{t("public.privacy.userRights.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.privacy.userRights.access")}</li>
						<li>{t("public.privacy.userRights.rectification")}</li>
						<li>{t("public.privacy.userRights.deletion")}</li>
						<li>{t("public.privacy.userRights.restriction")}</li>
						<li>{t("public.privacy.userRights.objection")}</li>
						<li>{t("public.privacy.userRights.portability")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.thirdPartyServices.title")}</h2>
					<p>{t("public.privacy.thirdPartyServices.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.privacy.thirdPartyServices.auth")}</li>
						<li>{t("public.privacy.thirdPartyServices.storage")}</li>
						<li>{t("public.privacy.thirdPartyServices.maps")}</li>
						<li>{t("public.privacy.thirdPartyServices.analytics")}</li>
						<li>{t("public.privacy.thirdPartyServices.instagram")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.childrenPrivacy.title")}</h2>
					<p>{t("public.privacy.childrenPrivacy.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.changes.title")}</h2>
					<p>{t("public.privacy.changes.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.privacy.contact.title")}</h2>
					<p>
						{t.rich("public.privacy.contact.description", {
							email: () => (
								<a href="mailto:mail@reconned.com" className="text-primary hover:underline">
									mail@reconned.com
								</a>
							),
						})}
					</p>
				</section>

				<div className="mt-12 border-t pt-6">
					<Link href="/terms-of-use" className="text-primary hover:underline">
						{t("public.privacy.viewTerms")}
					</Link>
				</div>
			</div>
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations();

	return {
		title: t("public.privacy.metadata.title"),
		description: t("public.privacy.metadata.description"),
	};
}
