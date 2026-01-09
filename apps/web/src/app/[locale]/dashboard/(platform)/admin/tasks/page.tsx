import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { TasksList } from "./_components/tasks-list.tsx";

export default async function TasksPage() {
	const t = await getExtracted();

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Background Tasks")}</h3>
				<p className="text-sm text-muted-foreground">{t("Manage and monitor background tasks")}</p>
			</div>
			<Suspense fallback={<GenericDataTableSkeleton />}>
				<TasksList />
			</Suspense>
		</>
	);
}
