import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const lastUpdated = new Date("2025-04-13");

export const revalidate = 86_400; // 1 day

export default async function PrivacyPolicyPage() {
	const t = await getTranslations();
	const locale = await getLocale();

	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<h1 className="text-3xl font-bold mb-8">{t("public.title")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6">
					{t("lastUpdated", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.introduction.title")}</h2>
					<p>{t("public.introduction.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.dataCollection.title")}</h2>
					<p>{t("public.dataCollection.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.dataCollection.personalInfo")}</li>
						<li>{t("public.dataCollection.accountInfo")}</li>
						<li>{t("public.dataCollection.clubInfo")}</li>
						<li>{t("public.dataCollection.eventInfo")}</li>
						<li>{t("public.dataCollection.socialInfo")}</li>
						<li>{t("public.dataCollection.usageInfo")}</li>
						<li>{t("public.dataCollection.deviceInfo")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.dataUse.title")}</h2>
					<p>{t("public.dataUse.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.dataUse.provideService")}</li>
						<li>{t("public.dataUse.improveService")}</li>
						<li>{t("public.dataUse.communicate")}</li>
						<li>{t("public.dataUse.security")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.dataSecurity.title")}</h2>
					<p>{t("public.dataSecurity.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.dataSharing.title")}</h2>
					<p>{t("public.dataSharing.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.dataSharing.clubMembers")}</li>
						<li>{t("public.dataSharing.eventParticipants")}</li>
						<li>{t("public.dataSharing.serviceProviders")}</li>
						<li>{t("public.dataSharing.legal")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.cookies.title")}</h2>
					<p>{t("public.cookies.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.userRights.title")}</h2>
					<p>{t("public.userRights.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.userRights.access")}</li>
						<li>{t("public.userRights.rectification")}</li>
						<li>{t("public.userRights.deletion")}</li>
						<li>{t("public.userRights.restriction")}</li>
						<li>{t("public.userRights.objection")}</li>
						<li>{t("public.userRights.portability")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.thirdPartyServices.title")}</h2>
					<p>{t("public.thirdPartyServices.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.thirdPartyServices.auth")}</li>
						<li>{t("public.thirdPartyServices.storage")}</li>
						<li>{t("public.thirdPartyServices.maps")}</li>
						<li>{t("public.thirdPartyServices.analytics")}</li>
						<li>{t("public.thirdPartyServices.instagram")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.childrenPrivacy.title")}</h2>
					<p>{t("public.childrenPrivacy.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.changes.title")}</h2>
					<p>{t("public.changes.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.contact.title")}</h2>
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
						{t("public.viewTerms")}
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
		keywords: t("public.layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
