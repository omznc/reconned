import { getExtracted } from "next-intl/server";

export type NotFoundData = { title: string; description: string; keywords: string };

export async function getNotFoundData(locale: string): Promise<NotFoundData> {
	const t = await getExtracted({ locale });
	return {
		title: t("You are lost"),
		description: t("The page you are looking for does not exist."),
		keywords: t("404, not found, page not found, airsoft, Bosnia, BiH")
			.split(",")
			.map((keyword: string) => keyword.trim())
			.join(", "),
	};
}

function isNotFoundData(data: unknown): data is NotFoundData {
	return typeof data === "object" && data !== null && "title" in data && "description" in data;
}

/** The 404 data travels on the thrown `notFound({ data })`; `head()` reads it from `match.error`. */
export function readNotFoundData(error: unknown): NotFoundData | undefined {
	const data = typeof error === "object" && error !== null && "data" in error ? error.data : undefined;
	return isNotFoundData(data) ? data : undefined;
}

/** Head of every 404 page: `noindex` keeps it out of search results. */
export function buildNotFoundHead(title: string, extra: Array<Record<string, string>> = []) {
	return { meta: [{ title }, { name: "robots", content: "noindex" }, ...extra] };
}

export function buildCatchAllHead(data: NotFoundData) {
	return buildNotFoundHead(data.title, [
		{ name: "description", content: data.description },
		{ name: "keywords", content: data.keywords },
	]);
}
