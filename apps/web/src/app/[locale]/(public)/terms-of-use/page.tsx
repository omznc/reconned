import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { WebPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const lastUpdated = new Date("2025-04-13");

export const revalidate = 86_400; // 1 day

export default async function TermsOfUsePage() {
	const t = await getExtracted();
	const locale = await getLocale();

	const termsPageSchema: WithContext<WebPage> = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/terms-of-use`,
		name: t("Terms of Use - RECONNED"),
		description: t(
			"Read our Terms of Use for the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
		),
		url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/terms-of-use`,
		dateModified: lastUpdated.toISOString(),
		datePublished: lastUpdated.toISOString(),
		publisher: {
			"@type": "Organization",
			name: "Reconned",
			url: env.NEXT_PUBLIC_WEB_URL,
			logo: `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-light.svg`,
		},
		about: {
			"@type": "Thing",
			name: "Terms of Use",
			description: "Terms and conditions for using the platform",
		},
	};

	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<JsonLdScript data={termsPageSchema} />
			<h1 className="text-3xl font-bold mb-8">{t("Terms of Use")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6" suppressHydrationWarning>
					{t("Last updated: {date}", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Introduction")}</h2>
					<p>
						{t(
							"Welcome to RECONNED, a platform that connects airsoft enthusiasts, clubs, and events. By using our website and services, you agree to comply with these Terms of Use. Please read them carefully.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Acceptance of Terms")}</h2>
					<p>
						{t(
							"By accessing or using the RECONNED platform, you agree to be legally bound by these Terms of Use. If you do not agree to any part of these terms, please do not use our platform.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Eligibility")}</h2>
					<p>
						{t(
							"To use our platform, you must be at least 17 years old. By using the platform, you confirm that you are at least 17 years old and that you are not a person barred from receiving our services under the laws of Bosnia and Herzegovina or other applicable jurisdictions.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("User Accounts")}</h2>
					<p>
						{t(
							"To access certain features of our platform, you will need to create a user account. When you do, you are responsible for:",
						)}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("Maintaining the accuracy and currency of your information.")}</li>
						<li>{t("Keeping your account and password secure.")}</li>
						<li>{t("All activities that occur under your account.")}</li>
						<li>
							{t(
								"Understanding that we may suspend or terminate your account if you violate these terms.",
							)}
						</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("User Content and Conduct")}</h2>
					<p>{t("Our platform allows you to post content, including text, images, and other materials.")}</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("Your Content")}</h3>
					<p>
						{t(
							"You retain ownership of the content you post on the platform, but grant us a non-exclusive, royalty-free license to use, display, and distribute that content in connection with our services.",
						)}
					</p>
					<h3 className="text-xl font-semibold mt-4 mb-2">{t("Prohibited Activities")}</h3>
					<p>{t("The following behaviors are prohibited on the RECONNED platform:")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("Posting or promoting illegal activities.")}</li>
						<li>{t("Posting content that is harmful, threatening, offensive, or harassing.")}</li>
						<li>{t("Impersonating another user or entity.")}</li>
						<li>{t("Sending unwanted messages or spamming the platform.")}</li>
						<li>{t("Violating copyright or other intellectual property rights.")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Intellectual Property")}</h2>
					<p>
						{t(
							"RECONNED and its content, features, and appearance are protected by copyright, trademark, and other intellectual property laws.",
						)}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>
							{t(
								"All trademarks, logos, product and service names displayed on the platform are the property of RECONNED or their respective owners.",
							)}
						</li>
						<li>
							{t(
								"We grant you a limited, non-exclusive, non-transferable license to access and use the platform for personal, non-commercial purposes.",
							)}
						</li>
						<li>
							{t(
								"If you provide us with feedback or suggestions, we may use them without any obligation to you.",
							)}
						</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Third-Party Links")}</h2>
					<p>
						{t(
							"Our platform may contain links to third-party websites that are not owned or controlled by us. We are not responsible for the content, privacy policies, or practices of any third-party websites.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Disclaimer of Warranties")}</h2>
					<p>
						{t(
							'The RECONNED platform is provided "as is" and "as available", without any warranties, either express or implied. We do not guarantee that the platform will always be available, secure, error-free, or meet your specific requirements.',
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Limitation of Liability")}</h2>
					<p>
						{t(
							"To the extent permitted by law, RECONNED and its founders, officers, directors, employees, and agents will not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the platform.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Changes to Terms")}</h2>
					<p>
						{t(
							"We reserve the right to modify or replace these Terms of Use at any time. If we make material changes, we will endeavor to notify you before the new terms take effect. By continuing to use the platform after the changes take effect, you agree to the updated terms.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Termination")}</h2>
					<p>
						{t(
							"We may, in our sole discretion, modify, suspend, or terminate your access to the platform for any reason, including violation of these Terms of Use, without prior notice.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Governing Law")}</h2>
					<p>
						{t(
							"These Terms of Use are governed by and construed in accordance with the laws of Bosnia and Herzegovina, regardless of conflict of law provisions.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Contact Us")}</h2>
					<p>
						{t.rich(
							"If you have any questions about these Terms of Use, please contact us at <email></email>.",
							{
								email: () => (
									<a href="mailto:mail@reconned.com" className="text-primary hover:underline">
										mail@reconned.com
									</a>
								),
							},
						)}
					</p>
				</section>

				<div className="mt-12 border-t pt-6">
					<Link href="/privacy-policy" className="text-primary hover:underline">
						{t("View our Privacy Policy")}
					</Link>
				</div>
			</div>
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Terms of Use - RECONNED"),
		description: t(
			"Read our Terms of Use for the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
		),
		keywords: t(
			"terms of use, terms and conditions, user agreement, airsoft terms, platform rules, service agreement, legal terms",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Terms of Use - RECONNED"),
			description: t(
				"Read our Terms of Use for the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/terms-of-use", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Terms of Use - RECONNED"),
			description: t(
				"Read our Terms of Use for the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/terms-of-use", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/terms-of-use", locale),
		},
	};
}
