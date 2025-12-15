import apiClient, { type ApiResponse } from "@/lib/api";
import { RulesForm } from "./_components/rules.form.tsx";

type ClubRulesResponse = ApiResponse<"/api/clubs/{id}/rules", "get">;

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/rules">) {
	const params = await props.params;
	const searchParams = await props.searchParams;

	const { data } = await apiClient.GET("/api/clubs/{id}/rules", {
		params: {
			path: {
				id: params.clubId,
			},
		},
	});

	const rules = (data as ClubRulesResponse | undefined) ?? [];
	const editingRule = searchParams?.ruleId
		? (rules.find((rule) => rule.id === (searchParams.ruleId as string)) ?? null)
		: null;

	return (
		<RulesForm key={JSON.stringify(searchParams)} rules={rules} clubId={params.clubId} editingRule={editingRule} />
	);
}
