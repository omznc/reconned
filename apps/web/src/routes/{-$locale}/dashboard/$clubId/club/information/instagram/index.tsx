import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { InstagramPageSelection } from "@/routes/{-$locale}/dashboard/$clubId/club/information/instagram/-components/instagram-page-selection";

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/club/information/instagram/")({
	validateSearch: z.object({ sessionId: z.coerce.string().optional() }),
	component: InstagramPage,
});

function InstagramPage() {
	const { clubId } = Route.useParams();
	const { sessionId } = Route.useSearch();

	return <InstagramPageSelection clubId={clubId} sessionId={sessionId ?? null} />;
}
