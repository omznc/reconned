import { Button } from "@components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ContactPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { buildSeoHead, type SeoInput } from "@/lib/seo";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const Route = createFileRoute("/{-$locale}/_public/support-us")({
	loader: async ({ context }) => await loadSeo(context.locale),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData) : {}),
	component: Page,
});

function Page() {
	const t = useExtracted();
	const { locale } = Route.useRouteContext();

	const supportPageSchema: WithContext<ContactPage> = {
		"@context": "https://schema.org",
		"@type": "ContactPage",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/support-us`,
		name: t("Support us - RECONNED"),
		description: t(
			"Support the RECONNED platform and help us build the best airsoft community. The first universal platform for airsoft clubs, events, and players.",
		),
		url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/support-us`,
		mainEntity: {
			"@type": "Organization",
			name: "Reconned",
			url: env.NEXT_PUBLIC_WEB_URL,
			contactPoint: {
				"@type": "ContactPoint",
				contactType: "customer support",
				email: "mail@reconned.com",
				url: "mailto:mail@reconned.com",
			},
		},
		about: {
			"@type": "Thing",
			name: "Support",
			description: "Ways to support the Reconned platform development",
		},
	};

	return (
		<div className="flex flex-col gap-4">
			<JsonLdScript data={supportPageSchema} />
			<h1>{t("Support us (coming soon)")}</h1>
			<Button type="button" variant="secondary">
				<Link href="/">{t("Back")}</Link>
			</Button>
		</div>
	);
}

async function loadSeo(locale: string): Promise<SeoInput> {
	const t = await getExtracted({ locale });
	const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";

	return {
		title: t("Support RECONNED - Help Build the Airsoft Community"),
		description: t(
			"Support the development of RECONNED and help us build the best airsoft community platform. Learn how you can contribute, donate, or sponsor our mission.",
		),
		keywords: t(
			"support airsoft platform, donate to airsoft, fund airsoft community, airsoft sponsorship, help airsoft development, airsoft platform funding",
		)
			.split(",")
			.map((keyword: string) => keyword.trim())
			.join(", "),
		canonical: constructCanonicalUrl(baseUrl, "/support-us", locale),
		languages: generatePageLanguages(baseUrl, "/support-us", locale),
	};
}
