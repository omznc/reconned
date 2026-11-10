import { createFileRoute } from "@tanstack/react-router";
import { useExtracted } from "next-intl";
import { NotFoundPage } from "@/components/not-found-page";
import { TasksList } from "@/routes/{-$locale}/dashboard/admin/tasks/-components/tasks-list";

export const Route = createFileRoute("/{-$locale}/dashboard/admin/tasks/")({
	notFoundComponent: NotFoundPage,
	component: TasksPage,
});

function TasksPage() {
	const t = useExtracted();

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Background Tasks")}</h3>
				<p className="text-sm text-muted-foreground">{t("Manage and monitor background tasks")}</p>
			</div>
			<TasksList />
		</>
	);
}
