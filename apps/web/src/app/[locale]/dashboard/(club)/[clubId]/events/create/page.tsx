import { parse as parseDateFns } from "date-fns";
import { getExtracted } from "next-intl/server";
import CreateEventForm from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.form";
import { ErrorPage } from "@/components/error-page";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { isAuthenticated } from "@/lib/auth";

type EventResponse = ApiResponse<"/api/events/{id}", "get">;

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/create">) {
	const searchParams = await props.searchParams;
	const params = await props.params;
	const t = await getExtracted();
	const user = await isAuthenticated();

	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	const { data: membershipData } = await apiServer.GET("/api/clubs/{id}/membership", {
		params: {
			path: { id: params.clubId },
		},
	});

	const role = membershipData?.membership?.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER" || user.role === "admin";

	if (!isManager) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	let existingEvent: EventResponse | null = null;

	if (searchParams?.id) {
		const { data } = await apiServer.GET("/api/events/{id}", {
			params: {
				path: { id: searchParams.id as string },
			},
		});
		existingEvent = data || null;
	}

	const { data: rulesData } = await apiServer.GET("/api/clubs/{id}/rules", {
		params: {
			path: { id: params.clubId },
		},
	});
	const rules = rulesData?.rules || [];

	// Parse initial date from search params if provided
	const parsedDate = searchParams?.date ? parseDateFns(searchParams.date as string, "yyyy-MM-dd", new Date()) : null;
	const prefillDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

	return <CreateEventForm event={existingEvent?.event || null} rules={rules} prefillDate={prefillDate} />;
}
