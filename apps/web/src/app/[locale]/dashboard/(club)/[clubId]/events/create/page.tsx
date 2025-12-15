import { parse as parseDateFns } from "date-fns";
import { notFound } from "next/navigation";
import CreateEventForm from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.form";
import apiClient, { type ApiResponse } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

type EventResponse = ApiResponse<"/api/events/{id}", "get">;
type ClubRulesResponse = ApiResponse<"/api/clubs/{id}/rules", "get">;

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/create">) {
	const searchParams = await props.searchParams;
	const params = await props.params;
	const user = await isAuthenticated();

	if (!user?.managedClubs.some((club) => club === params.clubId)) {
		return notFound();
	}

	let existingEvent: EventResponse | null = null;

	if (searchParams?.id) {
		const { data } = await apiClient.GET("/api/events/{id}", {
			params: {
				path: { id: searchParams.id as string },
			},
		});
		existingEvent = (data as EventResponse) ?? null;
	}

	const { data: rulesData } = await apiClient.GET("/api/clubs/{id}/rules", {
		params: {
			path: { id: params.clubId },
		},
	});
	const rules = (rulesData as ClubRulesResponse | undefined) ?? [];

	// Parse initial date from search params if provided
	const parsedDate = searchParams?.date ? parseDateFns(searchParams.date as string, "yyyy-MM-dd", new Date()) : null;
	const prefillDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

	return <CreateEventForm event={existingEvent} rules={rules} prefillDate={prefillDate} />;
}
