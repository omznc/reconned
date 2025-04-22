import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

const lastUpdated = new Date("2025-04-13");

export default async function PrivacyPolicyPage() {
	const t = await getTranslations("public.terms");
	const locale = await getLocale();

	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<h1 className="text-3xl font-bold mb-8">{t("title")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6">
					{t("lastUpdated", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("introduction.title")}</h2>
					<p>{t("introduction.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("dataCollection.title")}</h2>
					<p>{t("dataCollection.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("dataCollection.personalInfo")}</li>
						<li>{t("dataCollection.accountInfo")}</li>
						<li>{t("dataCollection.clubInfo")}</li>
						<li>{t("dataCollection.eventInfo")}</li>
						<li>{t("dataCollection.socialInfo")}</li>
						<li>{t("dataCollection.usageInfo")}</li>
						<li>{t("dataCollection.deviceInfo")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("dataUse.title")}</h2>
					<p>{t("dataUse.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("dataUse.provideService")}</li>
						<li>{t("dataUse.improveService")}</li>
						<li>{t("dataUse.communicate")}</li>
						<li>{t("dataUse.security")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("dataSecurity.title")}</h2>
					<p>{t("dataSecurity.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("dataSharing.title")}</h2>
					<p>{t("dataSharing.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("dataSharing.clubMembers")}</li>
						<li>{t("dataSharing.eventParticipants")}</li>
						<li>{t("dataSharing.serviceProviders")}</li>
						<li>{t("dataSharing.legal")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("cookies.title")}</h2>
					<p>{t("cookies.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("userRights.title")}</h2>
					<p>{t("userRights.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("userRights.access")}</li>
						<li>{t("userRights.rectification")}</li>
						<li>{t("userRights.deletion")}</li>
						<li>{t("userRights.restriction")}</li>
						<li>{t("userRights.objection")}</li>
						<li>{t("userRights.portability")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("thirdPartyServices.title")}</h2>
					<p>{t("thirdPartyServices.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("thirdPartyServices.auth")}</li>
						<li>{t("thirdPartyServices.storage")}</li>
						<li>{t("thirdPartyServices.maps")}</li>
						<li>{t("thirdPartyServices.analytics")}</li>
						<li>{t("thirdPartyServices.instagram")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("childrenPrivacy.title")}</h2>
					<p>{t("childrenPrivacy.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("changes.title")}</h2>
					<p>{t("changes.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("contact.title")}</h2>
					<p>
						{t.rich("contact.description", {
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
						{t("viewTerms")}
					</Link>
				</div>
			</div>
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("public");

	return {
		title: t("privacy.metadata.title"),
		description: t("privacy.metadata.description"),
		keywords: t("layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
