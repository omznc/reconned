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
			<h1 className="text-3xl font-bold mb-8">{t("public.terms.title")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6" suppressHydrationWarning>
					{t("public.terms.lastUpdated", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.introduction.title")}</h2>
					<p>{t("public.terms.introduction.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.acceptance.title")}</h2>
					<p>{t("public.terms.acceptance.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.eligibility.title")}</h2>
					<p>{t("public.terms.eligibility.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.userAccounts.title")}</h2>
					<p>{t("public.terms.userAccounts.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.terms.userAccounts.accuracy")}</li>
						<li>{t("public.terms.userAccounts.security")}</li>
						<li>{t("public.terms.userAccounts.responsibility")}</li>
						<li>{t("public.terms.userAccounts.termination")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.content.title")}</h2>
					<p>{t("public.terms.content.description")}</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("public.terms.content.userContent.title")}</h3>
					<p>{t("public.terms.content.userContent.description")}</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("public.terms.content.prohibited.title")}</h3>
					<p>{t("public.terms.content.prohibited.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.terms.content.prohibited.illegal")}</li>
						<li>{t("public.terms.content.prohibited.harmful")}</li>
						<li>{t("public.terms.content.prohibited.impersonation")}</li>
						<li>{t("public.terms.content.prohibited.spam")}</li>
						<li>{t("public.terms.content.prohibited.infringement")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.intellectualProperty.title")}</h2>
					<p>{t("public.terms.intellectualProperty.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("public.terms.intellectualProperty.ownership")}</li>
						<li>{t("public.terms.intellectualProperty.license")}</li>
						<li>{t("public.terms.intellectualProperty.feedback")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.thirdParty.title")}</h2>
					<p>{t("public.terms.thirdParty.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.disclaimer.title")}</h2>
					<p>{t("public.terms.disclaimer.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.limitation.title")}</h2>
					<p>{t("public.terms.limitation.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.changes.title")}</h2>
					<p>{t("public.terms.changes.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.termination.title")}</h2>
					<p>{t("public.terms.termination.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.governing.title")}</h2>
					<p>{t("public.terms.governing.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("public.terms.contact.title")}</h2>
					<p>
						{t.rich("public.terms.contact.description", {
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
						{t("public.terms.viewPrivacy")}
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
	};
}
