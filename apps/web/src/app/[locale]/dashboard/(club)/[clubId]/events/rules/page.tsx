import apiServer from "@/lib/api/api.ts";
import { RulesForm } from "./_components/rules.form.tsx";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/rules">) {
	const params = await props.params;
	const searchParams = await props.searchParams;

	const { data } = await apiServer.GET("/api/clubs/{id}/rules", {
		params: {
			path: {
				id: params.clubId,
			},
		},
	});

	const rules = data?.rules ?? [];
	const editingRule = searchParams?.ruleId
		? (rules.find((rule) => rule.id === (searchParams.ruleId as string)) ?? null)
		: null;

	return (
		<RulesForm key={JSON.stringify(searchParams)} rules={rules} clubId={params.clubId} editingRule={editingRule} />
	);
}
