import type { SportsOrganization, WebSite, WithContext } from "schema-dts";
import { env } from "@/lib/env";

/** WebSite and Organization JSON-LD for the `<head>` of every page. */
export function buildSiteSchemas({ locale, description }: { locale: string; description: string }) {
	const websiteSchema = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Reconned",
		description,
		url: env.NEXT_PUBLIC_WEB_URL,
		logo: `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-light.svg`,
		sameAs: ["https://github.com/omznc/reconned"],
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
		about: {
			"@type": "SportsOrganization",
			name: "Airsoft Community",
			sport: "Airsoft",
			description: "Platform connecting airsoft clubs and players",
		},
	} as WithContext<WebSite>;

	const organizationSchema: WithContext<SportsOrganization> = {
		"@context": "https://schema.org",
		"@type": "SportsOrganization",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/#organization`,
		name: "Reconned",
		sport: "Airsoft",
		description,
		url: env.NEXT_PUBLIC_WEB_URL,
		logo: `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-light.svg`,
		foundingDate: "2024",
		address: {
			"@type": "PostalAddress",
			addressCountry: "BA",
		},
		sameAs: ["https://github.com/omznc/reconned"],
	};

	return [websiteSchema, organizationSchema];
}
