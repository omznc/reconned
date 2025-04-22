import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

const lastUpdated = new Date("2025-04-13");

export default async function TermsOfUsePage() {
	const t = await getTranslations("public.terms");
	const locale = await getLocale();

	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<h1 className="text-3xl font-bold mb-8">{t("title")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6" suppressHydrationWarning>
					{t("lastUpdated", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("introduction.title")}</h2>
					<p>{t("introduction.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("acceptance.title")}</h2>
					<p>{t("acceptance.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("eligibility.title")}</h2>
					<p>{t("eligibility.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("userAccounts.title")}</h2>
					<p>{t("userAccounts.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("userAccounts.accuracy")}</li>
						<li>{t("userAccounts.security")}</li>
						<li>{t("userAccounts.responsibility")}</li>
						<li>{t("userAccounts.termination")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("content.title")}</h2>
					<p>{t("content.description")}</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("content.userContent.title")}</h3>
					<p>{t("content.userContent.description")}</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("content.prohibited.title")}</h3>
					<p>{t("content.prohibited.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("content.prohibited.illegal")}</li>
						<li>{t("content.prohibited.harmful")}</li>
						<li>{t("content.prohibited.impersonation")}</li>
						<li>{t("content.prohibited.spam")}</li>
						<li>{t("content.prohibited.infringement")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("intellectualProperty.title")}</h2>
					<p>{t("intellectualProperty.description")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("intellectualProperty.ownership")}</li>
						<li>{t("intellectualProperty.license")}</li>
						<li>{t("intellectualProperty.feedback")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("thirdParty.title")}</h2>
					<p>{t("thirdParty.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("disclaimer.title")}</h2>
					<p>{t("disclaimer.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("limitation.title")}</h2>
					<p>{t("limitation.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("changes.title")}</h2>
					<p>{t("changes.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("termination.title")}</h2>
					<p>{t("termination.description")}</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("governing.title")}</h2>
					<p>{t("governing.description")}</p>
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
					<Link href="/privacy-policy" className="text-primary hover:underline">
						{t("viewPrivacy")}
					</Link>
				</div>
			</div>
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("public");

	return {
		title: t("terms.metadata.title"),
		description: t("terms.metadata.description"),
		keywords: t("layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
