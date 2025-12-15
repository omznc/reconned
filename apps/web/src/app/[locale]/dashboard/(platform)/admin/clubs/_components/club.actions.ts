import apiClient from "@/lib/api";

type ClubAdminAction = "ban" | "unban" | "remove";

export async function clubAdminAction(params: { clubId: string; action: ClubAdminAction }) {
	if (params.action === "ban") {
		return apiClient.PUT("/api/admin/clubs/{id}/ban", {
			params: { path: { id: params.clubId } },
		});
	}

	if (params.action === "unban") {
		return apiClient.PUT("/api/admin/clubs/{id}/unban", {
			params: { path: { id: params.clubId } },
		});
	}

	return apiClient.DELETE("/api/admin/clubs/{id}", {
		params: { path: { id: params.clubId } },
	});
}
