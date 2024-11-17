import { parseAsString } from "nuqs/server";
import { RulesForm } from "./_components/rules.form";
import { prisma } from "@/lib/prisma";

export default async function Page(props: {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
	const params = await props.params;
	const searchParams = await props.searchParams;

	const [rules, editingRule] = await Promise.all([
		prisma.clubRule.findMany({
			where: { clubId: params.clubId },
			orderBy: { createdAt: "desc" },
		}),
		searchParams?.ruleId
			? prisma.clubRule.findUnique({
					where: { id: searchParams.ruleId, clubId: params.clubId },
				})
			: null,
	]);

	return (
		<div className="space-y-4 w-full max-w-3xl">
			<RulesForm
				key={JSON.stringify(searchParams)}
				rules={rules}
				clubId={params.clubId}
				editingRule={editingRule}
			/>
		</div>
	);
}
