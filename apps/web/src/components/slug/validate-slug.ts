import apiClient from "@/lib/api/api.client";

type ValidateSlugArgs = {
	type: "club" | "event" | "user";
	slug: string;
	excludeId?: string;
};

export async function validateSlug(args: ValidateSlugArgs): Promise<boolean> {
	const { data, error } = await apiClient.POST("/api/validate-slug", {
		body: args,
	});

	if (error) {
		return false;
	}

	return data?.available || false;
}
