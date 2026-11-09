import { createFileRoute, notFound } from "@tanstack/react-router";
import { getExtracted } from "next-intl/server";
import { NotFoundPage } from "@/components/not-found-page";

type NotFoundData = { title: string; description: string; keywords: string };

function isNotFoundData(data: unknown): data is NotFoundData {
	return typeof data === "object" && data !== null && "title" in data && "description" in data;
}

/** Catch-all for unmatched URLs. Throws in the loader (not `beforeLoad`) so the layout's messages are loaded first. */
export const Route = createFileRoute("/{-$locale}/$")({
	loader: async ({ context }) => {
		const t = await getExtracted({ locale: context.locale });
		throw notFound({
			data: {
				title: t("You are lost"),
				description: t("The page you are looking for does not exist."),
				keywords: t("404, not found, page not found, airsoft, Bosnia, BiH")
					.split(",")
					.map((keyword: string) => keyword.trim())
					.join(", "),
			} satisfies NotFoundData,
		});
	},
	// The 404 data travels on the thrown error, so `head()` reads it from `match.error`.
	head: ({ match }) => {
		const error: unknown = match.error;
		const data = typeof error === "object" && error !== null && "data" in error ? error.data : undefined;
		if (!isNotFoundData(data)) {
			return {};
		}
		return {
			meta: [
				{ title: data.title },
				{ name: "description", content: data.description },
				{ name: "keywords", content: data.keywords },
			],
		};
	},
	notFoundComponent: NotFoundPage,
});
