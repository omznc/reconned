import { notFound } from "next/navigation";

/**
 * `notFound()` rather than rendering the error page inline: rendering it here
 * answers 200, so every mistyped or dead URL looked like a real page to crawlers
 * and got indexed as duplicate thin content. Throwing hands off to
 * `[locale]/not-found.tsx` with an actual 404 status.
 */
export default function CatchAllPage() {
	notFound();
}
