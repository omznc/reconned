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

/** Only a URL with a known file extension gets a type, like Next.js did for the file-based og image. */
const IMAGE_TYPES: Record<string, string | undefined> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};

type AddMeta = (key: "name" | "property", name: string, content: string | undefined) => void;

/** Adds the `og:image*` or `twitter:image*` tags from one image input. */
function addImageMeta(
	addMeta: AddMeta,
	key: "name" | "property",
	prefix: string,
	image: NonNullable<SeoInput["image"]>,
) {
	const extension = /\.(\w+)(?:\?|$)/.exec(image.url)?.[1]?.toLowerCase() ?? "";
	addMeta(key, prefix, image.url);
	addMeta(key, `${prefix}:type`, IMAGE_TYPES[extension]);
	addMeta(key, `${prefix}:alt`, image.alt);
	addMeta(key, `${prefix}:width`, image.width?.toString());
	addMeta(key, `${prefix}:height`, image.height?.toString());
}

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
	addImageMeta(addMeta, "property", "og:image", image);
	addMeta("name", "twitter:card", "summary_large_image");
	addMeta("name", "twitter:title", input.title);
	addMeta("name", "twitter:description", input.description);
	addImageMeta(addMeta, "name", "twitter:image", image);

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
