import { env } from "@/lib/env";

export type SeoInput = {
	title: string;
	description?: string;
	keywords?: string;
	/** Open Graph type. Defaults to `website`. */
	type?: "website" | "profile" | "article";
	/** Absolute canonical URL. */
	canonical?: string;
	/** hreflang -> absolute URL, from `generatePageLanguages` or `generateHreflangAlternatesForSluggableEntity`. */
	languages?: Record<string, string>;
	/** Open Graph image. Defaults to the site-wide `/opengraph-image.jpg`. */
	image?: { url: string; alt: string; width?: number; height?: number };
	/** JSON-LD documents, already `JSON.stringify`-ed so the object stays serializable in loader data. */
	schemas?: string[];
};

/**
 * Builds the object a route's `head()` returns. It covers what `generateMetadata` returned in Next.js:
 * title, description, keywords, Open Graph, Twitter card, canonical, hreflang and JSON-LD.
 */
export function buildSeoHead(input: SeoInput) {
	const image = input.image ?? {
		url: `${env.NEXT_PUBLIC_WEB_URL}/opengraph-image.jpg`,
		alt: "RECONNED",
		width: 1200,
		height: 630,
	};
	const meta: Array<Record<string, string>> = [{ title: input.title }];
	const addMeta = (key: "name" | "property", name: string, content: string | undefined) => {
		if (content) {
			meta.push({ [key]: name, content });
		}
	};

	addMeta("name", "description", input.description);
	addMeta("name", "keywords", input.keywords);
	addMeta("property", "og:title", input.title);
	addMeta("property", "og:description", input.description);
	addMeta("property", "og:type", input.type ?? "website");
	addMeta("property", "og:url", input.canonical);
	addMeta("property", "og:image", image.url);
	addMeta("property", "og:image:alt", image.alt);
	addMeta("property", "og:image:width", image.width?.toString());
	addMeta("property", "og:image:height", image.height?.toString());
	addMeta("name", "twitter:card", "summary_large_image");
	addMeta("name", "twitter:title", input.title);
	addMeta("name", "twitter:description", input.description);

	const links: Array<Record<string, string>> = [];
	if (input.canonical) {
		links.push({ rel: "canonical", href: input.canonical });
	}
	for (const [hreflang, href] of Object.entries(input.languages ?? {})) {
		links.push({ rel: "alternate", hrefLang: hreflang, href });
	}

	const scripts = (input.schemas ?? []).map((schema) => ({
		type: "application/ld+json",
		children: schema,
	}));

	return { meta, links, scripts };
}
