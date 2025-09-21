import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const lastUpdated = new Date("2025-04-13");

export const revalidate = 86_400; // 1 day

export default async function TermsOfUsePage() {
	const t = await getTranslations();
	const locale = await getLocale();

	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<h1 className="text-3xl font-bold mb-8">{t("public.title")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6" suppressHydrationWarning>
					{t("lastUpdated", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.introduction.title")}</h2>
					<p>{t("public.introduction.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.acceptance.title")}</h2>
					<p>{t("public.acceptance.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.eligibility.title")}</h2>
					<p>{t("public.eligibility.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.userAccounts.title")}</h2>
					<p>{t("public.userAccounts.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.userAccounts.accuracy")}</li>
						<li>{t("public.userAccounts.security")}</li>
						<li>{t("public.userAccounts.responsibility")}</li>
						<li>{t("public.userAccounts.termination")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.content.title")}</h2>
					<p>{t("public.content.description")}</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("public.content.userContent.title")}</h3>
					<p>{t("public.content.userContent.description")}</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("public.content.prohibited.title")}</h3>
					<p>{t("public.content.prohibited.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.content.prohibited.illegal")}</li>
						<li>{t("public.content.prohibited.harmful")}</li>
						<li>{t("public.content.prohibited.impersonation")}</li>
						<li>{t("public.content.prohibited.spam")}</li>
						<li>{t("public.content.prohibited.infringement")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.intellectualProperty.title")}</h2>
					<p>{t("public.intellectualProperty.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.intellectualProperty.ownership")}</li>
						<li>{t("public.intellectualProperty.license")}</li>
						<li>{t("public.intellectualProperty.feedback")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.thirdParty.title")}</h2>
					<p>{t("public.thirdParty.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.disclaimer.title")}</h2>
					<p>{t("public.disclaimer.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.limitation.title")}</h2>
					<p>{t("public.limitation.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.changes.title")}</h2>
					<p>{t("public.changes.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.termination.title")}</h2>
					<p>{t("public.termination.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.governing.title")}</h2>
					<p>{t("public.governing.description")}</p>
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
					<Link href="/privacy-policy" className="text-primary hover:underline">
						{t("public.viewPrivacy")}
					</Link>
				</div>
			</div>
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations();

	return {
		title: t("public.terms.metadata.title"),
		description: t("public.terms.metadata.description"),
		keywords: t("public.layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
