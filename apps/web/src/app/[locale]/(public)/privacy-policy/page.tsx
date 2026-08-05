import { RETENTION, retentionDays } from "backend/lib/retention-periods";
import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import type { WebPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { PRIVACY_POLICY_LAST_UPDATED } from "@/lib/legal-dates";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const lastUpdated = PRIVACY_POLICY_LAST_UPDATED;

export const revalidate = 86_400; // 1 day

export default async function PrivacyPolicyPage(props: PageProps<"/[locale]/privacy-policy">) {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	const privacyPageSchema: WithContext<WebPage> = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/privacy-policy`,
		name: t("Privacy Policy - RECONNED"),
		description: t(
			"Learn about our privacy practices and how we protect your information. The first universal platform for airsoft clubs, events, and players.",
		),
		url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/privacy-policy`,
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
								"Analytics data: user interactions, feature usage patterns, event creation/registration activities, and platform engagement metrics.",
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
						<li>
							{t(
								"To analyze how you use our platform, track feature adoption, and enhance user experience through data-driven improvements.",
							)}
						</li>
						<li>
							{t(
								"To communicate with you, respond to your inquiries, and send notifications about our service.",
							)}
						</li>
						<li>
							{t(
								"To monitor platform performance, identify usage patterns, and optimize resource allocation.",
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
					<p className="mt-4">
						{t(
							"We use PostHog, an open-source product analytics platform, to track user interactions and improve our service. The specific events we track include:",
						)}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>
							{t(
								"Authentication events: login attempts, successful logins, registration attempts, and account creation.",
							)}
						</li>
						<li>
							{t(
								"User preferences: theme changes (light/dark), language selection, font preferences, and style settings.",
							)}
						</li>
						<li>
							{t(
								"Platform interactions: event creation and updates, club membership extensions, file uploads and deletions.",
							)}
						</li>
						<li>
							{t(
								"Business activities: event registrations, club invitations, membership changes, and administrative actions.",
							)}
						</li>
						<li>
							{t(
								"Technical data: page views, user agent information, IP addresses, and device characteristics.",
							)}
						</li>
					</ul>
					<p className="mt-4">
						{t(
							"Analytics is optional and runs only if you agree to it. Nothing is loaded and no analytics cookie is set until you do, and you can change your mind at any time through Cookie settings in the footer. This data is not anonymous: it is linked to an identifier for your account, though we do not send your name or email address to our analytics provider. We use it solely to improve the platform.",
						)}
					</p>
				</section>

				{/*
				 * Its own section, not a clause in the analytics paragraph: the banner says only
				 * "analytics", so this is the only place a person learns their screen is recorded.
				 * It has to be findable by someone skimming headings.
				 */}
				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("Session Recordings")}</h2>
					<p>
						{t(
							"If you accept analytics, we also record your sessions. A session recording reconstructs what your screen showed: the pages you visited, how you moved through them, and where you clicked. It is closer to a video of your visit than to a list of statistics, which is why we describe it separately here instead of leaving it under the general heading of analytics.",
						)}
					</p>
					<p className="mt-4">
						{t(
							"We do not record what you type. Every form input is masked, including your password, and the contents of your requests and of your browser console are never captured. Where our own pages display an email address, phone number or IP address, those are masked in the recording as well, so that other people's details do not end up in a recording of your visit.",
						)}
					</p>
					<p className="mt-4">
						{t(
							"Recording happens only if you accept analytics. If you decline, or later withdraw your consent through Cookie settings in the footer, no recording is made. Recordings are held by PostHog on servers in the European Union, and when you delete your account we instruct them to erase your data, recordings included.",
						)}
					</p>
				</section>

				{/*
				 * Art. 15(2)(a) requires the periods to be stated, and stating a number that the
				 * code does not enforce is worse than stating none. The figures below are rendered
				 * from the same constants the retention tasks run on
				 * (`backend/lib/retention-periods`), so the policy cannot drift from the behaviour
				 * it describes — changing a period changes this page in the same commit.
				 */}
				<section className="mb-8">
					<h2 className="text-2xl font-semibold mb-4">{t("How Long We Keep Your Data")}</h2>
					<p>
						{t(
							"We keep your account and profile data for as long as your account exists. There is no automatic expiry and we will not delete an inactive account on your behalf: your club memberships, attendance history and the reviews other people have written are tied to it, and removing them is your decision to make rather than ours. You can delete your account yourself at any time from your security settings, and it takes effect immediately.",
						)}
					</p>
					<p className="mt-4">
						{t("Everything else is kept for a set period and then removed automatically:")}
					</p>
					<ul className="list-disc pl-6 mt-4 space-y-2">
						<li>
							{t(
								"Expired sign-in sessions, including the IP address and browser they recorded: {days} days after the session expires.",
								{
									days: String(retentionDays(RETENTION.EXPIRED_SESSION)),
								},
							)}
						</li>
						<li>
							{t("Expired password reset and email confirmation links: {days} days after they expire.", {
								days: String(retentionDays(RETENTION.EXPIRED_VERIFICATION)),
							})}
						</li>
						<li>
							{t(
								"The IP address and browser recorded against club administration records: {days} days.",
								{
									days: String(retentionDays(RETENTION.AUDIT_LOG_NETWORK_IDENTIFIERS)),
								},
							)}
						</li>
					</ul>
					<p className="mt-4">
						{t(
							"Clubs keep a record of administrative actions taken within them, such as a member being added or removed, because a club needs to be able to account for its own decisions. Those records outlast an individual account, but when you delete yours we remove the link to you along with the IP address and browser attached to them.",
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
						<li>
							{t(
								"PostHog (open-source analytics platform) for tracking user interactions and improving platform functionality.",
							)}
						</li>
						<li>{t("OneSignal for sending email notifications and communications to users.")}</li>
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

export async function generateMetadata(props: PageProps<"/[locale]/privacy-policy">): Promise<Metadata> {
	const { locale } = await props.params;
	setRequestLocale(locale);
	const t = await getExtracted();

	return {
		title: t("Privacy Policy - How RECONNED Protects Your Data"),
		description: t(
			"Learn how RECONNED collects, uses, and protects your personal information. Understand your privacy rights and our data security practices.",
		),
		keywords: t(
			"privacy policy, data protection, personal information, airsoft privacy, user data, GDPR compliance, privacy rights, analytics, PostHog, tracking, user behavior",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Privacy Policy - How RECONNED Protects Your Data"),
			description: t(
				"Learn how RECONNED collects, uses, and protects your personal information. Understand your privacy rights and our data security practices.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/privacy-policy", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Privacy Policy - How RECONNED Protects Your Data"),
			description: t(
				"Learn how RECONNED collects, uses, and protects your personal information. Understand your privacy rights and our data security practices.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/privacy-policy", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/privacy-policy", locale),
		},
	};
}
