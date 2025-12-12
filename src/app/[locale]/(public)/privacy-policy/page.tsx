import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { WebPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const lastUpdated = new Date("2025-04-13");

export const revalidate = 86_400; // 1 day

export default async function PrivacyPolicyPage() {
	const t = await getExtracted();
	const locale = await getLocale();

	const privacyPageSchema: WithContext<WebPage> = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/privacy-policy`,
		name: t("Privacy Policy - RECONNED"),
		description: t(
			"Learn about our privacy practices and how we protect your information. The first universal platform for airsoft clubs, events, and players.",
		),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/privacy-policy`,
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
			<h1 className="text-3xl font-bold mb-8">{t("Privacy Policy")}</h1>

			<div className="prose dark:prose-invert max-w-none">
				<p className="text-lg mb-6">
					{t("Last updated: {date}", {
						date: lastUpdated.toLocaleDateString(locale),
					})}
				</p>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Introduction")}</h2>
					<p>
						{t(
							'RECONNED ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and how we safeguard it when you use our airsoft community platform.',
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Information We Collect")}</h2>
					<p>
						{t(
							"We collect various types of information to provide and improve our service. Here's what we collect:",
						)}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>
							{t(
								"Personal information: name, email address, profile picture, bio, location, website, phone number, callsign, and gear settings.",
							)}
						</li>
						<li>
							{t(
								"Account information: session data (IP addresses, user agents), authentication data (passwords, passkeys, two-factor authentication).",
							)}
						</li>
						<li>
							{t(
								"Club information: name, location, description, founding date, logo, contact information, rules, etc.",
							)}
						</li>
						<li>
							{t(
								"Event information: name, description, locations, dates, prices, rules, participant registrations, etc.",
							)}
						</li>
						<li>
							{t(
								"Social information: reviews, posts, achievements, and other interactions between users.",
							)}
						</li>
						<li>
							{t(
								"Usage information: how you use our platform, which pages you visit, and how you interact with our interface.",
							)}
						</li>
						<li>
							{t(
								"Device information: device type, operating system, browser version, and language settings.",
							)}
						</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("How We Use Your Information")}</h2>
					<p>{t("We use the collected information for various purposes, including:")}</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>
							{t(
								"To provide, maintain, and improve our platform, including connecting airsoft clubs, players, and events.",
							)}
						</li>
						<li>{t("To analyze how you use our platform and enhance user experience.")}</li>
						<li>
							{t(
								"To communicate with you, respond to your inquiries, and send notifications about our service.",
							)}
						</li>
						<li>
							{t("To protect our users and platform from fraud, abuse, and other harmful activities.")}
						</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Data Security")}</h2>
					<p>
						{t(
							"We implement security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. This includes encryption of sensitive data, secure servers, and regular security reviews.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Information Sharing")}</h2>
					<p>
						{t(
							"We don't sell your personal information to third parties. However, we may share information in the following situations:",
						)}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>
							{t(
								"With other club members (if you're a member of a club, certain information may be visible to other members).",
							)}
						</li>
						<li>
							{t(
								"With event participants (if you're registered for an event, certain information may be visible to other participants).",
							)}
						</li>
						<li>{t("With service providers who help us operate the platform (e.g., hosting).")}</li>
						<li>{t("When required by law or to protect our rights.")}</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Cookies and Tracking Technologies")}</h2>
					<p>
						{t(
							"We use cookies and similar tracking technologies to collect and store certain information when you use our platform. This helps us improve your experience, analyze platform usage, and tailor content to your interests.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Your Data Rights")}</h2>
					<p>
						{t(
							"Depending on your location, you may have certain rights regarding your personal information, including:",
						)}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("The right to access the information we have about you.")}</li>
						<li>{t("The right to correct inaccurate or incomplete information.")}</li>
						<li>{t("The right to delete your information in certain circumstances.")}</li>
						<li>{t("The right to restrict the processing of your information.")}</li>
						<li>{t("The right to object to the processing of your information.")}</li>
						<li>
							{t("The right to data portability (obtaining a copy of your data in a structured format).")}
						</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Third-Party Services")}</h2>
					<p>
						{t(
							"Our platform uses several third-party services that may collect information about you. These services include:",
						)}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>{t("Authentication services (e.g., Google login) for easy sign-in.")}</li>
						<li>{t("Storage services for storing data and media files.")}</li>
						<li>{t("Mapping services for displaying club and event locations.")}</li>
						<li>{t("Analytics services for tracking platform usage.")}</li>
						<li>
							{t(
								"Integration with Instagram for clubs that want to display their Instagram posts on their club profile.",
							)}
						</li>
					</ul>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Children's Privacy")}</h2>
					<p>
						{t(
							"Our platform is not intended for use by individuals under the age of 17. We do not knowingly collect personal information from children under 17. If we discover that we have collected personal information from a child, we will take steps to delete that information.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Changes to This Privacy Policy")}</h2>
					<p>
						{t(
							"We may update our Privacy Policy from time to time. We will notify you of significant changes by posting a notification on our website or through direct communication. We encourage you to periodically review this Privacy Policy to stay informed about how we are protecting your information.",
						)}
					</p>
				</section>

				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Contact Us")}</h2>
					<p>
						{t.rich(
							"If you have any questions about this Privacy Policy or our privacy practices, please contact us at <email></email>.",
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
					<Link href="/terms-of-use" className="text-primary hover:underline">
						{t("View our Terms of Use")}
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
		title: t("Privacy Policy - RECONNED"),
		description: t(
			"Learn about our privacy practices and how we protect your information. The first universal platform for airsoft clubs, events, and players.",
		),
		keywords: t(
			"privacy policy, data protection, personal information, airsoft privacy, user data, GDPR compliance, privacy rights",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Privacy Policy - RECONNED"),
			description: t(
				"Learn about our privacy practices and how we protect your information. The first universal platform for airsoft clubs, events, and players.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/privacy-policy", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Privacy Policy - RECONNED"),
			description: t(
				"Learn about our privacy practices and how we protect your information. The first universal platform for airsoft clubs, events, and players.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/privacy-policy", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/privacy-policy", locale),
		},
	};
}
